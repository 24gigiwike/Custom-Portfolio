import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { customerRefundRequestChangesEntitlement } from "./publishingPaymentDecision";
import { handleBachsWebhook } from "./bachsWebhookHandler";

const sandboxKey = "sk_sandbox_test";
const liveKey = "sk_live_test";
const sandboxSecret = "sandbox-webhook-secret";
const liveSecret = "live-webhook-secret";

function envelope(type = "fixture.verified"): string {
  return JSON.stringify({
    id: "evt_fixture",
    type,
    created_at: "2026-01-01T00:00:00.000Z",
    organization_id: "org_fixture",
    data: { note: "signature fixture" },
  });
}

function signature(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const digest = createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

function env(runtime: "production" | "preview", secret: string | undefined, key: string): NodeJS.ProcessEnv {
  return {
    VERCEL_ENV: runtime,
    BACHS_API_KEY: key,
    BACHS_WEBHOOK_SECRET: secret,
    FIREBASE_PROJECT_ID: runtime === "production" ? "custom-portfolio-2026" : "custom-by-broadbrand",
    VITE_FIREBASE_PROJECT_ID: runtime === "production" ? "custom-portfolio-2026" : "custom-by-broadbrand",
  };
}

async function post(input: {
  runtime?: "production" | "preview";
  key?: string;
  secret?: string | undefined;
  body?: Uint8Array | string;
  headers?: Record<string, string | undefined>;
  projectId?: string;
  clientProjectId?: string;
}) {
  const sent: { status?: number; body?: Record<string, unknown> } = {};
  const runtime = input.runtime ?? "preview";
  const selected = env(runtime, input.secret === undefined ? sandboxSecret : input.secret, input.key ?? sandboxKey);
  if (input.projectId) selected.FIREBASE_PROJECT_ID = input.projectId;
  if (input.clientProjectId) selected.VITE_FIREBASE_PROJECT_ID = input.clientProjectId;
  await handleBachsWebhook(
    {
      method: "POST",
      headers: input.headers ?? {},
      body: input.body,
    },
    {
      status(code: number) { sent.status = code; return this; },
      setHeader() {},
      end(value: string) { sent.body = JSON.parse(value) as Record<string, unknown>; },
    },
    { env: selected },
  );
  return { status: sent.status ?? 0, body: sent.body ?? {} };
}

function signed(secret: string, body: string) {
  return { "x-bachs-signature-v2": signature(secret, body) };
}

const body = envelope();
const unknownType = envelope("not-a-documented-bachs-event");
const preserved = await post({ body: unknownType, headers: signed(sandboxSecret, unknownType) });
assert.equal(preserved.status, 200);
assert.deepEqual(preserved.body, { received: true });

const valid = await post({ body, headers: signed(sandboxSecret, body) });
assert.equal(valid.status, 200);
assert.deepEqual(valid.body, { received: true });
assert.equal(JSON.stringify(valid.body).includes("evt_fixture"), false);
assert.equal(JSON.stringify(valid.body).includes(sandboxSecret), false);

const invalid = await post({
  body,
  headers: { "x-bachs-signature-v2": signature("other-secret", body) },
});
assert.equal(invalid.status, 400);
assert.equal(invalid.body.code, "invalid-signature");

const missing = await post({ body, headers: {} });
assert.equal(missing.status, 400);
assert.equal(missing.body.code, "invalid-signature");

const changed = `${body} `;
const modified = await post({ body: changed, headers: signed(sandboxSecret, body) });
assert.equal(modified.status, 400);
assert.equal(modified.body.code, "invalid-signature");

const broken = "{";
const malformed = await post({ body: broken, headers: signed(sandboxSecret, broken) });
assert.equal(malformed.status, 400);
assert.equal(malformed.body.code, "malformed");

const incomplete = JSON.stringify({ id: "evt_fixture", type: "fixture.verified" });
const unsupported = await post({ body: incomplete, headers: signed(sandboxSecret, incomplete) });
assert.equal(unsupported.status, 400);
assert.equal(unsupported.body.code, "malformed");

const noSecret = await post({ secret: "", body, headers: signed(sandboxSecret, body) });
assert.equal(noSecret.status, 503);
assert.equal(noSecret.body.code, "unavailable");
assert.equal(JSON.stringify(noSecret.body).includes(sandboxSecret), false);

const sandboxOnProduction = await post({
  runtime: "production",
  key: liveKey,
  secret: liveSecret,
  body,
  headers: signed(sandboxSecret, body),
});
assert.equal(sandboxOnProduction.status, 400);
assert.equal(sandboxOnProduction.body.code, "invalid-signature");

const liveOnSandbox = await post({
  runtime: "preview",
  key: sandboxKey,
  secret: sandboxSecret,
  body,
  headers: signed(liveSecret, body),
});
assert.equal(liveOnSandbox.status, 400);
assert.equal(liveOnSandbox.body.code, "invalid-signature");

const productionSigned = await post({
  runtime: "production",
  key: liveKey,
  secret: liveSecret,
  body,
  headers: signed(liveSecret, body),
});
assert.equal(productionSigned.status, 200);

const sandboxKeyOnProduction = await post({
  runtime: "production",
  key: sandboxKey,
  secret: liveSecret,
  body,
  headers: signed(liveSecret, body),
});
assert.equal(sandboxKeyOnProduction.status, 503);
assert.equal(sandboxKeyOnProduction.body.code, "unavailable");

const liveKeyOnSandbox = await post({
  runtime: "preview",
  key: liveKey,
  secret: sandboxSecret,
  body,
  headers: signed(sandboxSecret, body),
});
assert.equal(liveKeyOnSandbox.status, 503);
assert.equal(liveKeyOnSandbox.body.code, "unavailable");

const wrongProject = await post({
  projectId: "custom-portfolio-2026",
  clientProjectId: "custom-portfolio-2026",
  body,
  headers: signed(sandboxSecret, body),
});
assert.equal(wrongProject.status, 503);
assert.equal(wrongProject.body.code, "unavailable");

const plugin = readFileSync(new URL("./imageKitDevPlugin.ts", import.meta.url), "utf8");
for (const path of [
  "/api/imagekit-delete",
  "/api/portfolio-policy",
  "/api/portfolio-create",
  "/api/publishing-checkout",
  "/api/imagekit-upload",
  "/api/bachs-webhook",
]) {
  assert.match(plugin, new RegExp(path.replaceAll("/", "\\/")));
}
assert.equal(plugin.includes("portfolioPublishingEntitlements"), false);
const handlerSource = readFileSync(new URL("./bachsWebhookHandler.ts", import.meta.url), "utf8");
assert.equal(handlerSource.includes("collection(\"payments\")"), false);
assert.equal(handlerSource.includes("portfolioPublishingEntitlements"), false);
assert.equal(handlerSource.includes(sandboxSecret), false);
assert.equal(handlerSource.includes(liveSecret), false);
assert.equal(customerRefundRequestChangesEntitlement(), false);
assert.equal(handlerSource.includes("refunds.create"), false);
assert.equal(handlerSource.includes("/api/refund"), false);

const opened = envelope("refund.created");
let refundSettlements = 0;
const openedSent: { status?: number; body?: Record<string, unknown> } = {};
await handleBachsWebhook(
  { method: "POST", headers: signed(sandboxSecret, opened), body: opened },
  {
    status(code: number) { openedSent.status = code; return this; },
    setHeader() {},
    end(value: string) { openedSent.body = JSON.parse(value) as Record<string, unknown>; },
  },
  {
    env: env("preview", sandboxSecret, sandboxKey),
    settleRefund: async () => {
      refundSettlements += 1;
      return { kind: "revoked", expiresAt: null };
    },
  },
);
assert.equal(openedSent.status, 200);
assert.deepEqual(openedSent.body, { received: true });
assert.equal(refundSettlements, 0);

console.log("bachs webhook checks passed");
