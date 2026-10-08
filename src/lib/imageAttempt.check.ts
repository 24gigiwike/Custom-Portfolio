import assert from "node:assert/strict";
import {
  applyUploadStatus,
  beginImageAttempt,
  cancelImageAttempt,
  idleImageAttempt,
  IMAGE_UPLOADED_MESSAGE,
  imageAttemptSaved,
  imageChangeIsSaved,
  imagePhaseLabel,
  previewSource,
  releaseImageAttempt,
  remotePreviewReady,
  retryImageAttempt,
  takeUploadFailure,
  takeUploadResult,
} from "./imageAttempt";

const preparing = beginImageAttempt(idleImageAttempt(), "blob:first");
assert.equal(preparing.revokeUrl, null);
assert.equal(preparing.state.phase, "preparing");
assert.equal(preparing.state.localUrl, "blob:first");
assert.equal(previewSource(preparing.state.localUrl, "https://cdn.example.com/saved.jpg"), "blob:first");
assert.equal(imagePhaseLabel({ phase: "preparing", percent: null }), "Preparing image…");
assert.equal(imagePhaseLabel({ phase: "optimizing", percent: null }), "Preparing image…");

const uploading = applyUploadStatus(preparing.state, preparing.state.generation, { phase: "uploading", percent: 40 });
assert.equal(uploading.phase, "uploading");
assert.equal(uploading.percent, 40);
assert.equal(imagePhaseLabel({ phase: "uploading", percent: 40 }), "Uploading 40%…");
assert.equal(imagePhaseLabel({ phase: "uploading", percent: null }), "Uploading…");
assert.equal(imagePhaseLabel({ phase: "finalizing", percent: null }), "Finishing upload…");
assert.equal(applyUploadStatus(uploading, uploading.generation, { phase: "ready", percent: null }).phase, "uploading");
assert.equal(applyUploadStatus(uploading, 0, { phase: "finalizing", percent: null }), uploading);

const replaced = beginImageAttempt(uploading, "blob:second");
assert.equal(replaced.revokeUrl, "blob:first");
const stale = takeUploadResult(replaced.state, uploading.generation, "https://cdn.example.com/stale.jpg");
assert.equal(stale.applied, false);
assert.equal(stale.state.localUrl, "blob:second");
assert.equal(stale.state.remoteUrl, null);

const uploaded = takeUploadResult(replaced.state, replaced.state.generation, "https://cdn.example.com/new.jpg");
assert.equal(uploaded.applied, true);
assert.equal(uploaded.state.phase, "ready");
assert.equal(uploaded.state.localUrl, "blob:second");
assert.equal(uploaded.state.remoteUrl, "https://cdn.example.com/new.jpg");
assert.equal(imagePhaseLabel({ phase: "ready", percent: null }), IMAGE_UPLOADED_MESSAGE);
assert.equal(IMAGE_UPLOADED_MESSAGE, "Image uploaded. Save your portfolio to keep this change.");
assert.equal(imageChangeIsSaved(uploaded.state.remoteUrl ?? "", "https://cdn.example.com/saved.jpg"), false);
assert.equal(imageChangeIsSaved("https://cdn.example.com/saved.jpg", "https://cdn.example.com/saved.jpg"), true);

const remoteReady = remotePreviewReady(uploaded.state, uploaded.state.generation);
assert.equal(remoteReady.changed, true);
assert.equal(remoteReady.revokeUrl, "blob:second");
assert.equal(remoteReady.state.localUrl, null);
assert.equal(remoteReady.state.phase, "ready");
assert.equal(previewSource(remoteReady.state.localUrl, "https://cdn.example.com/saved.jpg"), "https://cdn.example.com/saved.jpg");

const unsaved = imageAttemptSaved(remoteReady.state, "https://cdn.example.com/saved.jpg");
assert.equal(unsaved.changed, false);
assert.equal(unsaved.state.phase, "ready");
const saved = imageAttemptSaved(remoteReady.state, "https://cdn.example.com/new.jpg");
assert.equal(saved.changed, true);
assert.equal(saved.state.phase, "idle");
assert.equal(saved.state.remoteUrl, null);
assert.equal(takeUploadResult(saved.state, uploaded.state.generation, "https://cdn.example.com/late.jpg").applied, false);

const failedStart = beginImageAttempt(saved.state, "blob:failed");
const failed = takeUploadFailure(failedStart.state, failedStart.state.generation, "Couldn't upload this portrait. Try again.");
assert.equal(failed.applied, true);
assert.equal(failed.state.phase, "error");
assert.equal(failed.state.remoteUrl, null);
assert.equal(failed.state.localUrl, "blob:failed");
assert.equal(failed.state.canRetry, true);
assert.equal(failed.state.error, "Couldn't upload this portrait. Try again.");
assert.equal(previewSource(failed.state.localUrl, "https://cdn.example.com/new.jpg"), "blob:failed");

const retried = retryImageAttempt(failed.state);
assert.equal(retried.phase, "preparing");
assert.equal(retried.localUrl, "blob:failed");
assert.equal(retried.generation, failed.state.generation + 1);
assert.equal(takeUploadFailure(retried, failed.state.generation, "old failure").applied, false);
assert.equal(retryImageAttempt(retried), retried);

