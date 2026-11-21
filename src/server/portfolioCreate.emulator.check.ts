import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { createPortfolioForAccount, PortfolioCreateError } from "./portfolioCreate";
import { handlePortfolioCreate, handlePortfolioPolicy } from "./portfolioCreateHandler";

const emulator = process.env.FIRESTORE_EMULATOR_HOST ?? "";
if (emulator !== "127.0.0.1:8080") {
  throw new Error("Refusing to run portfolio creation checks outside the local Firestore emulator.");
}

const app = initializeApp({ projectId: "demo-custom-portfolio" }, "portfolio-create-emulator");
const db = getFirestore(app);
const env = {
  VERCEL_ENV: "",
  FIREBASE_PROJECT_ID: "custom-by-broadbrand",
  VITE_FIREBASE_PROJECT_ID: "custom-by-broadbrand",
  PORTFOLIO_POLICY_EFFECTIVE_AT: "2026-06-01T00:00:00.000Z",
};

function responseCapture() {
  let statusCode = 0;
  let payload = "";
  return {
    status(code: number) {
      statusCode = code;
      return this;
    },
    setHeader() {
      return undefined;
    },
    end(body: string) {
      payload = body;
    },
    read() {
      return { statusCode, body: payload ? JSON.parse(payload) as Record<string, unknown> : {} };
    },
  };
}

async function owned(uid: string) {
  const snap = await db.collection("portfolios").where("ownerId", "==", uid).get();
  return snap.docs.map((item) => item.id);
}

async function removeAccount(uid: string) {
  const portfolios = await db.collection("portfolios").where("ownerId", "==", uid).get();
  for (const item of portfolios.docs) {
    await db.collection("portfolioIds").doc(item.id).delete();
    await item.ref.delete();
  }
  await db.collection("accountPortfolios").doc(uid).delete();
  await db.collection("users").doc(uid).delete();
  const requests = await db.collection("portfolioCreateRequests").doc(uid).collection("items").get();
  for (const item of requests.docs) await item.ref.delete();
}

let requestSerial = 0;
function nextRequestId(): string {
  requestSerial += 1;
  return `11111111-1111-4111-8111-${String(requestSerial).padStart(12, "0")}`;
}

function templateRequest(templateId = "wdk-premium-portfolio-1", requestId = nextRequestId()) {
  return { purpose: "template" as const, templateId, requestId };
}

