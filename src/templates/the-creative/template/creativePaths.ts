import { allocateHistoryIndex, rememberHistoryIndex } from "../../../lib/unsavedChanges";

export function creativeProjectId(pathname: string): string | null {
  const match = pathname.split("?")[0].split("#")[0].match(/\/work\/([^/]+)\/?$/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function creativeHomePath(pathname = window.location.pathname): string {
  return pathname.split("?")[0].split("#")[0].replace(/\/work\/[^/]+\/?$/, "") || "/";
}

export function creativeProjectPath(id: string, pathname = window.location.pathname): string {
  return `${creativeHomePath(pathname)}/work/${encodeURIComponent(id)}`;
}

export function creativeNavigate(pathname: string, hash = "") {
  const next = `${pathname}${window.location.search}${hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current !== next) {
    const idx = allocateHistoryIndex();
    try {
      window.history.pushState({ idx }, "", next);
    } catch {
      rememberHistoryIndex(idx - 1);
    }
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}
