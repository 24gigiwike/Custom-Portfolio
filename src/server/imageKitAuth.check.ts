import assert from "node:assert/strict";
import { createSign, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { imageKitDevServerEnv } from "./imageKitDevPlugin";
import { ImageUploadCancelled } from "../lib/imageAttempt";
import {
  IMAGEKIT_UPLOAD_FAILED,
  ImageKitTransferError,
  uploadOptimizedFileToImageKit,
} from "../lib/imageKitStorage";
import { activeImageStorageProvider, configuredImageStorageProvider } from "../lib/imageStorageProvider";
import { proveImageKitUpload } from "../dev/imageKitUploadProof";
import { verifyFirebaseIdToken } from "./firebaseIdToken";
import { imageKitFolderForUser } from "./imageKitUploadAuth";
import {
  handleImageKitServerUpload,
  IMAGEKIT_MAX_UPLOAD_BYTES,
  imageTypeFromMagic,
  type ImageKitStoredUpload,
  type ImageKitUploadResponse,
} from "./imageKitServerUpload";
import retiredAuth from "../../api/imagekit-auth";

const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const certificate = publicKey.export({ type: "spki", format: "pem" }).toString();
const signingKey = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const projectId = "custom-portfolio-2026";
const nowMs = 1_700_000_000_000;
const privateApiKey = "private-test-key-value";

function b64url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function signToken(payload: Record<string, unknown>, header: Record<string, unknown> = { alg: "RS256", typ: "JWT", kid: "test-key" }): string {
  const encodedHeader = b64url(JSON.stringify(header));
  const encodedPayload = b64url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(data);
  signer.end();
  return `${data}.${signer.sign(signingKey).toString("base64url")}`;
}

function validPayload(uid = "user123"): Record<string, unknown> {
  const seconds = Math.floor(nowMs / 1000);
  return {
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    auth_time: seconds - 30,
    user_id: uid,
    sub: uid,
    iat: seconds - 30,
    exp: seconds + 3600,
  };
}

async function verify(token: string): Promise<{ uid: string }> {
  return verifyFirebaseIdToken(token, projectId, {
    now: () => nowMs,
    loadCerts: async () => ({ "test-key": certificate }),
  });
}

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.alloc(12);
WEBP.write("RIFF", 0);
WEBP.writeUInt32LE(4, 4);
WEBP.write("WEBP", 8);

function multipart(parts: Array<{ name: string; filename?: string; type?: string; data: Buffer }>, boundary = "----CustomBoundary7"): { body: Buffer; contentType: string } {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    const disposition = part.filename
      ? `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"`
      : `Content-Disposition: form-data; name="${part.name}"`;
    const type = part.type ? `Content-Type: ${part.type}\r\n` : "";
    chunks.push(Buffer.from(`--${boundary}\r\n${disposition}\r\n${type}\r\n`));
    chunks.push(part.data);
    chunks.push(Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

function call(input: {
  method?: string;
  token?: string | null;
  body?: Buffer | string;
  contentType?: string;
  bodyTooLarge?: boolean;
  developmentProof?: boolean;
  allowUids?: string;
  headers?: Record<string, string>;
  uploadFile?: (input: {
    bytes: Uint8Array;
    fileName: string;
    contentType: string;
    folder: string;
    privateKey: string;
  }) => Promise<ImageKitStoredUpload>;
}) {
  let status = 0;
  let body = "";
  const headers: Record<string, string> = {};
  const res: ImageKitUploadResponse = {
    status(code: number) {
      status = code;
      return res;
    },
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    end(value: string) {
      body = value;
    },
  };
  const requestHeaders: Record<string, string> = { ...(input.headers ?? {}) };
  if (input.contentType !== "") requestHeaders["content-type"] = input.contentType ?? "multipart/form-data; boundary=none";
  if (input.token) requestHeaders.authorization = `Bearer ${input.token}`;
  return handleImageKitServerUpload(
    {
      method: input.method ?? "POST",
      headers: requestHeaders,
      body: input.body,
      bodyTooLarge: input.bodyTooLarge,
    },
    res,
    {
      developmentProof: input.developmentProof,
      verify,
      uploadFile: input.uploadFile,
      env: {
        IMAGEKIT_PRIVATE_KEY: privateApiKey,
        IMAGEKIT_PUBLIC_KEY: "public_test_key",
        IMAGEKIT_URL_ENDPOINT: "https://ik.imagekit.io/example",
        IMAGEKIT_UPLOAD_ALLOW_UIDS: input.allowUids,
      },
    },
  ).then(() => ({ status, body, headers, json: body ? JSON.parse(body) as Record<string, unknown> : {} }));
}

function acceptingUpload(expectedType: string) {
  return async (upload: {
    bytes: Uint8Array;
    fileName: string;
    contentType: string;
    folder: string;
    privateKey: string;
  }) => {
    assert.equal(upload.folder, imageKitFolderForUser("user123"));
    assert.equal(upload.contentType, expectedType);
    assert.match(upload.fileName, new RegExp(`^[0-9a-f-]{36}\\.${expectedType === "image/jpeg" ? "jpg" : expectedType.split("/")[1]}$`));
    assert.equal(upload.privateKey, privateApiKey);
    assert.equal(imageTypeFromMagic(upload.bytes), expectedType);
    return {
      url: `https://ik.imagekit.io/example${upload.folder}/${upload.fileName}`,
      fileId: "file_123",
      filePath: `${upload.folder}/${upload.fileName}`,
    };
  };
}

const authSource = read("src/server/imageKitUploadAuth.ts");
assert.equal(authSource.includes("getAuthenticationParameters"), false);
assert.equal(authSource.includes("VITE_"), false);
const uploadSource = read("src/server/imageKitServerUpload.ts");
assert.match(uploadSource, /imageTypeFromMagic/);
assert.match(uploadSource, /useUniqueFileName: true/);
assert.match(uploadSource, /overwriteFile: false/);
assert.equal(uploadSource.includes("transformation"), false);
assert.equal(uploadSource.includes("webhookUrl"), false);

const clientSource = read("src/lib/imageKitStorage.ts");
assert.equal(clientSource.includes("IMAGEKIT_PRIVATE_KEY"), false);
assert.equal(clientSource.includes("@imagekit/javascript"), false);
assert.equal(clientSource.includes("/api/imagekit-auth"), false);
assert.match(clientSource, /\/api\/imagekit-upload/);
assert.equal(clientSource.includes("imageOptimizer"), false);

const proofSource = read("src/dev/imageKitUploadProof.ts");
assert.match(proofSource, /optimizeImageForUpload/);
assert.match(proofSource, /uploadOptimizedFileToImageKit/);
assert.equal(proofSource.includes("requestImageKitUploadAuthorization"), false);
assert.equal(proofSource.includes("signature"), false);
const optimizeAt = proofSource.indexOf("optimizeImageForUpload");
const uploadAt = proofSource.indexOf("uploadOptimizedFileToImageKit");
assert.ok(optimizeAt > 0 && optimizeAt < uploadAt);

assert.equal(read("src/App.tsx").includes("imagekit-proof"), false);
assert.equal(read("src/App.tsx").includes("imageKit"), false);
assert.equal(read("src/lib/storage.ts").toLowerCase().includes("imagekit"), false);
assert.match(read("src/lib/storage.ts"), /uploadBytesResumable/);
assert.match(read("vercel.json"), /api\/imagekit-upload\.ts/);
assert.equal(read("vercel.json").includes("imagekit-auth"), false);
const retired = read("api/imagekit-auth.ts");
assert.equal(retired.includes("getAuthenticationParameters"), false);
assert.equal(retired.includes("ImageKit"), false);
assert.equal(retired.includes("IMAGEKIT_PRIVATE_KEY"), false);
assert.match(retired, /410/);
const productionUpload = read("api/imagekit-upload.ts");
assert.equal(productionUpload.includes("developmentProof"), false);
assert.equal(productionUpload.includes("getAuthenticationParameters"), false);
const pluginSource = read("src/server/imageKitDevPlugin.ts");
assert.match(pluginSource, /apply: "serve"/);
assert.match(pluginSource, /loadEnv\(mode, envDir, ""\)/);
assert.match(pluginSource, /developmentProof: true/);
assert.match(pluginSource, /\/api\/imagekit-upload/);
assert.equal(pluginSource.includes("handleImageKitAuth"), false);
assert.equal(pluginSource.includes("getAuthenticationParameters"), false);
assert.equal(pluginSource.includes("console."), false);
assert.equal(read("api/imagekit-upload.ts").includes("loadEnv"), false);

const savedImageKitEnv = {
  IMAGEKIT_PRIVATE_KEY: process.env.IMAGEKIT_PRIVATE_KEY,
  IMAGEKIT_PUBLIC_KEY: process.env.IMAGEKIT_PUBLIC_KEY,
  IMAGEKIT_URL_ENDPOINT: process.env.IMAGEKIT_URL_ENDPOINT,
  IMAGEKIT_UPLOAD_ALLOW_UIDS: process.env.IMAGEKIT_UPLOAD_ALLOW_UIDS,
};
delete process.env.IMAGEKIT_PRIVATE_KEY;
delete process.env.IMAGEKIT_PUBLIC_KEY;
delete process.env.IMAGEKIT_URL_ENDPOINT;
delete process.env.IMAGEKIT_UPLOAD_ALLOW_UIDS;
const envDir = mkdtempSync(join(tmpdir(), "imagekit-env-"));
try {
  writeFileSync(join(envDir, ".env.local"), [
    "IMAGEKIT_PRIVATE_KEY=private-from-file",
    "IMAGEKIT_PUBLIC_KEY=public-from-file",
    "IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/example/",
  ].join("\n"));
  const fromFile = imageKitDevServerEnv("development", envDir);
  assert.equal(fromFile.IMAGEKIT_PRIVATE_KEY, "private-from-file");
  assert.equal(fromFile.IMAGEKIT_PUBLIC_KEY, "public-from-file");
  assert.equal(fromFile.IMAGEKIT_URL_ENDPOINT, "https://ik.imagekit.io/example/");
  process.env.IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/from-process";
  const fromProcess = imageKitDevServerEnv("development", envDir);
  assert.equal(fromProcess.IMAGEKIT_URL_ENDPOINT, "https://ik.imagekit.io/from-process");
  assert.equal(fromProcess.IMAGEKIT_PRIVATE_KEY, "private-from-file");
} finally {
  rmSync(envDir, { recursive: true, force: true });
  for (const [key, value] of Object.entries(savedImageKitEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
assert.equal(activeImageStorageProvider(), "firebase");
assert.equal(configuredImageStorageProvider(), "firebase");

const jpegForm = multipart([{ name: "file", filename: "client-chosen.jpg", type: "image/jpeg", data: JPEG }]);
const missingAuth = await call({ token: null, body: jpegForm.body, contentType: jpegForm.contentType, developmentProof: true });
assert.equal(missingAuth.status, 401);
assert.equal(missingAuth.json.error, "Sign in to upload an image.");
assert.equal(JSON.stringify(missingAuth.json).includes(privateApiKey), false);

const invalidToken = await call({
  token: "not-a-firebase-token",
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
});
assert.equal(invalidToken.status, 401);

const expired = await call({
  token: signToken({ ...validPayload(), exp: Math.floor(nowMs / 1000) - 120 }),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
});
assert.equal(expired.status, 401);
assert.match(String(expired.json.error), /session expired/i);

const wrongAudience = await call({
  token: signToken({ ...validPayload(), aud: "other-project" }),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
});
assert.equal(wrongAudience.status, 401);

const noneAlg = await call({
  token: signToken(validPayload(), { alg: "none", kid: "test-key" }),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
});
assert.equal(noneAlg.status, 401);

const closed = await call({
  token: signToken(validPayload()),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  uploadFile: async () => {
    throw new Error("closed gate must not upload");
  },
});
assert.equal(closed.status, 403);
assert.equal(closed.json.error, "Image upload is not available.");

const headerBypass = await call({
  token: signToken(validPayload()),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  headers: { "x-development-proof": "true" },
  uploadFile: async () => {
    throw new Error("request header must not open the gate");
  },
});
assert.equal(headerBypass.status, 403);

const emptyFile = multipart([{ name: "file", filename: "empty.jpg", type: "image/jpeg", data: Buffer.alloc(0) }]);
const missingFile = await call({
  token: signToken(validPayload()),
  body: emptyFile.body,
  contentType: emptyFile.contentType,
  developmentProof: true,
  uploadFile: async () => {
    throw new Error("missing file must not upload");
  },
});
assert.equal(missingFile.status, 400);

const spoofed = multipart([{ name: "file", filename: "photo.jpg", type: "image/jpeg", data: Buffer.from("%PDF-1.7 spoofed") }]);
const spoofedResult = await call({
  token: signToken(validPayload()),
  body: spoofed.body,
  contentType: spoofed.contentType,
  developmentProof: true,
  uploadFile: async () => {
    throw new Error("spoofed mime must not upload");
  },
});
assert.equal(spoofedResult.status, 415);

const tooBig = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(IMAGEKIT_MAX_UPLOAD_BYTES)]);
const oversized = multipart([{ name: "file", filename: "big.jpg", type: "image/jpeg", data: tooBig }]);
const oversizedResult = await call({
  token: signToken(validPayload()),
  body: oversized.body,
  contentType: oversized.contentType,
  developmentProof: true,
  uploadFile: async () => {
    throw new Error("oversized file must not upload");
  },
});
assert.equal(oversizedResult.status, 413);

const capped = await call({
  token: signToken(validPayload()),
  bodyTooLarge: true,
  developmentProof: true,
  uploadFile: async () => {
    throw new Error("capped body must not upload");
  },
});
assert.equal(capped.status, 413);

const folderOverride = multipart([
  { name: "file", filename: "photo.jpg", type: "image/jpeg", data: JPEG },
  { name: "folder", data: Buffer.from("/another-user/private") },
]);
const folderResult = await call({
  token: signToken(validPayload()),
  body: folderOverride.body,
  contentType: folderOverride.contentType,
  developmentProof: true,
  uploadFile: async () => {
    throw new Error("client folder must not upload");
  },
});
assert.equal(folderResult.status, 400);
assert.equal(folderResult.json.error, "This upload field is not available.");

const overwrite = multipart([
  { name: "file", filename: "photo.jpg", type: "image/jpeg", data: JPEG },
  { name: "overwriteFile", data: Buffer.from("true") },
]);
const overwriteResult = await call({
  token: signToken(validPayload()),
  body: overwrite.body,
  contentType: overwrite.contentType,
  developmentProof: true,
  uploadFile: async () => {
    throw new Error("client overwrite must not upload");
  },
});
assert.equal(overwriteResult.status, 400);

const jpeg = await call({
  token: signToken(validPayload()),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
  uploadFile: acceptingUpload("image/jpeg"),
});
assert.equal(jpeg.status, 200);
assert.equal(jpeg.headers["cache-control"], "no-store");
assert.equal(jpeg.json.fileId, "file_123");
assert.equal(jpeg.json.contentType, "image/jpeg");
assert.equal(typeof jpeg.json.url, "string");
assert.equal(String(jpeg.json.url).startsWith("https://ik.imagekit.io/example/custom-portfolio/user123/proof/"), true);
assert.equal(String(jpeg.json.filePath).startsWith("/custom-portfolio/user123/proof/"), true);
assert.equal("privateKey" in jpeg.json, false);
assert.equal("signature" in jpeg.json, false);
assert.equal("token" in jpeg.json, false);
assert.equal("publicKey" in jpeg.json, false);
assert.equal(JSON.stringify(jpeg.json).includes(privateApiKey), false);

const pngForm = multipart([{ name: "file", filename: "named.png", type: "image/jpeg", data: PNG }]);
const png = await call({
  token: signToken(validPayload()),
  body: pngForm.body,
  contentType: pngForm.contentType,
  allowUids: "user123,other",
  uploadFile: acceptingUpload("image/png"),
});
assert.equal(png.status, 200);
assert.equal(png.json.contentType, "image/png");

const webpForm = multipart([{ name: "file", filename: "shot.webp", type: "image/webp", data: WEBP }]);
const webp = await call({
  token: signToken(validPayload()),
  body: webpForm.body,
  contentType: webpForm.contentType,
  developmentProof: true,
  uploadFile: acceptingUpload("image/webp"),
});
assert.equal(webp.status, 200);
assert.equal(webp.json.contentType, "image/webp");

const wrongMethod = await call({ method: "GET", token: signToken(validPayload()), developmentProof: true });
assert.equal(wrongMethod.status, 405);

let retiredStatus = 0;
let retiredBody = "";
await retiredAuth({}, {
  status(code: number) {
    retiredStatus = code;
    return this;
  },
  setHeader() {},
  end(value: string) {
    retiredBody = value;
  },
});
assert.equal(retiredStatus, 410);
assert.equal(retiredBody.includes("signature"), false);
assert.equal(retiredBody.includes(privateApiKey), false);

const seen: number[] = [];
const uploaded = await uploadOptimizedFileToImageKit({
  file: new File([JPEG], "small.jpg", { type: "image/jpeg" }),
  idToken: "id-token",
  onProgress: (percent) => seen.push(percent),
  post: async (_file, init) => {
    assert.equal(init.idToken, "id-token");
    init.onProgress?.(40);
    init.onProgress?.(100);
    return {
      status: 200,
      json: {
        url: "https://ik.imagekit.io/example/custom-portfolio/user123/proof/small.jpg",
        fileId: "file_123",
        filePath: "/custom-portfolio/user123/proof/small.jpg",
      },
    };
  },
});
assert.deepEqual(seen, [40, 100]);
assert.equal(uploaded.fileId, "file_123");

const controller = new AbortController();
controller.abort();
await assert.rejects(
  () => uploadOptimizedFileToImageKit({
    file: new File([JPEG], "small.jpg", { type: "image/jpeg" }),
    idToken: "id-token",
    signal: controller.signal,
    post: async () => {
      throw new Error("should not upload");
    },
  }),
  ImageUploadCancelled,
);

await assert.rejects(
  () => uploadOptimizedFileToImageKit({
    file: new File([JPEG], "small.jpg", { type: "image/jpeg" }),
    idToken: "id-token",
    post: async () => ({ status: 200, json: { url: "", fileId: "file_123" } }),
  }),
  (error: unknown) => error instanceof ImageKitTransferError && error.message === IMAGEKIT_UPLOAD_FAILED,
);

await assert.rejects(
  () => uploadOptimizedFileToImageKit({
    file: new File([JPEG], "small.jpg", { type: "image/jpeg" }),
    idToken: "id-token",
    post: async () => ({
      status: 200,
      json: { url: "https://ik.imagekit.io/example/a.jpg", fileId: "file_123", privateKey: "nope" },
    }),
  }),
  (error: unknown) => error instanceof ImageKitTransferError && error.message === IMAGEKIT_UPLOAD_FAILED,
);

const gif = Buffer.from("GIF89a");
const proof = await proveImageKitUpload({
  file: new File([gif], "anim.gif", { type: "image/gif" }),
  idToken: "id-token",
  loadUploadedImage: async (url) => {
    assert.equal(url, "https://ik.imagekit.io/example/custom-portfolio/user123/proof/anim.gif");
  },
  post: async () => {
    return {
      status: 200,
      json: {
        url: "https://ik.imagekit.io/example/custom-portfolio/user123/proof/anim.gif",
        fileId: "gif_1",
        filePath: "/custom-portfolio/user123/proof/anim.gif",
      },
    };
  },
});
assert.equal(proof.optimizedBytes, gif.length);
assert.equal(proof.fileId, "gif_1");

console.log("imagekit auth checks passed");
