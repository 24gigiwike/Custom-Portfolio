import assert from "node:assert/strict";
import { isPortfolioEditorPath } from "../components/portfolio-editor/portfolioEditorPath";
import { isPortfolioWorkspacePath, PORTFOLIO_WORKSPACE_PATH } from "../components/portfolio-workspace/portfolioWorkspacePath";
import { WDK_TEMPLATE_PREVIEW_PATH } from "../preview/templatePreviewPath";
import { portfolioTemplateInfo, publishingStatusLabel } from "./portfolioTemplate";

const wdk = portfolioTemplateInfo("wdk-premium-portfolio-1");
assert.equal(wdk.name, "WDK Premium Portfolio 1");
assert.equal(wdk.previewPath, WDK_TEMPLATE_PREVIEW_PATH);

const unknown = portfolioTemplateInfo("future-template");
assert.equal(unknown.name, "future-template");
assert.equal(unknown.previewPath, null);

assert.equal(publishingStatusLabel("draft"), "Draft");
assert.equal(isPortfolioWorkspacePath(PORTFOLIO_WORKSPACE_PATH), true);
assert.equal(isPortfolioWorkspacePath("/portfolio/edit"), false);
assert.equal(isPortfolioEditorPath("/portfolio"), false);

console.log("portfolio template checks passed");
