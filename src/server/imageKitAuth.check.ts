import assert from "node:assert/strict";
import { createHmac, createSign, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { ImageUploadCancelled } from "../lib/imageAttempt";
import {
  IMAGEKIT_UPLOAD_FAILED,
  ImageKitTransferError,
  requestImageKitUploadAuthorization,
  uploadOptimizedFileToImageKit,
  type ImageKitUploadAuthorization,
} from "../lib/imageKitStorage";
import { activeImageStorageProvider, configuredImageStorageProvider } from "../lib/imageStorageProvider";
import { proveImageKitUpload } from "../dev/imageKitUploadProof";
import { verifyFirebaseIdToken } from "./firebaseIdToken";
import {
  handleImageKitAuth,
  IMAGEKIT_SIGNATURE_TTL_SECONDS,
  imageKitFolderForUser,
  resetImageKitAuthLimits,
  type ImageKitAuthResponse,
} from "./imageKitUploadAuth";

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

function call(input: { method?: string; token?: string | null; body?: unknown; contentType?: string }) {
  let status = 0;
  let body = "";
  const headers: Record<string, string> = {};
  const res: ImageKitAuthResponse = {
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
  const requestHeaders: Record<string, string> = {};
  if (input.contentType !== "") requestHeaders["content-type"] = input.contentType ?? "application/json";
  if (input.token) requestHeaders.authorization = `Bearer ${input.token}`;
  return handleImageKitAuth(
    { method: input.method ?? "POST", headers: requestHeaders, body: input.body ?? { purpose: "poc" } },
    res,
    {
      now: () => nowMs,
      token: "upload-token-1",
      verify,
      env: {
        IMAGEKIT_PRIVATE_KEY: privateApiKey,
        IMAGEKIT_PUBLIC_KEY: "public_test_key",
        IMAGEKIT_URL_ENDPOINT: "https://ik.imagekit.io/example/",
      },
    },
  ).then(() => ({ status, body, headers, json: body ? JSON.parse(body) as Record<string, unknown> : {} }));
}

const authSource = read("src/server/imageKitUploadAuth.ts");
assert.match(authSource, /file bytes or MIME type/);
assert.match(authSource, /fileName/);
assert.match(authSource, /folder/);
assert.match(authSource, /checks/);
assert.match(authSource, /getAuthenticationParameters\(uploadToken, expire\)/);
assert.equal(authSource.includes("VITE_"), false);

const clientSource = read("src/lib/imageKitStorage.ts");
assert.equal(clientSource.includes("IMAGEKIT_PRIVATE_KEY"), false);
assert.equal(clientSource.includes("imageOptimizer"), false);
assert.equal(clientSource.includes("browser-image-compression"), false);
assert.match(clientSource, /onProgress/);
assert.match(clientSource, /abortSignal/);
assert.match(clientSource, /fileId/);

const proofSource = read("src/dev/imageKitUploadProof.ts");
assert.match(proofSource, /optimizeImageForUpload/);
assert.match(proofSource, /requestImageKitUploadAuthorization/);
assert.match(proofSource, /uploadOptimizedFileToImageKit/);
assert.match(proofSource, /new Image\(\)/);
const optimizeAt = proofSource.indexOf("optimizeImageForUpload");
const authorizeAt = proofSource.indexOf("requestImageKitUploadAuthorization");
assert.ok(optimizeAt > 0 && optimizeAt < authorizeAt);

assert.equal(read("src/App.tsx").includes("imagekit-proof"), false);
assert.equal(read("src/App.tsx").includes("imageKit"), false);
assert.equal(read("src/lib/storage.ts").toLowerCase().includes("imagekit"), false);
assert.match(read("src/lib/storage.ts"), /uploadBytesResumable/);
assert.match(read("vercel.json"), /api\/imagekit-auth\.ts/);
assert.match(read("src/server/imageKitDevPlugin.ts"), /apply: "serve"/);
assert.equal(activeImageStorageProvider(), "firebase");
assert.equal(configuredImageStorageProvider(), "firebase");

resetImageKitAuthLimits();
const missing = await call({ token: null });
assert.equal(missing.status, 401);
assert.equal(missing.json.error, "Sign in to upload an image.");
assert.equal(JSON.stringify(missing.json).includes(privateApiKey), false);

resetImageKitAuthLimits();
const wrongMethod = await call({ method: "GET", token: signToken(validPayload()) });
assert.equal(wrongMethod.status, 405);

resetImageKitAuthLimits();
const wrongPurpose = await call({ token: signToken(validPayload()), body: { purpose: "portrait" } });
assert.equal(wrongPurpose.status, 400);

resetImageKitAuthLimits();
const expired = await call({
  token: signToken({ ...validPayload(), exp: Math.floor(nowMs / 1000) - 120 }),
});
assert.equal(expired.status, 401);
assert.match(String(expired.json.error), /session expired/i);

resetImageKitAuthLimits();
const wrongAudience = await call({ token: signToken({ ...validPayload(), aud: "other-project" }) });
assert.equal(wrongAudience.status, 401);

resetImageKitAuthLimits();
const noneAlg = await call({
  token: signToken(validPayload(), { alg: "none", kid: "test-key" }),
});
assert.equal(noneAlg.status, 401);

resetImageKitAuthLimits();
const issued = await call({ token: signToken(validPayload()) });
assert.equal(issued.status, 200);
assert.equal(issued.headers["cache-control"], "no-store");
assert.equal(issued.json.token, "upload-token-1");
assert.equal(issued.json.expire, Math.floor(nowMs / 1000) + IMAGEKIT_SIGNATURE_TTL_SECONDS);
assert.equal(issued.json.publicKey, "public_test_key");
assert.equal(issued.json.urlEndpoint, "https://ik.imagekit.io/example");
assert.equal(issued.json.folder, imageKitFolderForUser("user123"));
assert.equal(issued.json.purpose, "poc");
assert.equal(issued.json.signature, createHmac("sha1", privateApiKey).update(`${issued.json.token}${issued.json.expire}`).digest("hex"));
assert.equal("privateKey" in issued.json, false);
assert.equal(JSON.stringify(issued.json).includes(privateApiKey), false);
assert.equal(JSON.stringify(issued.json).includes("IMAGEKIT_PRIVATE_KEY"), false);

resetImageKitAuthLimits();
const unconfigured = await handleUnconfigured();
assert.equal(unconfigured.status, 503);
assert.equal(JSON.stringify(unconfigured.json).includes(privateApiKey), false);

resetImageKitAuthLimits();
for (let attempt = 0; attempt < 12; attempt += 1) {
  const allowed = await call({ token: signToken(validPayload("rateuser")) });
  assert.equal(allowed.status, 200);
}
const limited = await call({ token: signToken(validPayload("rateuser")) });
assert.equal(limited.status, 429);

resetImageKitAuthLimits();
for (let attempt = 0; attempt < 20; attempt += 1) {
  const denied = await call({ token: null });
  assert.equal(denied.status, 401);
}
const flooded = await call({ token: null });
assert.equal(flooded.status, 429);

const authorization: ImageKitUploadAuthorization = {
  token: "upload-token-1",
  expire: Math.floor(nowMs / 1000) + IMAGEKIT_SIGNATURE_TTL_SECONDS,
  signature: "signed",
  publicKey: "public_test_key",
  urlEndpoint: "https://ik.imagekit.io/example",
  folder: "/custom-portfolio/user123/poc",
  purpose: "poc",
};

const seen: number[] = [];
const uploaded = await uploadOptimizedFileToImageKit({
  file: new File([new Uint8Array(8)], "small.jpg", { type: "image/jpeg" }),
  authorization,
  onProgress: (percent) => seen.push(percent),
  upload: async (options) => {
    assert.equal(options.folder, authorization.folder);
    assert.equal(options.publicKey, authorization.publicKey);
    assert.equal("privateKey" in options, false);
    options.onProgress?.({ loaded: 2, total: 8 });
    options.onProgress?.({ loaded: 8, total: 8 });
    return { url: "https://ik.imagekit.io/example/small.jpg", fileId: "file_123", filePath: authorization.folder + "/small.jpg" };
  },
});
assert.deepEqual(seen, [25, 100]);
assert.equal(uploaded.url, "https://ik.imagekit.io/example/small.jpg");
assert.equal(uploaded.fileId, "file_123");

const controller = new AbortController();
controller.abort();
await assert.rejects(
  () => uploadOptimizedFileToImageKit({
    file: new File([new Uint8Array(4)], "small.jpg", { type: "image/jpeg" }),
    authorization,
    signal: controller.signal,
    upload: async () => {
      throw new Error("should not upload");
    },
  }),
  ImageUploadCancelled,
);

await assert.rejects(
  () => uploadOptimizedFileToImageKit({
    file: new File([new Uint8Array(4)], "small.jpg", { type: "image/jpeg" }),
    authorization,
    upload: async () => {
      const error = new Error("aborted");
      error.name = "ImageKitAbortError";
      throw error;
    },
  }),
  ImageUploadCancelled,
);

await assert.rejects(
  () => uploadOptimizedFileToImageKit({
    file: new File([new Uint8Array(4)], "small.jpg", { type: "image/jpeg" }),
    authorization,
    upload: async () => ({ url: "" }),
  }),
  (error: unknown) => error instanceof ImageKitTransferError && error.message === IMAGEKIT_UPLOAD_FAILED,
);

const fetched = await requestImageKitUploadAuthorization("id-token", {
  fetch: async (_url, init) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("authorization"), "Bearer id-token");
    assert.equal(headers.get("content-type"), "application/json");
    assert.equal(init?.body, JSON.stringify({ purpose: "poc" }));
    return new Response(JSON.stringify(authorization), { status: 200 });
  },
});
assert.equal(fetched.folder, authorization.folder);

