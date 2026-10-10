import { optimizeImageForUpload, type ImageUse } from "../lib/imageOptimizer";
import {
  requestImageKitUploadAuthorization,
  uploadOptimizedFileToImageKit,
  type ImageKitBrowserUpload,
  type ImageKitUploadAuthorization,
} from "../lib/imageKitStorage";

export type ImageKitProofResult = {
  url: string;
  fileId: string | null;
  filePath: string | null;
  optimizedBytes: number;
  progress: number[];
};

/**
 * Development-only path: shared optimizer, signed ImageKit authorization, browser upload, then image load.
 * Portfolio fields do not call this.
 */
export async function proveImageKitUpload(input: {
  file: File;
  idToken: string;
  profile?: ImageUse;
  signal?: AbortSignal;
  onPhase?: (phase: "preparing" | "optimizing") => void;
  onProgress?: (percent: number) => void;
  authorize?: (idToken: string) => Promise<ImageKitUploadAuthorization>;
  upload?: ImageKitBrowserUpload;
  loadUploadedImage?: (url: string) => Promise<void>;
}): Promise<ImageKitProofResult> {
  if (import.meta.env?.DEV === false) {
    throw new Error("ImageKit upload proof is available only in development.");
  }
  const optimized = await optimizeImageForUpload(
    input.file,
    input.onPhase,
    input.profile ?? "project",
    { signal: input.signal },
  );
  const authorization = await (input.authorize ?? requestImageKitUploadAuthorization)(input.idToken);
  const progress: number[] = [];
  const uploaded = await uploadOptimizedFileToImageKit({
    file: optimized.file,
    authorization,
    signal: input.signal,
    upload: input.upload,
    onProgress: (percent) => {
      progress.push(percent);
      input.onProgress?.(percent);
    },
  });
  await (input.loadUploadedImage ?? loadUploadedImage)(uploaded.url);
  return {
    url: uploaded.url,
    fileId: uploaded.fileId,
    filePath: uploaded.filePath,
    optimizedBytes: optimized.optimizedSize,
    progress,
  };
}

function loadUploadedImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("The uploaded image did not load."));
    image.src = url;
  });
}
