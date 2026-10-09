/**
 * Development timing for the shared image pipeline.
 * Ordinary production sessions stay quiet unless VITE_IMAGE_UPLOAD_DEBUG=1.
 * Never log tokens, download URLs, file names, image bytes, or contact details.
 */

type TraceValue = string | number | boolean | null;

function debugEnv(): { DEV?: boolean; VITE_IMAGE_UPLOAD_DEBUG?: string } | undefined {
  return (import.meta as { env?: { DEV?: boolean; VITE_IMAGE_UPLOAD_DEBUG?: string } }).env;
}

export function imageUploadDebugEnabled(): boolean {
  const env = debugEnv();
  const flag = env?.VITE_IMAGE_UPLOAD_DEBUG;
  if (flag === "0" || flag === "false") return false;
  if (flag === "1" || flag === "true") return true;
  return Boolean(env?.DEV);
}

export function traceImageUpload(event: string, details: Record<string, TraceValue> = {}): void {
  if (!imageUploadDebugEnabled()) return;
  console.info("[image-upload]", event, details);
}

export function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
