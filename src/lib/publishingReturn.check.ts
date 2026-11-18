import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isPublishingPaymentReturnPath,
  PUBLISHING_PAYMENT_CANCELLED_PATH,
  PUBLISHING_PAYMENT_SUCCESS_PATH,
  publishingPaymentReturnOutcome,
} from "../components/portfolio-publish/publishingReturnPath";
import { isPortfolioPublishPath } from "../components/portfolio-publish/portfolioPublishPath";
import { readCheckoutReference } from "./publishingReturn";
import { nextSignedInPath } from "./returningRoute";

assert.equal(PUBLISHING_PAYMENT_SUCCESS_PATH, "/portfolio/publish/return");
assert.equal(PUBLISHING_PAYMENT_CANCELLED_PATH, "/portfolio/publish/cancelled");
assert.equal(isPortfolioPublishPath(PUBLISHING_PAYMENT_SUCCESS_PATH), false);
assert.equal(isPortfolioPublishPath(PUBLISHING_PAYMENT_CANCELLED_PATH), false);
assert.equal(publishingPaymentReturnOutcome(`${PUBLISHING_PAYMENT_SUCCESS_PATH}?checkout_id=chk_123`), "success");
assert.equal(publishingPaymentReturnOutcome(`${PUBLISHING_PAYMENT_CANCELLED_PATH}/`), "cancelled");
assert.equal(publishingPaymentReturnOutcome("/portfolio/publish"), null);
assert.equal(isPublishingPaymentReturnPath("/portfolio/publish/return/extra"), false);

assert.equal(readCheckoutReference(""), null);
assert.equal(readCheckoutReference("?amount=1"), null);
assert.equal(readCheckoutReference("?checkout_id=chk_abc-123"), "chk_abc-123");
assert.equal(readCheckoutReference("checkout_id=chk_abc&status=paid"), "chk_abc");
assert.equal(readCheckoutReference("?checkout_id="), null);
assert.equal(readCheckoutReference("?checkout_id=chk%20paid"), null);
assert.equal(readCheckoutReference("?checkout_id=<script>"), null);
assert.equal(readCheckoutReference(`?checkout_id=${"a".repeat(129)}`), null);

const stay = {
  phase: "READY",
  portfolioCount: 1,
  hasReadyTemplate: true,
};
assert.equal(nextSignedInPath({ ...stay, path: PUBLISHING_PAYMENT_SUCCESS_PATH }), null);
assert.equal(nextSignedInPath({ ...stay, path: `${PUBLISHING_PAYMENT_CANCELLED_PATH}?checkout_id=chk_1` }), null);

const page = readFileSync(new URL("../components/portfolio-publish/PublishingPaymentReturn.tsx", import.meta.url), "utf8");
assert.match(page, /You have returned from Bachs checkout\./);
assert.match(page, /Your payment is being verified\./);
assert.match(page, /Publishing access activates only after the payment is verified on our server\./);
assert.match(page, /This page does not publish your portfolio\./);
assert.match(page, /Checkout was cancelled or not completed\./);
assert.match(page, /Your portfolio and saved work remain intact\./);
assert.match(page, /Return to payment/);
assert.match(page, /This reference does not confirm payment\./);
assert.doesNotMatch(page, /requestPublishingCheckout|publishPortfolio|portfolioPublishingEntitlements|setDoc|updateDoc|addDoc/);

const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const returnRender = app.indexOf("publishingPaymentReturnOutcome(currentRoute)");
const authFallback = app.indexOf('key="auth-route"');
assert.ok(returnRender > 0);
assert.ok(authFallback > returnRender);
assert.match(app, /<PublishingPaymentReturn/);
assert.match(app, /isPublishingPaymentReturnPath\(window\.location\.pathname\)/);
assert.doesNotMatch(app, /publishingPaymentReturnOutcome[\s\S]{0,400}publishPortfolio|requestPublishingCheckout/);

console.log("publishing return checks passed");
