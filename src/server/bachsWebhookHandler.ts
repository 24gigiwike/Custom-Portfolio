/**
 * Verifies a Bachs webhook from the exact received bytes.
 * Signature verification uses the SDK contract: HMAC-SHA256 over
 * `${timestamp}.` plus the raw body, from X-Bachs-Signature-V2 or the
 * legacy timestamp and signature headers. A verified collection is recorded
 * by the payment ledger. A live collection then grants publishing, and a
 * retrieved full refund revokes it, before this handler acknowledges the event.
 */
import { webhooks, BachsWebhookError, BachsConfigError, type WebhookEvent } from "@bachs/sdk";
import { FirebaseProjectIsolationError, firebaseRuntime } from "../lib/firebaseEnvironment";
import { firebaseProjectId } from "./firebaseIdToken";
import { assertBachsApiKeyForRuntime, BachsRuntimeError } from "./bachsRuntime";
import {
  ingestVerifiedCollection,
  PublishingLedgerError,
  type CollectionLedgerPorts,
} from "./publishingPaymentLedger";
import {
  settleRecordedCollection,
  settleRefundEvent,
  type PublishingSettlement,
} from "./publishingEntitlementGrant";
import type { Firestore } from "firebase-admin/firestore";
import { parseDomainPaymentReference, sandboxFirestoreBlocked } from "./domainPayment";
import { firebaseAdminFirestore } from "./firebaseAdmin";
import { firestoreSandboxReceiptStore, recordSandboxWebhook, sandboxSecretSeparate, type SandboxPaymentRecord, type SandboxReceiptStore } from "./bachsSandboxReceipt";

export const BACHS_WEBHOOK_MAX_BODY_BYTES = 65_536;

const UNAVAILABLE = "Publishing payment is not available right now.";

type HeaderValue = string | string[] | undefined;

export type BachsWebhookNodeRequest = {
  method?: string;
  headers: Record<string, HeaderValue>;
  body?: Uint8Array | string;
  bodyTooLarge?: boolean;
};

export type BachsWebhookNodeResponse = {
  status: (code: number) => BachsWebhookNodeResponse;
  setHeader: (name: string, value: string) => void;
  end: (body: string) => void;
};

export type BachsWebhookHandlerOptions = {
  env?: NodeJS.ProcessEnv;
  now?: Date;
  constructEvent?: typeof webhooks.constructEvent;
  ingestCollection?: typeof ingestVerifiedCollection;
  collectionLedger?: CollectionLedgerPorts;
  firestore?: Firestore | null;
  settleCollection?: typeof settleRecordedCollection;
  settleRefund?: typeof settleRefundEvent;
  settleDomainPayment?: (event: WebhookEvent, env: NodeJS.ProcessEnv) => Promise<"verified" | "duplicate" | "held" | "unavailable" | void>;
  sandboxStore?: SandboxReceiptStore;
  getSandboxPayment?: (paymentId: string) => Promise<SandboxPaymentRecord | null>;
};

function eventReference(event: WebhookEvent): string {
  const data = (event as { data?: unknown }).data;
  if (!data || typeof data !== "object") return "";
  const record = data as { reference?: unknown; object?: { reference?: unknown } };
  if (typeof record.reference === "string") return record.reference;
  const nested = record.object?.reference;
  return typeof nested === "string" ? nested : "";
}

function send(res: BachsWebhookNodeResponse, status: number, payload: Record<string, unknown>): void {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
}

function sandboxReceiptStore(env: NodeJS.ProcessEnv): SandboxReceiptStore | null {
  const db = firebaseAdminFirestore(env);
  return db ? firestoreSandboxReceiptStore(db) : null;
}

function webhookFailure(error: unknown): "signature" | "malformed" | "config" {
  if (error instanceof BachsConfigError) return "config";
  if (error instanceof BachsWebhookError) {
    const message = error.message;
    if (message.includes("not valid UTF-8 JSON") || message.includes("not a supported event envelope")) return "malformed";
    return "signature";
  }
  return "config";
}

