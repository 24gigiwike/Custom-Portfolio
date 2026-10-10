/**
 * Server-only ImageKit settings and the folder chosen for a verified user.
 * The V1 browser-upload signature is not issued here. It signed only token + expire,
 * so a client could change the folder, file type, size, and overwrite flag.
 * Uploads go through src/server/imageKitServerUpload.ts, which sends the file itself.
 */

const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function imageKitFolderForUser(uid: string): string {
  if (!UID_PATTERN.test(uid)) {
    throw new Error("This account cannot use image upload yet.");
  }
  return `/custom-portfolio/${uid}/proof`;
}

export function readImageKitServerConfig(env: NodeJS.ProcessEnv = process.env): {
  privateKey: string;
  publicKey: string;
  urlEndpoint: string;
} | null {
  const privateKey = env.IMAGEKIT_PRIVATE_KEY?.trim() ?? "";
  const publicKey = env.IMAGEKIT_PUBLIC_KEY?.trim() ?? "";
  const urlEndpoint = env.IMAGEKIT_URL_ENDPOINT?.trim().replace(/\/+$/, "") ?? "";
  if (!privateKey || !publicKey || !urlEndpoint) return null;
  if (privateKey.length > 500 || publicKey.length > 200) return null;
  try {
    const url = new URL(urlEndpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
  } catch {
    return null;
  }
  return { privateKey, publicKey, urlEndpoint };
}
