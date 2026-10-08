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
  shouldKeepOriginal,
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

console.log("image optimizer checks passed");
