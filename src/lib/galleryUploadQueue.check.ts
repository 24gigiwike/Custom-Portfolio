import assert from "node:assert/strict";
import {
  claimOptimizingItems,
  finishGalleryRun,
  idleGalleryQueue,
  requestGalleryRun,
} from "./galleryUploadQueue";

let state = idleGalleryQueue();
const started = requestGalleryRun(state);
assert.equal(started.start, true);
assert.equal(started.state.active, true);
state = started.state;

const whileActive = requestGalleryRun(state);
assert.equal(whileActive.start, false);
assert.equal(whileActive.state.rerun, true);
assert.equal(whileActive.state.active, true);
state = whileActive.state;

const again = requestGalleryRun(state);
assert.equal(again.start, false);
assert.equal(again.state.rerun, true);

const resumed = finishGalleryRun(state);
assert.equal(resumed.start, true);
assert.equal(resumed.state.active, true);
assert.equal(resumed.state.rerun, false);
state = resumed.state;

const finished = finishGalleryRun(state);
assert.equal(finished.start, false);
assert.equal(finished.state.active, false);
assert.equal(finished.state.rerun, false);

const items = [
  { id: "done", status: "complete" },
  { id: "busy", status: "optimizing" },
  { id: "waiting", status: "optimizing" },
  { id: "failed", status: "error" },
];
assert.deepEqual(
  claimOptimizingItems(items, new Set(["busy"])).map((item) => item.id),
  ["waiting"],
);
assert.equal(claimOptimizingItems(items, new Set(["busy", "waiting"])).length, 0);

console.log("gallery upload queue checks passed");
