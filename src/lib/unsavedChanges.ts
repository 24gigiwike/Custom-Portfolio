import { useEffect } from "react";

export const UNSAVED_LEAVE_MESSAGE = "You have unsaved changes. Leave without saving?";

/** Returns true when navigation should continue. */
export function confirmDiscard(
  dirty: boolean,
  confirm: (message: string) => boolean = (message) => window.confirm(message),
  message = UNSAVED_LEAVE_MESSAGE,
): boolean {
  if (!dirty) return true;
  return confirm(message);
}

/** Warn before a browser refresh or close while a form is dirty. */
export function useWarnOnUnload(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);
}

type LeaveGuard = () => boolean;

let leaveGuard: LeaveGuard | null = null;
let historySeq = 0;

export function setNavigationGuard(guard: LeaveGuard | null): void {
  leaveGuard = guard;
}

/** Popstate permission. A clean page allows the move without a prompt. */
export function allowHistoryLeave(): boolean {
  if (!leaveGuard) return true;
  return leaveGuard();
}

/** The index stored on the history entry that is currently showing. */
export function rememberHistoryIndex(idx: number): void {
  if (Number.isFinite(idx)) historySeq = idx;
}

/** Index for the next in-app history entry. It is one step ahead of the current entry. */
export function allocateHistoryIndex(): number {
  historySeq += 1;
  return historySeq;
}

/**
 * Refresh/close protection plus a Back/Forward guard for the page that is open.
 * The guard is removed when the page is clean, including after Save.
 */
export function useUnsavedChanges(dirty: boolean): void {
  useWarnOnUnload(dirty);
  useEffect(() => {
    if (!dirty) {
      setNavigationGuard(null);
      return;
    }
    setNavigationGuard(() => confirmDiscard(true));
    return () => setNavigationGuard(null);
  }, [dirty]);
}

export function historyIndexFromState(state: unknown): number | null {
  if (!state || typeof state !== "object" || !("idx" in state)) return null;
  const idx = (state as { idx?: unknown }).idx;
  return typeof idx === "number" && Number.isFinite(idx) ? idx : null;
}

export type HistoryPop =
  | { type: "ignore"; idx: number | null }
  | { type: "apply"; path: string; idx: number | null }
  | { type: "revert"; delta: number }
  | { type: "restore" };

/**
 * Decide what a Back/Forward event should do.
 * The browser has already moved. Cancel returns to the editing entry
 * by the opposite number of steps, and that return trip is ignored.
 */
export function decideHistoryPop(input: {
  reverting: boolean;
  currentIdx: number;
  currentPath: string;
  nextIdx: number | null;
  nextPath: string;
  allowLeave: () => boolean;
}): HistoryPop {
  if (input.reverting) return { type: "ignore", idx: input.nextIdx };
  if (input.nextPath === input.currentPath) return { type: "ignore", idx: input.nextIdx ?? input.currentIdx };
  if (input.allowLeave()) return { type: "apply", path: input.nextPath, idx: input.nextIdx };
  if (input.nextIdx !== null && input.nextIdx !== input.currentIdx) {
    return { type: "revert", delta: input.currentIdx - input.nextIdx };
  }
  return { type: "restore" };
}

export type HistorySession = {
  idx: number;
  reverting: boolean;
};

export type HistoryAdapter = {
  go(delta: number): void;
  pushState(idx: number, path: string): void;
};

/**
 * Apply one browser Back/Forward event.
 * Cancel keeps the editing route mounted and returns the address to it.
 * The return trip is marked before it runs, so it does not ask again.
 */
export function commitHistoryPop(
  session: HistorySession,
  next: { path: string; idx: number | null },
  currentPath: string,
  allowLeave: () => boolean,
  history: HistoryAdapter,
): string | null {
  const decision = decideHistoryPop({
    reverting: session.reverting,
    currentIdx: session.idx,
    currentPath,
    nextIdx: next.idx,
    nextPath: next.path,
    allowLeave,
  });
  if (decision.type === "ignore") {
    session.reverting = false;
    if (decision.idx !== null) {
      session.idx = decision.idx;
      rememberHistoryIndex(decision.idx);
    }
    return null;
  }
  if (decision.type === "revert") {
    if (decision.delta === 0) return null;
    session.reverting = true;
    try {
      history.go(decision.delta);
    } catch {
      session.reverting = false;
      try {
        history.pushState(session.idx, currentPath);
      } catch {
        // The editing page stays mounted even if the address cannot be restored.
      }
    }
    return null;
  }
  if (decision.type === "restore") {
    try {
      history.pushState(session.idx, currentPath);
    } catch {
      // The editing page stays mounted even if the address cannot be restored.
    }
    return null;
  }
  if (decision.idx !== null) {
    session.idx = decision.idx;
    rememberHistoryIndex(decision.idx);
  }
  return decision.path;
}