export async function readRawWebhookBody(
  req: AsyncIterable<Uint8Array | string>,
  maxBytes = BACHS_WEBHOOK_MAX_BODY_BYTES,
): Promise<Buffer | "too-large"> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk);
    size += buf.length;
    if (size > maxBytes) {
      const destroyable = req as { destroy?: () => void };
      destroyable.destroy?.();
      return "too-large";
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

/**
 * Accepts one verified event envelope for this runtime's webhook secret.
 * The API key must already match the runtime. A different secret never matches.
 */
export async function handleBachsWebhook(
  req: BachsWebhookNodeRequest,
  res: BachsWebhookNodeResponse,
  options: BachsWebhookHandlerOptions = {},
): Promise<void> {
  if ((req.method ?? "GET").toUpperCase() !== "POST") {
    res.setHeader("allow", "POST");
    send(res, 405, { error: "Use POST to deliver a publishing webhook.", code: "method" });
    return;
  }
  const env = options.env ?? process.env;
  try {
    const emulatorProject = env.FIREBASE_PROJECT_ID?.trim() === "demo-custom-portfolio"
      && env.VITE_FIREBASE_PROJECT_ID?.trim() === "demo-custom-portfolio"
      && env.FIRESTORE_EMULATOR_HOST?.trim().startsWith("127.0.0.1:");
    if (!(firebaseRuntime(env) === "local" && emulatorProject)) firebaseProjectId(env);
    assertBachsApiKeyForRuntime(env);
  } catch (error) {
    if (error instanceof FirebaseProjectIsolationError || error instanceof BachsRuntimeError) {
      send(res, 503, { error: UNAVAILABLE, code: "unavailable" });
      return;
    }
    throw error;
  }
  const secrets = sandboxSecretSeparate(env);
  if (secrets === "missing-live" || secrets === "same-secret") {
    send(res, 503, { error: UNAVAILABLE, code: "unavailable" });
    return;
  }
  const secret = secrets.live;
  if (req.bodyTooLarge) {
    send(res, 413, { error: "The publishing webhook is not valid.", code: "invalid-request" });
    return;
  }
  if (req.body === undefined) {
    send(res, 400, { error: "The publishing webhook is not valid.", code: "invalid-request" });
    return;
  }
  const raw = typeof req.body === "string" ? req.body : Uint8Array.from(req.body);
  const construct = options.constructEvent ?? webhooks.constructEvent;
  let event: WebhookEvent;
  let sandboxSigned = false;
  try {
    event = construct(raw, req.headers, secret);
  } catch (error) {
    const failure = webhookFailure(error);
    if (failure !== "signature" || !secrets.sandbox) {
      if (failure === "malformed") send(res, 400, { error: "The publishing webhook is not valid.", code: "malformed" });
      else if (failure === "signature") send(res, 400, { error: "The publishing webhook is not valid.", code: "invalid-signature" });
      else send(res, 503, { error: UNAVAILABLE, code: "unavailable" });
      return;
    }
    try {
      event = construct(raw, req.headers, secrets.sandbox);
      sandboxSigned = true;
    } catch (sandboxError) {
      const sandboxFailure = webhookFailure(sandboxError);
      if (sandboxFailure === "malformed") send(res, 400, { error: "The publishing webhook is not valid.", code: "malformed" });
      else if (sandboxFailure === "signature") send(res, 400, { error: "The publishing webhook is not valid.", code: "invalid-signature" });
      else send(res, 503, { error: UNAVAILABLE, code: "unavailable" });
      return;
    }
  }
  if (sandboxSigned) {
    const store = options.sandboxStore ?? sandboxReceiptStore(env);
    if (!store) {
      send(res, 503, { error: UNAVAILABLE, code: "unavailable" });
      return;
    }
    try {
      const recorded = await recordSandboxWebhook({
        event,
        env,
        now: options.now,
        store,
        getPayment: options.getSandboxPayment,
      });
      if (recorded === "mismatch") {
        send(res, 400, { error: "The publishing webhook is not valid.", code: "not-verified" });
        return;
      }
      if (recorded === "unavailable") {
        send(res, 503, { error: UNAVAILABLE, code: "unavailable" });
        return;
      }
    } catch {
      send(res, 503, { error: UNAVAILABLE, code: "unavailable" });
      return;
    }
    send(res, 200, { received: true });
    return;
  }
  const domainReference = eventReference(event);
  if (domainReference.startsWith("domain:")) {
    if (!parseDomainPaymentReference(domainReference) || sandboxFirestoreBlocked(env)) {
      send(res, 503, { error: UNAVAILABLE, code: "unavailable" });
      return;
    }
    if (!options.settleDomainPayment) {
      send(res, 503, { error: UNAVAILABLE, code: "unavailable" });
      return;
    }
    try {
      const settled = await options.settleDomainPayment(event, env);
      if (settled === "unavailable") {
        send(res, 503, { error: UNAVAILABLE, code: "unavailable" });
        return;
      }
    } catch {
      send(res, 503, { error: UNAVAILABLE, code: "unavailable" });
      return;
    }
    send(res, 200, { received: true });
    return;
  }
  if (event.type === "collection.succeeded" || event.type === "refund.paid" || event.type === "refund.created" || event.type === "refund.failed") {
    try {
      const settlement = await settleVerifiedEvent(event, env, options);
      if (settlement.kind === "missing" || settlement.kind === "unverified" || settlement.kind === "mismatch") {
        send(res, 400, { error: "The publishing webhook is not valid.", code: "not-verified" });
        return;
      }
    } catch (error) {
      if (error instanceof PublishingLedgerError && error.outcome !== "unavailable") {
        send(res, 400, { error: "The publishing webhook is not valid.", code: error.outcome });
        return;
      }
      send(res, 503, { error: UNAVAILABLE, code: "unavailable" });
      return;
    }
  }
  send(res, 200, { received: true });
}

async function settleVerifiedEvent(
  event: WebhookEvent,
  env: NodeJS.ProcessEnv,
  options: BachsWebhookHandlerOptions,
): Promise<PublishingSettlement> {
  if (event.type === "collection.succeeded") {
    const recorded = await (options.ingestCollection ?? ingestVerifiedCollection)({
      event,
      env,
      now: options.now,
      ...options.collectionLedger,
    });
    if (!("document" in recorded)) throw new PublishingLedgerError("not-verified");
    return (options.settleCollection ?? settleRecordedCollection)({
      env,
      paymentId: recorded.document.paymentId,
      db: options.firestore,
    });
  }
  // refund.created and refund.failed record that a refund was opened or did not complete.
  // They do not revoke publishing. A completed provider reversal arrives as refund.paid.
  if (event.type !== "refund.paid") return { kind: "kept", expiresAt: null };
  return (options.settleRefund ?? settleRefundEvent)({
    event,
    env,
    db: options.firestore,
    now: options.now,
  });
}
