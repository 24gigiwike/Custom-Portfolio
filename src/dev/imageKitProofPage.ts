import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../lib/firebase";
import { optimizeImageForUpload } from "../lib/imageOptimizer";
import { proveImageKitUpload } from "./imageKitUploadProof";

if (!import.meta.env.DEV) {
  throw new Error("ImageKit upload proof is available only in development.");
}

const session = document.querySelector<HTMLElement>("#session");
const status = document.querySelector<HTMLElement>("#status");
const progress = document.querySelector<HTMLProgressElement>("#progress");
const preview = document.querySelector<HTMLImageElement>("#preview");
const cancelButton = document.querySelector<HTMLButtonElement>("#cancel");

let currentUser: User | null = null;
let active: AbortController | null = null;

function setStatus(message: string): void {
  if (status) status.textContent = message;
}

await Promise.race([
  new Promise<void>((resolve) => {
    let settled = false;
    onAuthStateChanged(auth, (user) => {
      currentUser = user;
      if (session) {
        session.textContent = user
          ? "Signed in. Choose a JPEG to upload through the server."
          : "Sign in on this site first, then reload this page.";
      }
      if (!settled) {
        settled = true;
        resolve();
      }
    });
  }),
  new Promise<void>((resolve) => {
    setTimeout(() => {
      if (session && session.textContent === "Checking your session…") {
        session.textContent = "Sign in on this site first, then reload this page.";
      }
      resolve();
    }, 3000);
  }),
]);

async function run(inputId: "small" | "large"): Promise<void> {
  const input = document.querySelector<HTMLInputElement>(`#${inputId}`);
  const file = input?.files?.[0];
  if (!currentUser) {
    setStatus("Sign in on this site first, then reload this page.");
    return;
  }
  if (!file) {
    setStatus("Choose a JPEG first.");
    return;
  }
  if (file.type !== "image/jpeg") {
    setStatus("Choose a JPEG.");
    return;
  }
  active?.abort();
  const controller = new AbortController();
  active = controller;
  if (cancelButton) cancelButton.disabled = false;
  if (progress) progress.value = 0;
  if (preview) preview.removeAttribute("src");
  setStatus(inputId === "small" ? "Preparing the small JPEG…" : "Preparing the larger photograph…");
  try {
    const token = await currentUser.getIdToken(false);
    const result = await proveImageKitUpload({
      file,
      idToken: token,
      signal: controller.signal,
      onPhase: (phase) => {
        setStatus(phase === "optimizing" ? "Compressing image…" : "Preparing image…");
      },
      onProgress: (percent) => {
        if (progress) progress.value = percent;
        setStatus(`Uploading image ${percent}%…`);
      },
    });
    if (preview) {
      preview.alt = inputId === "small" ? "Uploaded small JPEG" : "Uploaded larger photograph";
      preview.src = result.url;
    }
    const id = result.fileId ? ` File id ${result.fileId}.` : "";
    setStatus(`Loaded from ImageKit.${id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed. Try again.";
    setStatus(message);
  } finally {
    if (active === controller) active = null;
    if (cancelButton) cancelButton.disabled = true;
  }
}

async function canvasJpeg(width: number, height: number, quality: number, name: string): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the sample image.");
  context.fillStyle = "#6DAEAD";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#163331";
  context.fillRect(48, 48, Math.round(width / 3), Math.round(height / 3));
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Could not prepare the sample image.");
  return new File([blob], name, { type: "image/jpeg" });
}

if (new URLSearchParams(window.location.search).has("prepare")) {
  try {
    const small = await canvasJpeg(800, 600, 0.9, "small.jpg");
    const large = await canvasJpeg(2400, 1800, 0.92, "large.jpg");
    const smallOptimized = await optimizeImageForUpload(small, undefined, "project");
    const largeOptimized = await optimizeImageForUpload(large, undefined, "project");
    document.documentElement.dataset.prepared = JSON.stringify({
      small: { original: small.size, optimized: smallOptimized.optimizedSize, type: smallOptimized.file.type },
      large: { original: large.size, optimized: largeOptimized.optimizedSize, type: largeOptimized.file.type },
    });
    setStatus(`Prepared a ${small.size} byte JPEG and a ${large.size} byte JPEG through the shared optimizer.`);
  } catch (error) {
    document.documentElement.dataset.prepared = JSON.stringify({
      error: error instanceof Error ? error.message : "prepare failed",
    });
  }
}

document.querySelector("#run-small")?.addEventListener("click", () => {
  void run("small");
});
document.querySelector("#run-large")?.addEventListener("click", () => {
  void run("large");
});
cancelButton?.addEventListener("click", () => {
  active?.abort();
  setStatus("Upload cancelled.");
});
