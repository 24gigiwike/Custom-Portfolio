import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PORTFOLIO_DESIGN_PATH } from "../components/portfolio-design/portfolioDesignPath";
import { PORTFOLIO_EDITOR_PATH } from "../components/portfolio-editor/portfolioEditorPath";
import { PORTFOLIO_SEO_PATH } from "../components/portfolio-seo/portfolioSeoPath";
import { PORTFOLIO_WORKSPACE_PATH } from "../components/portfolio-workspace/portfolioWorkspacePath";
import {
  allocateHistoryIndex,
  allowHistoryLeave,
  commitHistoryPop,
  confirmDiscard,
  decideHistoryPop,
  rememberHistoryIndex,
  setNavigationGuard,
  type HistorySession,
} from "./unsavedChanges";

rememberHistoryIndex(4);
assert.equal(allocateHistoryIndex(), 5);
rememberHistoryIndex(4);
assert.equal(allocateHistoryIndex(), 5, "a rejected history push reuses the same next index");

type Entry = { path: string; idx: number | null };

function createBrowser(initial: Entry[]) {
  let entries = initial.map((entry) => ({ ...entry }));
  let cursor = entries.length - 1;
  let route = entries[cursor].path;
  const session: HistorySession = {
    idx: entries[cursor].idx ?? 0,
    reverting: false,
  };
  rememberHistoryIndex(session.idx);
  setNavigationGuard(null);
  let prompts = 0;
  const goCalls: number[] = [];

  const history = {
    go(delta: number) {
      if (delta === 0) throw new Error("history.go(0) reloads the page");
      goCalls.push(delta);
      const target = cursor + delta;
      if (target < 0 || target >= entries.length) {
        throw new Error(`history.go(${delta}) left the stack`);
      }
      cursor = target;
      // Some browsers deliver the return popstate before go() returns.
      applyPop();
    },
    pushState(idx: number, path: string) {
      entries = entries.slice(0, cursor + 1);
      entries.push({ path, idx });
      cursor = entries.length - 1;
    },
  };

  function applyPop() {
    const entry = entries[cursor];
    const nextRoute = commitHistoryPop(
      session,
      { path: entry.path, idx: entry.idx },
      route,
      allowHistoryLeave,
      history,
    );
    if (nextRoute !== null) route = nextRoute;
  }

  return {
    session,
    goCalls,
    back() {
      cursor -= 1;
      applyPop();
    },
    forward() {
      cursor += 1;
      applyPop();
    },
    jump(index: number) {
      cursor = index;
      applyPop();
    },
    navigate(path: string) {
      const idx = allocateHistoryIndex();
      session.idx = idx;
      history.pushState(idx, path);
      route = path;
    },
    block() {
      prompts = 0;
      setNavigationGuard(() => {
        prompts += 1;
        return false;
      });
    },
    allow() {
      prompts = 0;
      setNavigationGuard(() => {
        prompts += 1;
        return true;
      });
    },
    saved() {
      prompts = 0;
      setNavigationGuard(null);
    },
    get route() {
      return route;
    },
    get prompts() {
      return prompts;
    },
    get cursor() {
      return cursor;
    },
    stack() {
      return entries.map((entry) => ({ ...entry }));
    },
  };
}

const edit = PORTFOLIO_EDITOR_PATH;
const design = PORTFOLIO_DESIGN_PATH;
const seo = PORTFOLIO_SEO_PATH;
const workspace = PORTFOLIO_WORKSPACE_PATH;

const back = createBrowser([
  { path: workspace, idx: 0 },
  { path: edit, idx: 1 },
]);
back.block();
back.back();
assert.equal(back.route, edit, "cancelling Back stays on Edit");
assert.equal(back.prompts, 1, "Back asks once");
assert.deepEqual(back.goCalls, [1]);
assert.equal(back.cursor, 1);
assert.equal(back.session.reverting, false);
assert.equal(back.session.idx, 1);

const forward = createBrowser([
  { path: design, idx: 1 },
  { path: workspace, idx: 2 },
]);
forward.jump(0);
assert.equal(forward.route, design);
forward.block();
forward.forward();
assert.equal(forward.route, design, "cancelling Forward stays on Design");
assert.equal(forward.prompts, 1, "Forward asks once");
assert.deepEqual(forward.goCalls, [-1]);
assert.equal(forward.cursor, 0);

const confirmed = createBrowser([
  { path: workspace, idx: 0 },
  { path: seo, idx: 1 },
]);
confirmed.allow();
confirmed.back();
assert.equal(confirmed.route, workspace, "confirming Back leaves SEO");
assert.equal(confirmed.prompts, 1);
assert.deepEqual(confirmed.goCalls, []);
assert.equal(confirmed.session.idx, 0);

const afterSave = createBrowser([
  { path: workspace, idx: 0 },
  { path: edit, idx: 1 },
  { path: design, idx: 2 },
]);
afterSave.saved();
afterSave.back();
assert.equal(afterSave.route, edit);
assert.equal(afterSave.prompts, 0, "Back after Save does not ask");
afterSave.back();
assert.equal(afterSave.route, workspace);
assert.equal(afterSave.prompts, 0, "a second Back after Save does not ask");

