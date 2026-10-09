import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const browser = readFileSync(join(root, "imageOptimizerBrowser.ts"), "utf8");
const dispatcher = readFileSync(join(root, "imageOptimizer.ts"), "utf8");
const legacy = readFileSync(join(root, "imageOptimizerLegacy.ts"), "utf8");
const vite = readFileSync(join(root, "../../vite.config.ts"), "utf8");

assert.match(browser, /useWebWorker: worker/);
assert.match(browser, /libURL: imageCompressionWorkerUrl\(\)/);
assert.match(browser, /initialQuality: limits\.quality/);
assert.match(browser, /maxIteration: COMPRESSION_MAX_ITERATIONS/);
assert.match(browser, /alwaysKeepResolution: true/);
assert.match(browser, /preserveExif: false/);
assert.match(browser, /signal: options\.signal/);
assert.equal(browser.includes("jsdelivr"), false);
assert.equal(browser.includes("imageOptimizerLegacy"), false);
assert.match(browser, /IMAGE_COMPRESSION_WORKER_PATH = "\/browser-image-compression.js"/);
assert.match(browser, /typeof OffscreenCanvas === "function"/);

assert.match(dispatcher, /import\("\.\/imageOptimizerBrowser"\)/);
assert.match(dispatcher, /import\("\.\/imageOptimizerLegacy"\)/);
assert.match(dispatcher, /image\/gif/);
assert.match(dispatcher, /backend === "legacy"/);
assert.equal(dispatcher.includes("jsdelivr"), false);
assert.equal(legacy.includes("browser-image-compression"), false);
assert.match(legacy, /settleCompressedOutput/);

assert.match(vite, /browser-image-compression\/dist\/browser-image-compression\.js/);
assert.match(vite, /fileName: IMAGE_WORKER_FILE/);
assert.equal(vite.includes("jsdelivr"), false);

const worker = readFileSync(join(root, "../../node_modules/browser-image-compression/dist/browser-image-compression.js"), "utf8");
assert.equal(worker.includes("importScripts"), true);

console.log("image compression checks passed");
