import assert from "node:assert/strict";
import { isPortfolioEditorPath } from "../components/portfolio-editor/portfolioEditorPath";
import { isPortfolioWorkspacePath, PORTFOLIO_WORKSPACE_PATH } from "../components/portfolio-workspace/portfolioWorkspacePath";
import { isTemplateDiscoveryPath, TEMPLATE_DISCOVERY_PATH } from "../components/discover/templateDiscoveryPath";
import { WDK_TEMPLATE_PREVIEW_PATH } from "../preview/templatePreviewPath";
import { portfolioTemplateInfo, publishingStatusLabel } from "./portfolioTemplate";
import {
  catalogTemplateForPreviewPath,
  findCatalogTemplate,
  listCatalogTemplates,
  templateForCreation,
} from "./templateCatalog";

const templates = listCatalogTemplates();
assert.equal(templates.length, 1);
assert.equal(templates[0]?.id, "wdk-premium-portfolio-1");

const wdk = findCatalogTemplate("wdk-premium-portfolio-1");
assert.ok(wdk);
assert.equal(wdk.name, "WDK Premium Portfolio 1");
assert.equal(wdk.version, "1.0.0");
assert.equal(wdk.availability, "available");
assert.equal(wdk.previewPath, WDK_TEMPLATE_PREVIEW_PATH);
assert.equal(catalogTemplateForPreviewPath(WDK_TEMPLATE_PREVIEW_PATH)?.id, wdk.id);
assert.equal(templateForCreation(wdk.id)?.id, wdk.id);

const info = portfolioTemplateInfo(wdk.id);
assert.equal(info.name, wdk.name);
assert.equal(info.previewPath, wdk.previewPath);

assert.equal(findCatalogTemplate("future-template"), null);
assert.equal(templateForCreation("future-template"), null);
assert.equal(templateForCreation(""), null);
assert.equal(catalogTemplateForPreviewPath("/template-preview/future-template"), null);

const unknown = portfolioTemplateInfo("future-template");
assert.equal(unknown.name, "future-template");
assert.equal(unknown.previewPath, null);
assert.notEqual(unknown.name, wdk.name);
assert.notEqual(unknown.previewPath, wdk.previewPath);

assert.equal(publishingStatusLabel("draft"), "Draft");
assert.equal(isPortfolioWorkspacePath(PORTFOLIO_WORKSPACE_PATH), true);
assert.equal(isPortfolioWorkspacePath("/portfolio/edit"), false);
assert.equal(isPortfolioEditorPath("/portfolio"), false);
assert.equal(isTemplateDiscoveryPath(TEMPLATE_DISCOVERY_PATH), true);
assert.equal(isTemplateDiscoveryPath("/discover"), false);
assert.equal(isTemplateDiscoveryPath("/portfolio"), false);

console.log("portfolio template checks passed");
