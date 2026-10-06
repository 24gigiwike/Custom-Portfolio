import assert from "node:assert/strict";
import { canUploadOriginal, fittedLongSide } from "./imageOptimizer";

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

console.log("image optimizer checks passed");
