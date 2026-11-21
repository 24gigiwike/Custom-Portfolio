import assert from "node:assert/strict";
import { classifyAccountAge, parsePolicyEffectiveAt, readPolicyEffectiveAt } from "./portfolioPolicy";
import { parsePortfolioCreateBody, PortfolioCreateError } from "./portfolioCreate";

const cutoff = "2026-06-01T00:00:00.000Z";
const effective = parsePolicyEffectiveAt(cutoff);
assert.equal(effective.ok, true);
if (!effective.ok) throw new Error("cutoff");

assert.deepEqual(parsePolicyEffectiveAt(undefined), { ok: false, reason: "missing" });
assert.deepEqual(parsePolicyEffectiveAt("  "), { ok: false, reason: "missing" });
assert.deepEqual(parsePolicyEffectiveAt("2026-06-01"), { ok: false, reason: "invalid" });
assert.deepEqual(parsePolicyEffectiveAt("yesterday"), { ok: false, reason: "invalid" });
assert.equal(parsePolicyEffectiveAt("2026-06-01T01:00:00+01:00").ok, true);
assert.equal(readPolicyEffectiveAt({}).ok, false);

assert.equal(classifyAccountAge("2026-05-31T23:59:59.000Z", effective.at), "legacy");
assert.equal(classifyAccountAge("2026-06-01T00:00:00.000Z", effective.at), "restricted");
assert.equal(classifyAccountAge("2026-06-01T00:00:01.000Z", effective.at), "restricted");
assert.equal(classifyAccountAge("Tue, 31 May 2026 23:00:00 GMT", effective.at), "legacy");
assert.equal(classifyAccountAge("", effective.at), "unreadable");
assert.equal(classifyAccountAge("not-a-time", effective.at), "unreadable");
assert.equal(classifyAccountAge(1_700_000_000_000, effective.at), "unreadable");

const requestId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
assert.equal(parsePortfolioCreateBody({ purpose: "template", templateId: "wdk-premium-portfolio-1", requestId }).purpose, "template");
assert.throws(
  () => parsePortfolioCreateBody({ purpose: "template", templateId: "wdk-premium-portfolio-1" }),
  (error: unknown) => error instanceof PortfolioCreateError && error.status === 400,
);
assert.throws(
  () => parsePortfolioCreateBody({ purpose: "template", templateId: "wdk-premium-portfolio-1", requestId: "not-a-key" }),
  (error: unknown) => error instanceof PortfolioCreateError && error.status === 400,
);
for (const field of ["ownerId", "uid", "creationTime", "createdAt", "auth_time", "portfolioPolicy", "publishing", "portfolioId"]) {
  assert.throws(
    () => parsePortfolioCreateBody({ purpose: "template", templateId: "wdk-premium-portfolio-1", requestId, [field]: "client" }),
    (error: unknown) => error instanceof PortfolioCreateError && error.status === 400,
  );
}
assert.throws(
  () => parsePortfolioCreateBody({ purpose: "template", templateId: "not-a-template" }),
  (error: unknown) => error instanceof PortfolioCreateError && error.code === "unknown-template",
);

console.log("portfolio policy checks passed");
process.exit(0);
