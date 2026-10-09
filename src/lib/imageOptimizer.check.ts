import assert from "node:assert/strict";
import {
  canUploadOriginal,
  encodedMimeType,
  fittedLongSide,
  GIF_MAX_BYTES,
  GIF_TOO_LARGE_MESSAGE,
  imageHasTransparency,
  IMAGE_PREPARATION_FAILED_MESSAGE,
  IMAGE_PROFILES,
  originalAllowedAfterOptimizationFailure,
  planImageFile,
  bytesToMaxSizeMB,
  COMPRESSION_MAX_ITERATIONS,
  imageCompressionBackend,
  outputMimeForUpload,
  settleCompressedOutput,
  shouldKeepOriginal,
  ImagePreparationError,
} from "./imageOptimizer";

assert.deepEqual(fittedLongSide(4000, 3000), { width: 2048, height: 1536, resized: true });
assert.deepEqual(fittedLongSide(800, 600), { width: 800, height: 600, resized: false });
assert.equal(fittedLongSide(1000, 3000).height, 2048);
assert.equal(fittedLongSide(1000, 3000).resized, true);

assert.equal(
  canUploadOriginal({ type: "image/jpeg", size: 120 * 1024, width: 1600, height: 1200 }),
  true
);
assert.equal(
  canUploadOriginal({ type: "image/jpeg", size: 8 * 1024 * 1024, width: 4000, height: 3000 }),
  false
);
assert.equal(
  canUploadOriginal({ type: "image/png", size: 40 * 1024, width: 900, height: 900 }),
  true
);
assert.equal(canUploadOriginal({ type: "image/gif", size: 40 * 1024, width: 900, height: 900 }), false);

assert.equal(IMAGE_PROFILES.portrait.maxLongSide, 2048);
assert.equal(IMAGE_PROFILES.logo.maxLongSide, 800);
assert.equal(IMAGE_PROFILES.social.maxLongSide, 1600);
assert.equal(IMAGE_PROFILES.project.maxLongSide, 2048);
assert.equal(IMAGE_PROFILES.account.maxLongSide, 1024);
assert.equal(IMAGE_PROFILES.account.quality, 0.85);
assert.equal(IMAGE_PROFILES.portrait.maxBytes, 800 * 1024);
assert.equal(IMAGE_PROFILES.logo.maxBytes, 350 * 1024);
assert.equal(IMAGE_PROFILES.social.maxBytes, 600 * 1024);
assert.equal(IMAGE_PROFILES.project.maxBytes, 800 * 1024);
assert.equal(IMAGE_PROFILES.account.maxBytes, 350 * 1024);
assert.equal(COMPRESSION_MAX_ITERATIONS, 6);
assert.equal(imageCompressionBackend(), "browser");
assert.equal(Math.round(bytesToMaxSizeMB(800 * 1024) * 1000) / 1000, Math.round((800 / 1024) * 1000) / 1000);
assert.deepEqual(fittedLongSide(4000, 3000, IMAGE_PROFILES.portrait.maxLongSide), { width: 2048, height: 1536, resized: true });
assert.deepEqual(fittedLongSide(4000, 3000, IMAGE_PROFILES.logo.maxLongSide), { width: 800, height: 600, resized: true });
assert.deepEqual(fittedLongSide(2400, 1260, IMAGE_PROFILES.social.maxLongSide), { width: 1600, height: 840, resized: true });
assert.deepEqual(fittedLongSide(500, 200, IMAGE_PROFILES.logo.maxLongSide), { width: 500, height: 200, resized: false });
assert.equal(
  canUploadOriginal({ type: "image/png", size: 200 * 1024, width: 700, height: 400, profile: "logo" }),
  true,
);
assert.equal(
  canUploadOriginal({ type: "image/png", size: 200 * 1024, width: 2000, height: 800, profile: "logo" }),
  false,
);
assert.equal(
  canUploadOriginal({ type: "image/jpeg", size: 400 * 1024, width: 1400, height: 800, profile: "social" }),
  true,
);
assert.equal(
  canUploadOriginal({ type: "image/jpeg", size: 400 * 1024, width: 2400, height: 1260, profile: "social" }),
  false,
);

const smallGif = planImageFile({ type: "image/gif", size: GIF_MAX_BYTES, width: 800, height: 600, profile: "portrait" });
assert.deepEqual(smallGif, { action: "passthrough", reason: "gif" });
const largeGif = planImageFile({ type: "image/gif", size: GIF_MAX_BYTES + 1, width: 800, height: 600, profile: "portrait" });
assert.deepEqual(largeGif, { action: "reject", message: GIF_TOO_LARGE_MESSAGE });
assert.equal(
  planImageFile({ type: "image/svg+xml", size: 20 * 1024, width: 800, height: 600 }).action,
  "reject",
);
const oversized = planImageFile({ type: "image/jpeg", size: 31 * 1024 * 1024, width: 1000, height: 1000 });
assert.equal(oversized.action, "reject");
if (oversized.action === "reject") assert.equal(oversized.message, IMAGE_PREPARATION_FAILED_MESSAGE);