const proof = await proveImageKitUpload({
  file: new File([new Uint8Array(32)], "anim.gif", { type: "image/gif" }),
  idToken: "id-token",
  authorize: async () => authorization,
  loadUploadedImage: async (url) => {
    assert.equal(url, "https://ik.imagekit.io/example/anim.gif");
  },
  upload: async (options) => {
    options.onProgress?.({ loaded: 4, total: 10 });
    return { url: "https://ik.imagekit.io/example/anim.gif", fileId: "gif_1", filePath: "/custom-portfolio/user123/poc/anim.gif" };
  },
});
assert.equal(proof.optimizedBytes, 32);
assert.deepEqual(proof.progress, [40]);
assert.equal(proof.fileId, "gif_1");

if (!process.env.IMAGEKIT_PRIVATE_KEY || !process.env.IMAGEKIT_PUBLIC_KEY || !process.env.IMAGEKIT_URL_ENDPOINT) {
  console.log("live ImageKit upload skipped: server credentials are not configured");
} else if (!process.env.FIREBASE_PROOF_ID_TOKEN) {
  console.log("live ImageKit upload skipped: FIREBASE_PROOF_ID_TOKEN is not configured");
} else {
  console.log("live ImageKit upload credentials are present; run the development proof page while signed in");
}

async function handleUnconfigured() {
  let status = 0;
  let body = "";
  const res: ImageKitAuthResponse = {
    status(code: number) {
      status = code;
      return res;
    },
    setHeader() {},
    end(value: string) {
      body = value;
    },
  };
  await handleImageKitAuth(
    {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${signToken(validPayload("noconfig"))}` },
      body: { purpose: "poc" },
    },
    res,
    { now: () => nowMs, verify, env: {} },
  );
  return { status, json: JSON.parse(body) as Record<string, unknown> };
}

console.log("imagekit auth checks passed");
