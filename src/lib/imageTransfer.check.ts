import assert from "node:assert/strict";
import {
  createStallWatch,
  DOWNLOAD_URL_FAILED,
  messageForStorageFailure,
  STALL_BEFORE_FIRST_BYTE,
  STALL_DURING_TRANSFER,
  storageCodeOf,
  UPLOAD_RETRY_LIMIT,
  UPLOAD_STALL_MS,
  UPLOAD_UNAUTHORIZED,
  AUTH_EXPIRED,
} from "./imageTransfer";

assert.equal(UPLOAD_STALL_MS, 45_000);
assert.equal(messageForStorageFailure("unauthorized", "upload"), UPLOAD_UNAUTHORIZED);
assert.equal(messageForStorageFailure("unauthenticated", "upload"), AUTH_EXPIRED);
assert.equal(messageForStorageFailure("retry-limit-exceeded", "upload"), UPLOAD_RETRY_LIMIT);
assert.equal(messageForStorageFailure("unauthorized", "download-url"), DOWNLOAD_URL_FAILED);
assert.equal(messageForStorageFailure("object-not-found", "download-url"), DOWNLOAD_URL_FAILED);
assert.equal(messageForStorageFailure("", "auth"), AUTH_EXPIRED);
assert.notEqual(DOWNLOAD_URL_FAILED, messageForStorageFailure("", "upload"));
assert.equal(storageCodeOf({ code: "storage/retry-limit-exceeded" }), "retry-limit-exceeded");

const before = await new Promise<string>((resolve) => {
  createStallWatch((kind) => resolve(kind), 30);
});
assert.equal(before, "before-first-byte");

const during = await new Promise<string>((resolve) => {
  const watch = createStallWatch((kind) => resolve(kind), 40);
  setTimeout(() => watch.noteBytes(0), 10);
  setTimeout(() => watch.noteBytes(128), 15);
  setTimeout(() => watch.noteBytes(128), 25);
});
assert.equal(during, "mid-transfer");

const stopped = await new Promise<string>((resolve) => {
  const watch = createStallWatch((kind) => resolve(kind), 30);
  watch.noteBytes(10);
  watch.stop();
  setTimeout(() => resolve("quiet"), 50);
});
assert.equal(stopped, "quiet");
assert.equal(STALL_BEFORE_FIRST_BYTE.includes("Retry"), true);
assert.equal(STALL_DURING_TRANSFER, "Upload stalled — Retry.");

console.log("image transfer checks passed");
