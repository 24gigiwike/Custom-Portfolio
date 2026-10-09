/**
 * Legacy project gallery queue.
 * A batch that arrives while another batch is running is processed after it, not dropped.
 */

export type GalleryQueueState = {
  active: boolean;
  rerun: boolean;
};

export function idleGalleryQueue(): GalleryQueueState {
  return { active: false, rerun: false };
}

export function requestGalleryRun(state: GalleryQueueState): { state: GalleryQueueState; start: boolean } {
  if (state.active) return { state: { active: true, rerun: true }, start: false };
  return { state: { active: true, rerun: false }, start: true };
}

/**
 * When a batch finishes, `start` means another batch is already waiting.
 * The caller keeps `active` and must process that batch without requesting the queue again.
 */
export function finishGalleryRun(state: GalleryQueueState): { state: GalleryQueueState; start: boolean } {
  if (state.rerun) return { state: { active: true, rerun: false }, start: true };
  return { state: { active: false, rerun: false }, start: false };
}

export function claimOptimizingItems<T extends { id: string; status: string }>(
  items: readonly T[],
  inFlight: ReadonlySet<string>,
): T[] {
  return items.filter((item) => item.status === "optimizing" && !inFlight.has(item.id));
}
