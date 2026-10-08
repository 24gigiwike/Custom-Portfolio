export const IMAGE_UPLOADED_MESSAGE = "Image uploaded. Save your portfolio to keep this change.";

export type ImageUploadStatus = {
  phase: "preparing" | "optimizing" | "uploading" | "finalizing" | "ready";
  percent: number | null;
};

export class ImageUploadCancelled extends Error {
  readonly name = "ImageUploadCancelled";

  constructor() {
    super("Upload cancelled.");
  }
}

export type ImageAttemptState = {
  generation: number;
  phase: "idle" | "preparing" | "optimizing" | "uploading" | "finalizing" | "ready" | "error";
  localUrl: string | null;
  remoteUrl: string | null;
  percent: number | null;
  error: string | null;
  canRetry: boolean;
};

export function idleImageAttempt(): ImageAttemptState {
  return {
    generation: 0,
    phase: "idle",
    localUrl: null,
    remoteUrl: null,
    percent: null,
    error: null,
    canRetry: false,
  };
}

export function imagePhaseLabel(status: ImageUploadStatus | null): string | null {
  if (!status) return null;
  if (status.phase === "preparing" || status.phase === "optimizing") return "Preparing image…";
  if (status.phase === "uploading") {
    return status.percent === null ? "Uploading…" : `Uploading ${status.percent}%…`;
  }
  if (status.phase === "finalizing") return "Finishing upload…";
  if (status.phase === "ready") return IMAGE_UPLOADED_MESSAGE;
  return null;
}

export function imageChangeIsSaved(draftUrl: string, savedUrl: string): boolean {
  return draftUrl === savedUrl;
}

const BUSY_PHASES = new Set<ImageAttemptState["phase"]>(["preparing", "optimizing", "uploading", "finalizing"]);

export function imageAttemptIsBusy(state: ImageAttemptState): boolean {
  return BUSY_PHASES.has(state.phase);
}

function same(state: ImageAttemptState) {
  return { changed: false as const, state, revokeUrl: null as string | null };
}

export function beginImageAttempt(
  state: ImageAttemptState,
  localUrl: string,
): { state: ImageAttemptState; revokeUrl: string | null } {
  return {
    revokeUrl: state.localUrl,
    state: {
      generation: state.generation + 1,
      phase: "preparing",
      localUrl,
      remoteUrl: null,
      percent: null,
      error: null,
      canRetry: false,
    },
  };
}

export function applyUploadStatus(
  state: ImageAttemptState,
  generation: number,
  status: ImageUploadStatus,
): ImageAttemptState {
  if (state.generation !== generation || !imageAttemptIsBusy(state)) return state;
  if (status.phase === "ready") return state;
  return { ...state, phase: status.phase, percent: status.percent };
}

export function takeUploadResult(
  state: ImageAttemptState,
  generation: number,
  remoteUrl: string,
): { applied: boolean; state: ImageAttemptState } {
  if (state.generation !== generation || !imageAttemptIsBusy(state)) return { applied: false, state };
  return {
    applied: true,
    state: {
      ...state,
      phase: "ready",
      remoteUrl,
      percent: null,
      error: null,
      canRetry: false,
    },
  };
}

export function takeUploadFailure(
  state: ImageAttemptState,
  generation: number,
  message: string,
): { applied: boolean; state: ImageAttemptState } {
  if (state.generation !== generation || !imageAttemptIsBusy(state)) return { applied: false, state };
  return {
    applied: true,
    state: {
      ...state,
      phase: "error",
      remoteUrl: null,
      percent: null,
      error: message,
      canRetry: Boolean(state.localUrl),
    },
  };
}

export function retryImageAttempt(state: ImageAttemptState): ImageAttemptState {
  if (state.phase !== "error" || !state.canRetry || !state.localUrl) return state;
  return {
    ...state,
    generation: state.generation + 1,
    phase: "preparing",
    remoteUrl: null,
    percent: null,
    error: null,
    canRetry: false,
  };
}

export function cancelImageAttempt(
  state: ImageAttemptState,
  generation: number,
): { changed: boolean; state: ImageAttemptState; revokeUrl: string | null } {
  if (state.generation !== generation || state.phase === "idle") return same(state);
  return {
    changed: true,
    revokeUrl: state.localUrl,
    state: { ...idleImageAttempt(), generation: state.generation + 1 },
  };
}

export function remotePreviewReady(
  state: ImageAttemptState,
  generation: number,
): { changed: boolean; state: ImageAttemptState; revokeUrl: string | null } {
  if (state.generation !== generation || !state.localUrl || !state.remoteUrl) return same(state);
  if (state.phase === "ready") {
    return {
      changed: true,
      revokeUrl: state.localUrl,
      state: { ...state, localUrl: null },
    };
  }
  if (state.phase === "idle") {
    return {
      changed: true,
      revokeUrl: state.localUrl,
      state: { ...idleImageAttempt(), generation: state.generation },
    };
  }
  return same(state);
}

export function imageAttemptSaved(
  state: ImageAttemptState,
  savedUrl: string,
): { changed: boolean; state: ImageAttemptState; revokeUrl: string | null } {
  if (state.phase !== "ready" || !state.remoteUrl || state.remoteUrl !== savedUrl) return same(state);
  if (state.localUrl) {
    return {
      changed: true,
      revokeUrl: null,
      state: {
        ...state,
        phase: "idle",
        percent: null,
        error: null,
        canRetry: false,
      },
    };
  }
  return {
    changed: true,
    revokeUrl: null,
    state: { ...idleImageAttempt(), generation: state.generation },
  };
}

/** Drop an in-flight attempt on unmount. Callers must ignore the previous generation. */
export function releaseImageAttempt(state: ImageAttemptState): { generation: number; revokeUrl: string | null } {
  return { generation: state.generation + 1, revokeUrl: state.localUrl };
}

export function previewSource(localUrl: string | null, committedUrl: string): string {
  return localUrl || committedUrl;
}
