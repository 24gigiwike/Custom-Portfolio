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