const prepared = applyUploadStatus(retried, retried.generation, { phase: "optimizing", percent: null });
const cancelled = cancelImageAttempt(prepared, prepared.generation);
assert.equal(cancelled.changed, true);
assert.equal(cancelled.revokeUrl, "blob:failed");
assert.equal(cancelled.state.phase, "idle");
assert.equal(cancelled.state.localUrl, null);
assert.equal(previewSource(cancelled.state.localUrl, "https://cdn.example.com/new.jpg"), "https://cdn.example.com/new.jpg");
assert.equal(takeUploadResult(cancelled.state, prepared.generation, "https://cdn.example.com/after-cancel.jpg").applied, false);
assert.equal(cancelImageAttempt(cancelled.state, cancelled.state.generation).changed, false);

const previousDraft = "https://cdn.example.com/saved.jpg";
const selectionA = beginImageAttempt(idleImageAttempt(), "blob:a");
const selectionB = beginImageAttempt(selectionA.state, "blob:b");
assert.equal(selectionB.revokeUrl, "blob:a");
const cancelAWhileB = cancelImageAttempt(selectionB.state, selectionA.state.generation);
assert.equal(cancelAWhileB.changed, false);
assert.equal(cancelAWhileB.state.localUrl, "blob:b");
assert.equal(applyUploadStatus(selectionB.state, selectionA.state.generation, { phase: "uploading", percent: 90 }), selectionB.state);
assert.equal(takeUploadResult(selectionB.state, selectionA.state.generation, "https://cdn.example.com/a.jpg").applied, false);
assert.equal(previewSource(selectionB.state.localUrl, previousDraft), "blob:b");

const cancelB = cancelImageAttempt(selectionB.state, selectionB.state.generation);
assert.equal(cancelB.revokeUrl, "blob:b");
assert.equal(previewSource(cancelB.state.localUrl, previousDraft), previousDraft);
assert.equal(takeUploadFailure(cancelB.state, selectionB.state.generation, "Couldn't upload this portrait. Try again.").applied, false);

const replacement = beginImageAttempt(cancelB.state, "blob:replacement");
const replacementFailed = takeUploadFailure(
  replacement.state,
  replacement.state.generation,
  "This image couldn't be prepared. Please choose a smaller JPG, PNG, or WEBP.",
);
assert.equal(replacementFailed.state.remoteUrl, null);
assert.equal(replacementFailed.state.phase, "error");
assert.equal(imagePhaseLabel({ phase: "ready", percent: null }) === replacementFailed.state.error, false);
assert.equal(previewSource(replacementFailed.state.localUrl, previousDraft), "blob:replacement");
const retryReplacement = retryImageAttempt(replacementFailed.state);
assert.equal(retryReplacement.localUrl, "blob:replacement");
assert.equal(retryReplacement.generation, replacementFailed.state.generation + 1);

const uploadedBeforeRemote = takeUploadResult(retryReplacement, retryReplacement.generation, "https://cdn.example.com/uploaded.jpg");
assert.equal(uploadedBeforeRemote.applied, true);
assert.equal(previewSource(uploadedBeforeRemote.state.localUrl, "https://cdn.example.com/uploaded.jpg"), "blob:replacement");
assert.equal(imageChangeIsSaved("https://cdn.example.com/uploaded.jpg", previousDraft), false);
const savedBeforeRemote = imageAttemptSaved(uploadedBeforeRemote.state, "https://cdn.example.com/uploaded.jpg");
assert.equal(savedBeforeRemote.changed, true);
assert.equal(savedBeforeRemote.revokeUrl, null);
assert.equal(savedBeforeRemote.state.localUrl, "blob:replacement");
assert.equal(savedBeforeRemote.state.phase, "idle");
assert.equal(imagePhaseLabel(null), null);
assert.equal(previewSource(savedBeforeRemote.state.localUrl, "https://cdn.example.com/uploaded.jpg"), "blob:replacement");
assert.equal(remotePreviewReady(savedBeforeRemote.state, savedBeforeRemote.state.generation - 1).changed, false);
const remoteLoadedAfterSave = remotePreviewReady(savedBeforeRemote.state, savedBeforeRemote.state.generation);
assert.equal(remoteLoadedAfterSave.changed, true);
assert.equal(remoteLoadedAfterSave.revokeUrl, "blob:replacement");
assert.equal(remoteLoadedAfterSave.state.localUrl, null);
assert.equal(previewSource(remoteLoadedAfterSave.state.localUrl, "https://cdn.example.com/uploaded.jpg"), "https://cdn.example.com/uploaded.jpg");

const stillLocal = imageAttemptSaved(
  takeUploadResult(beginImageAttempt(idleImageAttempt(), "blob:held").state, 1, "https://cdn.example.com/held.jpg").state,
  "https://cdn.example.com/held.jpg",
);
assert.equal(stillLocal.state.localUrl, "blob:held");
assert.equal(previewSource(stillLocal.state.localUrl, "https://cdn.example.com/held.jpg"), "blob:held");
assert.equal(remotePreviewReady(stillLocal.state, stillLocal.state.generation).state.localUrl, null);

const released = releaseImageAttempt(uploadedBeforeRemote.state);
assert.equal(released.revokeUrl, "blob:replacement");
assert.equal(released.generation, uploadedBeforeRemote.state.generation + 1);
assert.equal(takeUploadResult(uploadedBeforeRemote.state, released.generation, "https://cdn.example.com/after-unmount.jpg").applied, false);

console.log("image attempt checks passed");
