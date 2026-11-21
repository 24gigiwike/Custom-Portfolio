import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isLegalPath, REFUND_POLICY_PATH, REFUND_POLICY_UPDATED } from "./legalPaths";
import { platformTitle } from "./portfolioSeo";

assert.equal(isLegalPath("/refund-policy"), true);
assert.equal(isLegalPath("/privacy"), true);
assert.equal(isLegalPath("/terms"), true);
assert.equal(isLegalPath("/refund-policy?from=checkout"), true);
assert.equal(isLegalPath("/p/refund-policy"), false);
assert.equal(platformTitle("/refund-policy"), "Refund Policy — Custom Portfolio");
assert.equal(platformTitle("/privacy"), "Privacy Policy — Custom Portfolio");
assert.equal(platformTitle("/terms"), "Terms & Conditions — Custom Portfolio");

const policy = readFileSync(new URL("../components/legal/LegalDocumentPage.tsx", import.meta.url), "utf8");
assert.match(policy, /generally non-refundable/);
assert.match(policy, /early/);
assert.match(policy, /does not use is also generally non-refundable|Time you do not use/);
assert.match(policy, /Nigerian law/);
assert.match(policy, /duplicate charge/);
assert.match(policy, /For questions about a publishing payment, duplicate charges or payment issues, contact our support team on WhatsApp\./);
assert.match(policy, /https:\/\/wa\.me\/2347060706416/);
assert.match(policy, /Contact support on WhatsApp/);
assert.equal(policy.includes("sign in with the Google account"), false);
assert.match(policy, /REFUND_POLICY_UPDATED/);
assert.equal(REFUND_POLICY_UPDATED, "21 November 2026");
assert.equal(policy.includes("@"), false);

const footer = readFileSync(new URL("../components/legal/ProductLegalFooter.tsx", import.meta.url), "utf8");
assert.match(footer, /Privacy Policy/);
assert.match(footer, /Terms & Conditions/);
assert.match(footer, /Refund Policy/);

const checkout = readFileSync(new URL("../components/portfolio-publish/PublishingRefundNotice.tsx", import.meta.url), "utf8");
assert.match(checkout, /Publishing payments are generally non-refundable/);
assert.match(checkout, /Refund Policy/);
assert.match(checkout, /REFUND_POLICY_PATH/);

const screen = readFileSync(new URL("../components/portfolio-publish/PortfolioPublish.tsx", import.meta.url), "utf8");
const payButton = screen.indexOf("portfolio-publish-pay");
const renewButton = screen.indexOf("portfolio-renew-action");
const firstNotice = screen.indexOf("<PublishingRefundNotice");
const lastNotice = screen.lastIndexOf("<PublishingRefundNotice");
assert.ok(firstNotice > 0 && firstNotice < payButton);
assert.ok(lastNotice < renewButton);
assert.match(screen, /Continue to payment/);

const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
assert.match(app, /isLegalPath\(currentRoute\)/);
assert.match(app, /ProductLegalFooter/);
assert.equal(app.includes("publishingControls"), false);

const grant = readFileSync(new URL("../server/publishingEntitlementGrant.ts", import.meta.url), "utf8");
assert.match(grant, /if \(input\.event\.type !== "refund\.paid"\) return \{ kind: "kept", expiresAt: null \};/);
assert.equal(grant.includes("refunds.create"), false);

console.log("legal page checks passed");
void REFUND_POLICY_PATH;
