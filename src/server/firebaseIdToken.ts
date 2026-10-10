import { createVerify } from "node:crypto";

const FIREBASE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

export const DEFAULT_FIREBASE_PROJECT_ID = "custom-portfolio-2026";

const TOKEN_MAX_CHARS = 8192;
const CLOCK_SKEW_SECONDS = 60;

export class FirebaseIdTokenError extends Error {
  readonly name = "FirebaseIdTokenError";

  constructor(message = "Sign in to upload an image.") {
    super(message);
  }
}

export type VerifiedFirebaseUser = {
  uid: string;
};

type CertMap = Record<string, string>;

let certCache: { expiresAt: number; certs: CertMap } | null = null;

export function firebaseProjectId(): string {
  const fromEnv = process.env.FIREBASE_PROJECT_ID?.trim() || process.env.VITE_FIREBASE_PROJECT_ID?.trim();
  return fromEnv || DEFAULT_FIREBASE_PROJECT_ID;
}

function decodeBase64UrlJson(segment: string): unknown {
  const json = Buffer.from(segment, "base64url").toString("utf8");
  return JSON.parse(json);
}

function cacheLifetimeMs(cacheControl: string | null): number {
  const match = /max-age=(\d+)/.exec(cacheControl ?? "");
  if (!match) return 60 * 60 * 1000;
  return Number(match[1]) * 1000;
}

export async function loadFirebaseSecureTokenCerts(now = Date.now()): Promise<CertMap> {
  if (certCache && certCache.expiresAt > now) return certCache.certs;
  const response = await fetch(FIREBASE_CERTS_URL);
  if (!response.ok) throw new FirebaseIdTokenError();
  const certs = (await response.json()) as CertMap;
  certCache = { certs, expiresAt: now + cacheLifetimeMs(response.headers.get("cache-control")) };
  return certs;
}

function audienceMatches(aud: unknown, projectId: string): boolean {
  if (typeof aud === "string") return aud === projectId;
  return Array.isArray(aud) && aud.some((value) => value === projectId);
}

/**
 * Verify a Firebase ID token with Google's published certificates.
 * The web API key is not a signing secret and is not used here.
 */
export async function verifyFirebaseIdToken(
  token: string,
  projectId: string,
  options?: {
    now?: () => number;
    loadCerts?: () => Promise<CertMap>;
  },
): Promise<VerifiedFirebaseUser> {
  if (typeof token !== "string" || token.length === 0 || token.length > TOKEN_MAX_CHARS) {
    throw new FirebaseIdTokenError();
  }
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) throw new FirebaseIdTokenError();

  let header: { alg?: unknown; kid?: unknown };
  let payload: {
    aud?: unknown;
    iss?: unknown;
    sub?: unknown;
    user_id?: unknown;
    iat?: unknown;
    exp?: unknown;
    auth_time?: unknown;
  };
  try {
    header = decodeBase64UrlJson(parts[0]) as typeof header;
    payload = decodeBase64UrlJson(parts[1]) as typeof payload;
  } catch {
    throw new FirebaseIdTokenError();
  }

  if (header.alg !== "RS256" || typeof header.kid !== "string" || header.kid.length === 0) {
    throw new FirebaseIdTokenError();
  }

  const certs = await (options?.loadCerts ?? loadFirebaseSecureTokenCerts)();
  const certificate = certs[header.kid];
  if (!certificate) throw new FirebaseIdTokenError();

  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  const signature = Buffer.from(parts[2], "base64url");
  let valid = false;
  try {
    valid = verifier.verify(certificate, signature);
  } catch {
    valid = false;
  }
  if (!valid) throw new FirebaseIdTokenError();

  const nowSeconds = Math.floor((options?.now ?? Date.now)() / 1000);
  if (typeof payload.exp !== "number" || payload.exp + CLOCK_SKEW_SECONDS <= nowSeconds) {
    throw new FirebaseIdTokenError("Your session expired. Sign in again, then retry the upload.");
  }
  if (typeof payload.iat !== "number" || payload.iat > nowSeconds + CLOCK_SKEW_SECONDS) {
    throw new FirebaseIdTokenError();
  }
  if (typeof payload.auth_time !== "number") throw new FirebaseIdTokenError();
  if (!audienceMatches(payload.aud, projectId)) throw new FirebaseIdTokenError();
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new FirebaseIdTokenError();
  if (typeof payload.sub !== "string" || payload.sub.length === 0 || payload.sub.length > 128) {
    throw new FirebaseIdTokenError();
  }
  if (payload.user_id !== undefined && payload.user_id !== payload.sub) throw new FirebaseIdTokenError();

  return { uid: payload.sub };
}
