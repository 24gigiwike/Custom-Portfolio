import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, runTransaction, updateDoc, type Firestore } from "firebase/firestore";
import { commitPublicSlug, inspectPublicSlug } from "./portfolioSlugAccess";
import {
  SLUG_CHECK_MESSAGE,
  slugAvailabilityMessage,
  slugClaimMessage,
  resolvePublicAddress,
} from "./portfolioSlug";

const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
const testEnv = await initializeTestEnvironment({
  projectId: "demo-custom-portfolio",
  firestore: { rules, host: "127.0.0.1", port: 8080 },
});

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function portfolioDoc(ownerId: string) {
  return {
    ownerId,
    selectedTemplate: "wdk-premium-portfolio-1",
    publicSlug: "",
    publicSlugAliases: [],
    publishing: { status: "draft" },
    profile: {
      brandName: "Ada",
      logo: "",
      heroImage: "",
      heroImageMobile: "",
      headline: "Notes",
      capabilityTags: [],
      ctaLabel: "",
      ctaHref: "",
      email: "",
    },
  };
}

function shape(id: string, ownerId: string) {
  return { id, ownerId, publicSlug: "", publicSlugAliases: [] as string[] };
}

try {
  await testEnv.clearFirestore();
  const owner = testEnv.authenticatedContext("owner-a");
  const other = testEnv.authenticatedContext("owner-b");
  const anon = testEnv.unauthenticatedContext();
  const ownerDb = owner.firestore() as unknown as Firestore;
  const otherDb = other.firestore() as unknown as Firestore;
  const anonDb = anon.firestore() as unknown as Firestore;

  await runTransaction(ownerDb, async (transaction) => {
    transaction.set(doc(ownerDb, "portfolios", "slugPortA"), portfolioDoc("owner-a"));
    transaction.set(doc(ownerDb, "portfolioIds", "slugPortA"), { portfolioId: "slugPortA" });
  });
  await runTransaction(otherDb, async (transaction) => {
    transaction.set(doc(otherDb, "portfolios", "slugPortB"), portfolioDoc("owner-b"));
    transaction.set(doc(otherDb, "portfolioIds", "slugPortB"), { portfolioId: "slugPortB" });
  });

  const missing = await getDoc(doc(ownerDb, "portfolioSlugs", "motionbyjp"));
  assert.equal(missing.exists(), false);
  const available = await inspectPublicSlug(ownerDb, "owner-a", shape("slugPortA", "owner-a"), "motionbyjp");
  assert.equal(available.status, "available");
  assert.equal(slugAvailabilityMessage(available), null);

  await commitPublicSlug(ownerDb, "owner-a", "slugPortA", "motionbyjp");
  const claimed = await getDoc(doc(ownerDb, "portfolioSlugs", "motionbyjp"));
  assert.equal(claimed.exists(), true);
  assert.equal(claimed.data()?.portfolioId, "slugPortA");
  assert.equal(claimed.data()?.role, "active");
  assert.equal(claimed.data()?.ownerId, undefined);
  const stored = await getDoc(doc(ownerDb, "portfolios", "slugPortA"));
  assert.equal(stored.id, "slugPortA");
  assert.equal(stored.data()?.publicSlug, "motionbyjp");
  assert.equal(stored.data()?.ownerId, "owner-a");

  await assertFails(getDoc(doc(anonDb, "portfolioSlugs", "motionbyjp")));
  const visibleToOther = await getDoc(doc(otherDb, "portfolioSlugs", "motionbyjp"));
  assert.equal(visibleToOther.data()?.portfolioId, "slugPortA");
  assert.equal(visibleToOther.data()?.ownerId, undefined);

  const taken = await inspectPublicSlug(otherDb, "owner-b", shape("slugPortB", "owner-b"), "motionbyjp");
  assert.equal(taken.status, "taken");
  assert.equal(slugAvailabilityMessage(taken), "That address is already taken.");
  await assert.rejects(
    () => commitPublicSlug(otherDb, "owner-b", "slugPortB", "motionbyjp"),
    (error: unknown) => {
      assert.equal(messageOf(error), "That address is already taken.");
      return true;
    },
  );
  const otherPortfolio = await getDoc(doc(otherDb, "portfolios", "slugPortB"));
  assert.equal(otherPortfolio.data()?.publicSlug, "");

  const second = await inspectPublicSlug(ownerDb, "owner-a", {
    id: "slugPortA",
    ownerId: "owner-a",
    publicSlug: "motionbyjp",
    publicSlugAliases: [],
  }, "studio-two");
  assert.equal(second.status, "available");

  const anonClaim = await commitPublicSlug(anonDb, "owner-a", "slugPortA", "sneaky-name").catch((error: unknown) => error);
  assert.equal((await getDoc(doc(ownerDb, "portfolioSlugs", "sneaky-name"))).exists(), false);
  assert.notEqual(messageOf(anonClaim), slugClaimMessage("taken"));

  const reserved = await inspectPublicSlug(ownerDb, "owner-a", shape("slugPortA", "owner-a"), "admin");
  assert.equal(reserved.status, "reserved");
  assert.equal(slugAvailabilityMessage(reserved), "That address is reserved.");
  await assert.rejects(
    () => commitPublicSlug(ownerDb, "owner-a", "slugPortA", "admin"),
    (error: unknown) => {
      assert.equal(messageOf(error), "That address is reserved.");
      return true;
    },
  );

  const denied = await inspectPublicSlug(anonDb, "owner-a", shape("slugPortA", "owner-a"), "brand-new-name");
  assert.equal(denied.status, "unchecked");
  if (denied.status === "unchecked") assert.equal(denied.message, SLUG_CHECK_MESSAGE);
  assert.notEqual(slugAvailabilityMessage(denied), slugClaimMessage("taken"));

  await assertFails(getDocs(collection(ownerDb, "portfolioSlugs")));
  await assertFails(getDocs(collection(anonDb, "portfolioSlugs")));
  await assertFails(getDoc(doc(anonDb, "portfolios", "slugPortA")));

  const first = testEnv.authenticatedContext("owner-c").firestore() as unknown as Firestore;
  const secondWriter = testEnv.authenticatedContext("owner-d").firestore() as unknown as Firestore;
  await runTransaction(first, async (transaction) => {
    transaction.set(doc(first, "portfolios", "slugPortC"), portfolioDoc("owner-c"));
    transaction.set(doc(first, "portfolioIds", "slugPortC"), { portfolioId: "slugPortC" });
  });
  await runTransaction(secondWriter, async (transaction) => {
    transaction.set(doc(secondWriter, "portfolios", "slugPortD"), portfolioDoc("owner-d"));
    transaction.set(doc(secondWriter, "portfolioIds", "slugPortD"), { portfolioId: "slugPortD" });
  });
  const race = await Promise.allSettled([
    commitPublicSlug(first, "owner-c", "slugPortC", "shared-studio"),
    commitPublicSlug(secondWriter, "owner-d", "slugPortD", "shared-studio"),
  ]);
  const fulfilled = race.filter((result) => result.status === "fulfilled");
  const rejected = race.filter((result) => result.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  if (rejected[0]?.status === "rejected") {
    assert.equal(messageOf(rejected[0].reason), "That address is already taken.");
  }
  const shared = await getDoc(doc(first, "portfolioSlugs", "shared-studio"));
  assert.equal(shared.exists(), true);
  assert.ok(shared.data()?.portfolioId === "slugPortC" || shared.data()?.portfolioId === "slugPortD");

  await updateDoc(doc(ownerDb, "portfolios", "slugPortA"), {
    publishing: { status: "published" },
  });
  await commitPublicSlug(ownerDb, "owner-a", "slugPortA", "motion-studio");
  const alias = await getDoc(doc(ownerDb, "portfolioSlugs", "motionbyjp"));
  assert.equal(alias.data()?.role, "alias");
  assert.equal(alias.data()?.portfolioId, "slugPortA");
  const active = await getDoc(doc(ownerDb, "portfolioSlugs", "motion-studio"));
  assert.equal(active.data()?.role, "active");
  const published = await getDoc(doc(ownerDb, "publicPortfolios", "slugPortA"));
  assert.equal(published.data()?.publicSlug, "motion-studio");
  const sitemap = await getDoc(doc(ownerDb, "sitemapEntries", "slugPortA"));
  assert.equal(sitemap.data()?.slug, "motion-studio");
  assert.equal(sitemap.data()?.publicId, "slugPortA");
  await assert.rejects(
    () => commitPublicSlug(otherDb, "owner-b", "slugPortB", "motionbyjp"),
    (error: unknown) => {
      assert.equal(messageOf(error), "That address is already taken.");
      return true;
    },
  );

  assert.deepEqual(resolvePublicAddress({
    requested: "slugPortA",
    byId: { publicId: "slugPortA", publicSlug: "motion-studio" },
    slugRecord: null,
    bySlug: null,
  }), { action: "redirect", segment: "motion-studio" });
  assert.deepEqual(resolvePublicAddress({
    requested: "motionbyjp",
    byId: null,
    slugRecord: { portfolioId: "slugPortA", role: "alias" },
    bySlug: { publicId: "slugPortA", publicSlug: "motion-studio" },
  }), { action: "redirect", segment: "motion-studio" });
  assert.deepEqual(resolvePublicAddress({
    requested: "motion-studio",
    byId: null,
    slugRecord: { portfolioId: "slugPortA", role: "active" },
    bySlug: { publicId: "slugPortA", publicSlug: "motion-studio" },
  }), { action: "serve", portfolioId: "slugPortA" });
} finally {
  await testEnv.cleanup();
}

console.log("portfolio slug availability checks passed");