try {
  const legacyUid = "policy-legacy-user";
  await removeAccount(legacyUid);
  await db.collection("users").doc(legacyUid).set({ displayName: "Legacy Owner" });
  const first = await createPortfolioForAccount({
    db,
    uid: legacyUid,
    request: templateRequest(),
    account: { uid: legacyUid, email: "", displayName: "Legacy Owner", photoURL: null, createdAt: null, updatedAt: null, onboardingCompleted: false },
  });
  await db.collection("portfolios").doc(first.portfolioId).update({ headline: "unchanged legacy" });
  const storedRequestId = (await db.collection("portfolioCreateRequests").doc(legacyUid).collection("items").get()).docs[0]?.id;
  if (typeof storedRequestId !== "string") throw new Error("The create request was not stored.");
  const originalRequestId = storedRequestId;
  const retried = await createPortfolioForAccount({
    db,
    uid: legacyUid,
    request: templateRequest("wdk-premium-portfolio-1", originalRequestId),
    account: null,
  });
  assert.equal(retried.outcome, "existing");
  assert.equal(retried.portfolioId, first.portfolioId);
  await assert.rejects(
    () => createPortfolioForAccount({
      db,
      uid: legacyUid,
      request: templateRequest(),
      account: null,
    }),
    (error: unknown) => error instanceof PortfolioCreateError && error.code === "portfolio-exists",
  );
  assert.equal((await db.collection("accountPortfolios").doc(legacyUid).get()).exists, false);
  assert.equal((await db.collection("portfolios").doc(first.portfolioId).get()).get("headline"), "unchanged legacy");
  assert.equal((await db.collection("portfolios").doc(first.portfolioId).get()).get("selectedTemplate"), "wdk-premium-portfolio-1");
  assert.equal((await owned(legacyUid)).length, 1);
  const racedSameRequest = await Promise.all([
    createPortfolioForAccount({
      db,
      uid: legacyUid,
      request: templateRequest("wdk-premium-portfolio-1", originalRequestId),
      account: null,
    }),
    createPortfolioForAccount({
      db,
      uid: legacyUid,
      request: templateRequest("wdk-premium-portfolio-1", originalRequestId),
      account: null,
    }),
  ]);
  assert.equal(new Set(racedSameRequest.map((item) => item.portfolioId)).size, 1);
  assert.equal((await owned(legacyUid)).length, 1);
  assert.equal((await db.collection("portfolios").doc(first.portfolioId).get()).get("headline"), "unchanged legacy");

  const boundaryUid = "policy-boundary-user";
  await removeAccount(boundaryUid);
  await db.collection("accountPortfolios").doc(boundaryUid).set({ portfolioId: "historical-lock" });
  const boundary = await createPortfolioForAccount({
    db,
    uid: boundaryUid,
    request: templateRequest(),
    account: null,
  });
  await assert.rejects(
    () => createPortfolioForAccount({
      db,
      uid: boundaryUid,
      request: templateRequest(),
      account: null,
    }),
    (error: unknown) => error instanceof PortfolioCreateError && error.code === "portfolio-exists",
  );
  assert.equal(boundary.outcome, "created");
  assert.equal((await db.collection("accountPortfolios").doc(boundaryUid).get()).get("portfolioId"), "historical-lock");
  assert.equal((await owned(boundaryUid)).length, 1);
  assert.equal((await db.collection("portfolios").doc(boundary.portfolioId).get()).get("published"), false);

  const newUid = "policy-new-user";
  await removeAccount(newUid);
  const raced = await Promise.allSettled([
    createPortfolioForAccount({
      db,
      uid: newUid,
      request: templateRequest(),
      account: null,
    }),
    createPortfolioForAccount({
      db,
      uid: newUid,
      request: templateRequest(),
      account: null,
    }),
  ]);
  assert.equal((await owned(newUid)).length, 1);
  const winner = raced.find((item) => item.status === "fulfilled");
  assert.equal(winner?.status, "fulfilled");
  if (winner?.status !== "fulfilled") throw new Error("One raced create should succeed.");
  assert.equal((await db.collection("accountPortfolios").doc(newUid).get()).exists, false);
  assert.equal((await db.collection("portfolios").doc(winner.value.portfolioId).get()).get("ownerId"), newUid);
  assert.equal((await db.collection("portfolios").doc(winner.value.portfolioId).get()).get("published"), false);

  const freshUid = "policy-fresh-user";
  await removeAccount(freshUid);
  const fresh = await createPortfolioForAccount({
    db,
    uid: freshUid,
    request: templateRequest(),
    account: null,
  });
  assert.equal(fresh.outcome, "created");
  assert.equal((await db.collection("portfolioIds").doc(fresh.portfolioId).get()).get("portfolioId"), fresh.portfolioId);

  const failedUid = "policy-failed-user";
  await removeAccount(failedUid);
  await assert.rejects(
    () => createPortfolioForAccount({
      db,
      uid: failedUid,
      request: templateRequest(),
      account: null,
      beforeCommit() {
        throw new Error("stop before commit");
      },
    }),
    (error: unknown) => error instanceof Error && error.message === "stop before commit",
  );
  assert.deepEqual(await owned(failedUid), []);
  assert.equal((await db.collection("accountPortfolios").doc(failedUid).get()).exists, false);
  assert.equal((await db.collection("portfolioCreateRequests").doc(failedUid).collection("items").get()).size, 0);

  const unreadable = await createPortfolioForAccount({
    db,
    uid: "policy-unreadable-user",
    request: templateRequest(),
    account: null,
  });
  assert.equal(unreadable.outcome, "created");
  assert.equal((await db.collection("portfolios").doc(unreadable.portfolioId).get()).get("ownerId"), "policy-unreadable-user");

  const denied = responseCapture();
  await handlePortfolioCreate(
    { method: "POST", headers: {}, body: { purpose: "template", templateId: "wdk-premium-portfolio-1" } },
    denied,
    { env, firestore: db, verify: async () => ({ uid: "unused" }), readCreationTime: async () => "2026-08-01T00:00:00.000Z" },
  );
  assert.equal(denied.read().statusCode, 401);

  const forged = responseCapture();
  await handlePortfolioCreate(
    {
      method: "POST",
      headers: { authorization: "Bearer test-token" },
      body: { purpose: "template", templateId: "wdk-premium-portfolio-1", ownerId: "someone-else", creationTime: "2000-01-01T00:00:00.000Z" },
    },
    forged,
    {
      env,
      firestore: db,
      verify: async () => ({ uid: "policy-forged-user" }),
      readCreationTime: async () => "2026-09-01T00:00:00.000Z",
    },
  );
  assert.equal(forged.read().statusCode, 400);
  assert.deepEqual(await owned("policy-forged-user"), []);
  assert.deepEqual(await owned("someone-else"), []);

  const missingPolicy = responseCapture();
  await handlePortfolioCreate(
    {
      method: "POST",
      headers: { authorization: "Bearer test-token" },
      body: { purpose: "template", templateId: "wdk-premium-portfolio-1", requestId: "33333333-3333-4333-8333-333333333333" },
    },
    missingPolicy,
    {
      env: { ...env, PORTFOLIO_POLICY_EFFECTIVE_AT: "" },
      firestore: db,
      verify: async () => ({ uid: "policy-unconfigured-user" }),
      readCreationTime: async () => "2026-09-01T00:00:00.000Z",
    },
  );
  assert.equal(missingPolicy.read().statusCode, 200);
  assert.equal(missingPolicy.read().body.outcome, "created");
  assert.equal((await owned("policy-unconfigured-user")).length, 1);

  const created = responseCapture();
  await handlePortfolioCreate(
    {
      method: "POST",
      headers: { authorization: "Bearer test-token" },
      body: { purpose: "template", templateId: "wdk-premium-portfolio-1", requestId: "44444444-4444-4444-8444-444444444444" },
    },
    created,
    {
      env,
      firestore: db as Firestore,
      verify: async () => ({ uid: "policy-handler-user" }),
      readCreationTime: async () => "2026-10-01T00:00:00.000Z",
    },
  );
  assert.equal(created.read().statusCode, 200);
  const createdId = String(created.read().body.portfolioId);
  assert.equal((await db.collection("portfolios").doc(createdId).get()).get("ownerId"), "policy-handler-user");
  const retry = responseCapture();
  await handlePortfolioCreate(
    {
      method: "POST",
      headers: { authorization: "Bearer test-token" },
      body: { purpose: "template", templateId: "wdk-premium-portfolio-1", requestId: "44444444-4444-4444-8444-444444444444" },
    },
    retry,
    {
      env,
      firestore: db,
      verify: async () => ({ uid: "policy-handler-user" }),
      readCreationTime: async () => "2026-10-01T00:00:00.000Z",
    },
  );
  assert.equal(retry.read().statusCode, 409);
  assert.equal(retry.read().body.portfolioId, createdId);
  const secondCreate = responseCapture();
  await handlePortfolioCreate(
    {
      method: "POST",
      headers: { authorization: "Bearer test-token" },
      body: { purpose: "template", templateId: "wdk-premium-portfolio-1", requestId: "55555555-5555-4555-8555-555555555555" },
    },
    secondCreate,
    {
      env,
      firestore: db,
      verify: async () => ({ uid: "policy-handler-user" }),
      readCreationTime: async () => "2026-10-01T00:00:00.000Z",
    },
  );
  assert.equal(secondCreate.read().statusCode, 409);
  assert.equal(secondCreate.read().body.code, "portfolio-exists");
  assert.equal((await owned("policy-handler-user")).length, 1);
  assert.equal((await db.collection("accountPortfolios").doc("policy-handler-user").get()).exists, false);

  const legacyPolicy = responseCapture();
  await handlePortfolioPolicy(
    { method: "GET", headers: { authorization: "Bearer test-token" } },
    legacyPolicy,
    { env, verify: async () => ({ uid: "policy-legacy-user" }), readCreationTime: async () => "2026-05-01T00:00:00.000Z" },
  );
  assert.equal(legacyPolicy.read().statusCode, 200);
  assert.deepEqual(legacyPolicy.read().body, { policy: "legacy" });
  const restrictedPolicy = responseCapture();
  await handlePortfolioPolicy(
    { method: "GET", headers: { authorization: "Bearer test-token" } },
    restrictedPolicy,
    { env, verify: async () => ({ uid: "policy-new-user" }), readCreationTime: async () => "2026-07-01T00:00:00.000Z" },
  );
  assert.deepEqual(restrictedPolicy.read().body, { policy: "restricted" });
  const closedPolicy = responseCapture();
  await handlePortfolioPolicy(
    { method: "GET", headers: { authorization: "Bearer test-token" } },
    closedPolicy,
    {
      env: { ...env, PORTFOLIO_POLICY_EFFECTIVE_AT: "" },
      verify: async () => ({ uid: "policy-unconfigured-user" }),
      readCreationTime: async () => "2026-05-01T00:00:00.000Z",
    },
  );
  assert.equal(closedPolicy.read().statusCode, 503);
  assert.equal(closedPolicy.read().body.code, "policy-unconfigured");
  const anonymousPolicy = responseCapture();
  await handlePortfolioPolicy(
    { method: "GET", headers: {} },
    anonymousPolicy,
    { env, verify: async () => ({ uid: "unused" }), readCreationTime: async () => "2026-05-01T00:00:00.000Z" },
  );
  assert.equal(anonymousPolicy.read().statusCode, 401);

  const creativeUid = "policy-creative-user";
  await removeAccount(creativeUid);
  const creativeFirst = await createPortfolioForAccount({
    db,
    uid: creativeUid,
    request: templateRequest("the-creative"),
    account: null,
  });
  assert.equal(creativeFirst.outcome, "created");
  assert.equal((await db.collection("portfolios").doc(creativeFirst.portfolioId).get()).get("selectedTemplate"), "the-creative");
  assert.equal((await owned(creativeUid)).length, 1);
  await assert.rejects(
    () => createPortfolioForAccount({
      db,
      uid: creativeUid,
      request: templateRequest("the-creative"),
      account: null,
    }),
    (error: unknown) => error instanceof PortfolioCreateError && error.code === "portfolio-exists",
  );
  assert.equal((await owned(creativeUid)).length, 1);
} finally {
  for (const uid of [
    "policy-legacy-user",
    "policy-boundary-user",
    "policy-new-user",
    "policy-fresh-user",
    "policy-failed-user",
    "policy-forged-user",
    "policy-unreadable-user",
    "policy-unconfigured-user",
    "policy-handler-user",
    "policy-creative-user",
    "someone-else",
  ]) {
    await removeAccount(uid);
  }
}

console.log("portfolio creation emulator checks passed");
process.exit(0);