assert.equal(
  originalAllowedAfterOptimizationFailure({ type: "image/jpeg", size: 1.5 * 1024 * 1024, width: 1600, height: 1200, profile: "portrait" }),
  true,
);
assert.equal(
  originalAllowedAfterOptimizationFailure({ type: "image/jpeg", size: 1.5 * 1024 * 1024, width: 4000, height: 3000, profile: "portrait" }),
  false,
);
assert.equal(
  originalAllowedAfterOptimizationFailure({ type: "image/jpeg", size: 3 * 1024 * 1024, width: 1600, height: 1200, profile: "portrait" }),
  false,
);
assert.equal(
  originalAllowedAfterOptimizationFailure({ type: "image/gif", size: GIF_MAX_BYTES + 1, width: 400, height: 300, profile: "project" }),
  false,
);
assert.equal(
  originalAllowedAfterOptimizationFailure({ type: "image/png", size: 900 * 1024, width: 2000, height: 800, profile: "logo" }),
  false,
);

assert.equal(
  shouldKeepOriginal({ originalSize: 180 * 1024, optimizedSize: 220 * 1024, width: 1400, height: 900, profile: "portrait" }),
  true,
);
assert.equal(
  shouldKeepOriginal({ originalSize: 180 * 1024, optimizedSize: 90 * 1024, width: 1400, height: 900, profile: "portrait" }),
  false,
);
assert.equal(
  shouldKeepOriginal({ originalSize: 180 * 1024, optimizedSize: 220 * 1024, width: 4000, height: 3000, profile: "portrait" }),
  false,
);

assert.equal(encodedMimeType({ hasAlpha: true, supportsWebP: true }), "image/webp");
assert.equal(encodedMimeType({ hasAlpha: true, supportsWebP: false }), "image/png");
assert.equal(encodedMimeType({ hasAlpha: false, supportsWebP: false }), "image/jpeg");
assert.equal(imageHasTransparency(new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 254])), true);
assert.equal(imageHasTransparency(new Uint8ClampedArray([255, 0, 0, 255])), false);
assert.equal(outputMimeForUpload("image/png", true), "image/webp");
assert.equal(outputMimeForUpload("image/png", false), "image/png");
assert.equal(outputMimeForUpload("image/jpeg", false), "image/jpeg");
assert.equal(outputMimeForUpload("image/webp", false), "image/png");

function fileOf(bytes: number, type = "image/jpeg"): File {
  return new File([new Uint8Array(bytes)], "photo.jpg", { type });
}

const underTarget = settleCompressedOutput({
  original: fileOf(900 * 1024),
  compressed: fileOf(400 * 1024, "image/webp"),
  width: 1600,
  height: 1200,
  sourceWidth: 4000,
  sourceHeight: 3000,
  profile: "portrait",
});
assert.equal(underTarget.wasOptimized, true);
assert.equal(underTarget.optimizedSize, 400 * 1024);

const missedTarget = settleCompressedOutput({
  original: fileOf(4 * 1024 * 1024),
  compressed: fileOf(900 * 1024, "image/webp"),
  width: 2048,
  height: 1536,
  sourceWidth: 4000,
  sourceHeight: 3000,
  profile: "portrait",
});
assert.equal(missedTarget.wasOptimized, true);
assert.equal(missedTarget.optimizedSize > IMAGE_PROFILES.portrait.maxBytes, true);
assert.equal(missedTarget.optimizedSize <= IMAGE_PROFILES.portrait.safeOriginalMaxBytes, true);

const safeOriginal = fileOf(180 * 1024);
const keptOriginal = settleCompressedOutput({
  original: safeOriginal,
  compressed: fileOf(220 * 1024, "image/webp"),
  width: 1400,
  height: 900,
  sourceWidth: 1400,
  sourceHeight: 900,
  profile: "portrait",
});
assert.equal(keptOriginal.wasOptimized, false);
assert.equal(keptOriginal.file, safeOriginal);
assert.equal(keptOriginal.optimizedSize, 180 * 1024);

assert.throws(
  () => settleCompressedOutput({
    original: fileOf(8 * 1024 * 1024),
    compressed: fileOf(3 * 1024 * 1024, "image/webp"),
    width: 2048,
    height: 1536,
    sourceWidth: 4000,
    sourceHeight: 3000,
    profile: "portrait",
  }),
  (error: unknown) => error instanceof ImagePreparationError,
);

const smallAccount = planImageFile({ type: "image/jpeg", size: 200 * 1024, width: 800, height: 800, profile: "account" });
assert.deepEqual(smallAccount, { action: "passthrough", reason: "already-efficient" });
const gifStillSkipped = planImageFile({ type: "image/gif", size: 100 * 1024, width: 400, height: 400, profile: "account" });
assert.deepEqual(gifStillSkipped, { action: "passthrough", reason: "gif" });

console.log("image optimizer checks passed");