const resumed = createBrowser([
  { path: workspace, idx: 0 },
  { path: edit, idx: 1 },
  { path: design, idx: 2 },
]);
resumed.allow();
resumed.back();
assert.equal(resumed.route, edit);
resumed.navigate(seo);
assert.deepEqual(resumed.stack(), [
  { path: workspace, idx: 0 },
  { path: edit, idx: 1 },
  { path: seo, idx: 2 },
]);
resumed.block();
resumed.back();
assert.equal(resumed.route, seo, "cancelling Back after a new visit stays put");
assert.equal(resumed.prompts, 1);
assert.deepEqual(resumed.goCalls, [1], "the return is one step, not the old index gap");

const legacy = createBrowser([
  { path: workspace, idx: null },
  { path: edit, idx: 1 },
]);
legacy.block();
legacy.back();
assert.equal(legacy.route, edit, "cancelling an unstamped Back stays on Edit");
assert.equal(legacy.prompts, 1);
assert.deepEqual(legacy.goCalls, [], "unstamped cancel does not call history.go");
assert.equal(legacy.stack().at(-1)?.path, edit);

const legacyConfirm = createBrowser([
  { path: workspace, idx: null },
  { path: design, idx: 1 },
]);
legacyConfirm.allow();
legacyConfirm.back();
assert.equal(legacyConfirm.route, workspace);
assert.equal(legacyConfirm.prompts, 1);
assert.deepEqual(legacyConfirm.goCalls, []);

const samePage = decideHistoryPop({
  reverting: false,
  currentIdx: 1,
  currentPath: edit,
  nextIdx: 1,
  nextPath: edit,
  allowLeave: () => {
    throw new Error("same page should not ask");
  },
});
assert.deepEqual(samePage, { type: "ignore", idx: 1 });

const echo = decideHistoryPop({
  reverting: true,
  currentIdx: 1,
  currentPath: edit,
  nextIdx: 1,
  nextPath: edit,
  allowLeave: () => {
    throw new Error("the return trip should not ask");
  },
});
assert.equal(echo.type, "ignore");

const sameIndex = decideHistoryPop({
  reverting: false,
  currentIdx: 2,
  currentPath: edit,
  nextIdx: 2,
  nextPath: workspace,
  allowLeave: () => false,
});
assert.equal(sameIndex.type, "restore");

let linkPrompts = 0;
setNavigationGuard(() => {
  throw new Error("a workspace link should not use the Back/Forward guard");
});
assert.equal(
  confirmDiscard(true, () => {
    linkPrompts += 1;
    return false;
  }),
  false,
);
assert.equal(linkPrompts, 1, "cancelling a workspace link asks once");
assert.equal(
  confirmDiscard(true, () => {
    linkPrompts += 1;
    return true;
  }),
  true,
);
assert.equal(linkPrompts, 2, "confirming a workspace link asks once more");
assert.equal(confirmDiscard(false, () => false), true, "a saved page does not ask");

const guard = createBrowser([
  { path: workspace, idx: 0 },
  { path: seo, idx: 1 },
]);
guard.saved();
assert.equal(allowHistoryLeave(), true);
guard.back();
assert.equal(guard.route, workspace);
assert.equal(guard.prompts, 0);

const source = readFileSync(new URL("./unsavedChanges.ts", import.meta.url), "utf8");
assert.match(source, /beforeunload/);
assert.match(source, /useWarnOnUnload\(dirty\)/);
assert.match(source, /setNavigationGuard\(null\)/);
assert.match(source, /setNavigationGuard\(\(\) => confirmDiscard\(true\)\)/);
assert.match(source, /decision\.delta === 0/);

const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
assert.match(app, /commitHistoryPop\(/);
assert.match(app, /allocateHistoryIndex\(/);
assert.doesNotMatch(app, /history\.go\(0\)/);

for (const file of [
  "../components/portfolio-editor/PortfolioEditor.tsx",
  "../components/portfolio-design/PortfolioDesign.tsx",
  "../components/portfolio-seo/PortfolioSeo.tsx",
]) {
  const page = readFileSync(new URL(file, import.meta.url), "utf8");
  assert.match(page, /useUnsavedChanges\(/);
  assert.match(page, /confirmDiscard\(/);
  assert.doesNotMatch(page, /useWarnOnUnload\(/);
}

const preview = readFileSync(new URL("../preview/WdkTemplatePreview.tsx", import.meta.url), "utf8");
assert.match(preview, /allocateHistoryIndex\(/);
assert.doesNotMatch(preview, /pushState\(null/);

const nav = readFileSync(new URL("../components/portfolio-workspace/PortfolioSectionNav.tsx", import.meta.url), "utf8");
assert.match(nav, /beforeLeave && !beforeLeave\(\)/);
assert.match(nav, /onOpenPath\(section\.path\)/);

setNavigationGuard(null);
console.log("unsaved navigation checks passed");
