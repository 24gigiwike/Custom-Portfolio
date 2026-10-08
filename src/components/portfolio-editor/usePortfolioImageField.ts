import { useEffect, useRef, useState } from "react";
import { readableSaveError } from "../../lib/accountLoad";
import {
  applyUploadStatus,
  beginImageAttempt,
  cancelImageAttempt,
  idleImageAttempt,
  imageAttemptIsBusy,
  imageAttemptSaved,
  remotePreviewReady,
  retryImageAttempt,
  takeUploadFailure,
  takeUploadResult,
  type ImageAttemptState,
} from "../../lib/imageAttempt";
import { ImageUploadCancelled } from "../../lib/imageAttempt";
import { ImagePreparationError } from "../../lib/imageOptimizer";
import { beginPortfolioImageUpload, type ImageUploadStatus, type PortfolioImageFolder, type PortfolioImageUpload } from "../../lib/storage";

export type PortfolioImageField = {
  localUrl: string | null;
  status: ImageUploadStatus | null;
  error: string | null;
  busy: boolean;
  canRetry: boolean;
  canCancel: boolean;
  choose: (file: File) => void;
  retry: () => void;
  cancel: () => void;
};

function statusFromAttempt(state: ImageAttemptState): ImageUploadStatus | null {
  if (state.phase === "idle" || state.phase === "error") return null;
  return { phase: state.phase, percent: state.percent };
}

export function usePortfolioImageField({
  portfolioId,
  folder,
  savedUrl,
  onUploaded,
}: {
  portfolioId: string | null;
  folder: PortfolioImageFolder;
  savedUrl: string;
  onUploaded: (url: string) => void;
}): PortfolioImageField {
  const [attempt, setAttempt] = useState<ImageAttemptState>(idleImageAttempt);
  const attemptRef = useRef(attempt);
  const generationRef = useRef(0);
  const fileRef = useRef<File | null>(null);
  const sessionRef = useRef<PortfolioImageUpload | null>(null);
  const savedUrlRef = useRef(savedUrl);
  savedUrlRef.current = savedUrl;
  attemptRef.current = attempt;

  const commit = (next: ImageAttemptState) => {
    attemptRef.current = next;
    generationRef.current = next.generation;
    setAttempt(next);
  };

  const start = (file: File, generation: number) => {
    if (!portfolioId) {
      const failed = takeUploadFailure(attemptRef.current, generation, "Your portfolio needs to finish loading before an image can be added.");
      if (failed.applied) commit(failed.state);
      return;
    }
    sessionRef.current?.cancel();
    const session = beginPortfolioImageUpload(portfolioId, file, folder, (status) => {
      if (generationRef.current !== generation) return;
      const next = applyUploadStatus(attemptRef.current, generation, status);
      if (next !== attemptRef.current) commit(next);
    });
    sessionRef.current = session;
    void session.done.then(
      (uploaded) => {
        if (generationRef.current !== generation) return;
        const result = takeUploadResult(attemptRef.current, generation, uploaded.downloadUrl);
        if (!result.applied) return;
        commit(result.state);
        onUploaded(uploaded.downloadUrl);
      },
      (error: unknown) => {
        if (generationRef.current !== generation || error instanceof ImageUploadCancelled) return;
        const message =
          error instanceof ImagePreparationError
            ? error.message
            : readableSaveError(error, "Couldn't upload this image. Try again.");
        const failed = takeUploadFailure(attemptRef.current, generation, message);
        if (failed.applied) commit(failed.state);
      },
    );
  };

  useEffect(() => {
    const saved = imageAttemptSaved(attemptRef.current, savedUrl);
    if (!saved.changed) return;
    if (saved.revokeUrl) URL.revokeObjectURL(saved.revokeUrl);
    fileRef.current = null;
    commit(saved.state);
  }, [savedUrl]);

  useEffect(() => {
    if (attempt.phase !== "ready" || !attempt.localUrl || !attempt.remoteUrl) return;
    const generation = attempt.generation;
    const remoteUrl = attempt.remoteUrl;
    const probe = new Image();
    const finish = () => {
      if (generationRef.current !== generation) return;
      const ready = remotePreviewReady(attemptRef.current, generation);
      if (!ready.changed) return;
      if (ready.revokeUrl) URL.revokeObjectURL(ready.revokeUrl);
      commit(ready.state);
    };
    probe.onload = finish;
    probe.src = remoteUrl;
    return () => {
      probe.onload = null;
    };
  }, [attempt.phase, attempt.generation, attempt.localUrl, attempt.remoteUrl]);

  useEffect(() => {
    return () => {
      sessionRef.current?.cancel();
      if (attemptRef.current.localUrl) URL.revokeObjectURL(attemptRef.current.localUrl);
    };
  }, []);

  return {
    localUrl: attempt.localUrl,
    status: statusFromAttempt(attempt),
    error: attempt.error,
    busy: imageAttemptIsBusy(attempt),
    canRetry: attempt.canRetry,
    canCancel: imageAttemptIsBusy(attempt) || (attempt.phase === "error" && Boolean(attempt.localUrl)),
    choose(file) {
      sessionRef.current?.cancel();
      const localUrl = URL.createObjectURL(file);
      const begun = beginImageAttempt(attemptRef.current, localUrl);
      if (begun.revokeUrl) URL.revokeObjectURL(begun.revokeUrl);
      fileRef.current = file;
      commit(begun.state);
      start(file, begun.state.generation);
    },
    retry() {
      const file = fileRef.current;
      const next = retryImageAttempt(attemptRef.current);
      if (!file || next === attemptRef.current) return;
      sessionRef.current?.cancel();
      commit(next);
      start(file, next.generation);
    },
    cancel() {
      sessionRef.current?.cancel();
      sessionRef.current = null;
      const ended = cancelImageAttempt(attemptRef.current, generationRef.current);
      if (!ended.changed) return;
      if (ended.revokeUrl) URL.revokeObjectURL(ended.revokeUrl);
      fileRef.current = null;
      commit(ended.state);
    },
  };
}
