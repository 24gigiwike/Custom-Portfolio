import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";

const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");

const testEnv = await initializeTestEnvironment({
  projectId: "demo-custom-portfolio",
  firestore: { rules, host: "127.0.0.1", port: 8080 },
});

function publicBody(publicId: string, publicSlug = "") {
  return {
    publicId,
    selectedTemplate: "wdk-premium-portfolio-1",
    profile: {
      brandName: "Ada",
      logo: "",
      heroImage: "https://example.com/portrait.jpg",
      heroImageMobile: "",
      headline: "Notes",
      capabilityTags: [],
      ctaLabel: "",
      ctaHref: "",
      email: "",
    },
    socialLinks: [],
    projects: [],
    contact: {
      email: "",
      eyebrow: "",
      heading: "Hello",
      description: "",
      projectTypes: [],
      formEndpoint: "",
    },
    seo: {
      title: "",
      description: "",
      canonicalUrl: "",
      ogTitle: "",
      ogDescription: "",
      ogImage: "",
      twitterTitle: "",
      twitterDescription: "",
      twitterImage: "",
    },
    design: { palette: "original" },
    publicSlug,
    publishedAt: null,
    updatedAt: serverTimestamp(),
  };
}

function draftPortfolio(ownerId: string) {
  return {
    ownerId,
    publishing: { status: "draft" },
    published: false,
    publicSlug: "",
    publicSlugAliases: [],
    design: { palette: "original" },
    profile: { brandName: "Ada", headline: "Notes" },
  };
}

function publishedPortfolio(ownerId: string) {
  return {
    ...draftPortfolio(ownerId),
    publishing: { status: "published", publishedAt: null },
    published: true,
  };
}

const publishFields = {
  publishing: { status: "published", publishedAt: null },
  published: true,
};

async function seed(write: (db: ReturnType<ReturnType<typeof testEnv.authenticatedContext>["firestore"]>) => Promise<void>) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await write(context.firestore());
  });
}

try {
  await testEnv.clearFirestore();
  const owner = testEnv.authenticatedContext("owner-a");
  const other = testEnv.authenticatedContext("owner-b");
  const anon = testEnv.unauthenticatedContext();
  const ownerDb = owner.firestore();
  const otherDb = other.firestore();
  const anonDb = anon.firestore();

  await assertFails(setDoc(doc(ownerDb, "publishingEntitlements", "owner-a"), {
    uid: "owner-a",
    status: "active",
    source: "payment",
  }));
  await assertFails(setDoc(doc(ownerDb, "portfolioPublishingEntitlements", "port-free"), {
    uid: "owner-a",
    portfolioId: "port-free",
    status: "active",
    source: "payment",
    paymentId: "pay-1",
  }));
  await assertFails(setDoc(doc(ownerDb, "payments", "pay-1"), {
    paymentId: "pay-1",
    uid: "owner-a",
    provider: "unchecked",
    amount: 10000,
    currency: "NGN",
    providerReference: "ref",
    status: "verified",
  }));
  await assertFails(setDoc(doc(ownerDb, "publishingControls", "gate"), { enabled: false }));
  await assertFails(setDoc(doc(anonDb, "publishingEntitlements", "owner-a"), { uid: "owner-a", status: "active" }));

  await seed(async (db) => {
    await setDoc(doc(db, "publishingEntitlements", "owner-a"), {
      uid: "owner-a",
      status: "active",
      source: "grandfathered",
      paymentId: null,
      providerReference: null,
      schemaVersion: 1,
    });
    await setDoc(doc(db, "payments", "pay-1"), {
      paymentId: "pay-1",
      uid: "owner-a",
      provider: "unchecked",
      amount: 10000,
      currency: "NGN",
      providerReference: "ref-1",
      status: "pending",
    });
  });

  await assertSucceeds(getDoc(doc(ownerDb, "publishingEntitlements", "owner-a")));
  await assertFails(getDoc(doc(otherDb, "publishingEntitlements", "owner-a")));
  await assertFails(updateDoc(doc(ownerDb, "publishingEntitlements", "owner-a"), { status: "active", source: "payment" }));
  await assertFails(deleteDoc(doc(ownerDb, "publishingEntitlements", "owner-a")));
  await assertSucceeds(getDoc(doc(ownerDb, "payments", "pay-1")));
  await assertFails(getDoc(doc(otherDb, "payments", "pay-1")));
  await assertFails(updateDoc(doc(ownerDb, "payments", "pay-1"), { status: "verified" }));
  await assertFails(deleteDoc(doc(ownerDb, "payments", "pay-1")));
  const entitlementBefore = await getDoc(doc(ownerDb, "publishingEntitlements", "owner-a"));
  assert.equal(entitlementBefore.data()?.source, "grandfathered");

  await testEnv.clearFirestore();

  await assertFails(setDoc(doc(ownerDb, "portfolios", "port-client-create"), draftPortfolio("owner-a")));
  await assertFails(setDoc(doc(anonDb, "portfolios", "port-anon-create"), draftPortfolio("owner-a")));
  await assertFails(setDoc(doc(ownerDb, "accountPortfolios", "owner-a"), { portfolioId: "port-free" }));
  await seed(async (db) => {
    await setDoc(doc(db, "portfolios", "port-free"), draftPortfolio("owner-a"));
    await setDoc(doc(db, "accountPortfolios", "owner-a"), { portfolioId: "port-free" });
  });
  await assertFails(updateDoc(doc(ownerDb, "accountPortfolios", "owner-a"), { portfolioId: "other" }));
  await assertFails(deleteDoc(doc(ownerDb, "accountPortfolios", "owner-a")));
  await assertFails(getDoc(doc(ownerDb, "accountPortfolios", "owner-a")));
  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-free"), {
    profile: { brandName: "Ada", headline: "Saved as a draft" },
    design: { palette: "ink" },
  }));
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-free"), publishFields));
  await assertFails(setDoc(doc(ownerDb, "portfolios", "port-created-missing"), publishedPortfolio("owner-a")));
  await assertFails(setDoc(doc(ownerDb, "publicPortfolios", "port-free"), publicBody("port-free")));
  await assertFails(setDoc(doc(ownerDb, "sitemapEntries", "port-free"), {
    publicId: "port-free",
    slug: "",
    updatedAt: serverTimestamp(),
  }));
  const stillDraft = await getDoc(doc(ownerDb, "portfolios", "port-free"));
  assert.equal(stillDraft.data()?.publishing.status, "draft");
  await assertFails(getDoc(doc(anonDb, "portfolios", "port-free")));

  await seed(async (db) => {
    await setDoc(doc(db, "portfolios", "port-kept"), publishedPortfolio("owner-a"));
    await setDoc(doc(db, "publicPortfolios", "port-kept"), publicBody("port-kept"));
    await setDoc(doc(db, "sitemapEntries", "port-kept"), {
      publicId: "port-kept",
      slug: "",
      updatedAt: new Date(),
    });
  });
  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-kept"), {
    profile: { brandName: "Ada", headline: "Saved while live" },
  }));
  await assertSucceeds(setDoc(doc(ownerDb, "publicPortfolios", "port-kept"), publicBody("port-kept")));
  await assertFails(getDoc(doc(anonDb, "publicPortfolios", "port-kept")));
  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-kept"), {
    publishing: { status: "draft", publishedAt: null },
    published: false,
  }));
  await assertSucceeds(deleteDoc(doc(ownerDb, "publicPortfolios", "port-kept")));
  await assertSucceeds(deleteDoc(doc(ownerDb, "sitemapEntries", "port-kept")));
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-kept"), publishFields));

  await seed(async (db) => {
    await setDoc(doc(db, "publishingControls", "gate"), { enabled: true });
  });

  await seed(async (db) => {
    await setDoc(doc(db, "portfolios", "port-unpaid"), draftPortfolio("owner-a"));
  });
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-unpaid"), publishFields));
  await assertFails(setDoc(doc(ownerDb, "portfolios", "port-created-live"), publishedPortfolio("owner-a")));
  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-unpaid"), {
    profile: { brandName: "Ada", headline: "Still a draft" },
    design: { palette: "ink" },
    publicSlug: "ada-notes",
    publicSlugAliases: [],
  }));
  await assertSucceeds(setDoc(doc(ownerDb, "portfolioSlugs", "ada-notes"), {
    slug: "ada-notes",
    portfolioId: "port-unpaid",
    role: "active",
  }));

  await seed(async (db) => {
    await setDoc(doc(db, "publishingEntitlements", "owner-a"), {
      uid: "owner-a",
      status: "inactive",
      source: "payment",
      schemaVersion: 1,
    });
  });
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-unpaid"), publishFields));
  await seed(async (db) => {
    await setDoc(doc(db, "publishingEntitlements", "owner-a"), {
      uid: "owner-b",
      status: "active",
      source: "payment",
      schemaVersion: 1,
    });
  });
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-unpaid"), publishFields));
  await seed(async (db) => {
    await deleteDoc(doc(db, "publishingEntitlements", "owner-a"));
    await setDoc(doc(db, "payments", "pay-verified"), {
      paymentId: "pay-verified",
      uid: "owner-a",
      provider: "unchecked",
      amount: 10000,
      currency: "NGN",
      providerReference: "ref-verified",
      status: "verified",
    });
    await setDoc(doc(db, "payments", "pay-pending"), {
      paymentId: "pay-pending",
      uid: "owner-a",
      provider: "unchecked",
      amount: 10000,
      currency: "NGN",
      providerReference: "ref-pending",
      status: "pending",
    });
    await setDoc(doc(db, "payments", "pay-failed"), {
      paymentId: "pay-failed",
      uid: "owner-a",
      provider: "unchecked",
      amount: 10000,
      currency: "NGN",
      providerReference: "ref-failed",
      status: "failed",
    });
  });
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-unpaid"), publishFields));
  await assertFails(setDoc(doc(ownerDb, "portfolios", "port-unpaid"), publishedPortfolio("owner-a")));
  await assertFails(updateDoc(doc(ownerDb, "payments", "pay-pending"), { status: "verified" }));
  await assertFails(deleteDoc(doc(ownerDb, "payments", "pay-verified")));

  const accountOnly = {
    uid: "owner-a",
    status: "active",
    source: "payment",
    paymentId: "pay-verified",
    providerReference: "ref-verified",
    grantedAt: "2026-01-01T00:00:00.000Z",
    grantReason: "verified-payment",
    schemaVersion: 1,
  };
  await seed(async (db) => {
    await setDoc(doc(db, "publishingEntitlements", "owner-a"), accountOnly);
    await setDoc(doc(db, "portfolios", "port-other"), draftPortfolio("owner-a"));
    await setDoc(doc(db, "portfolioPublishingEntitlements", "port-other"), {
      ...accountOnly,
      portfolioId: "port-other",
    });
  });
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-unpaid"), publishFields));
  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-other"), publishFields));
  assert.deepEqual((await getDoc(doc(ownerDb, "publishingEntitlements", "owner-a"))).data(), accountOnly);
  await seed(async (db) => {
    await setDoc(doc(db, "portfolioPublishingEntitlements", "port-unpaid"), {
      ...accountOnly,
      portfolioId: "port-unpaid",
    });
  });
  await assertFails(updateDoc(doc(ownerDb, "portfolioPublishingEntitlements", "port-unpaid"), { status: "active" }));
  await assertFails(deleteDoc(doc(ownerDb, "portfolioPublishingEntitlements", "port-unpaid")));
  await assertSucceeds(getDoc(doc(ownerDb, "portfolioPublishingEntitlements", "port-unpaid")));
  await assertFails(getDoc(doc(otherDb, "portfolioPublishingEntitlements", "port-unpaid")));
  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-unpaid"), publishFields));
  await assertSucceeds(setDoc(doc(ownerDb, "publicPortfolios", "port-unpaid"), publicBody("port-unpaid", "ada-notes")));
  await assertSucceeds(setDoc(doc(ownerDb, "sitemapEntries", "port-unpaid"), {
    publicId: "port-unpaid",
    slug: "ada-notes",
    updatedAt: serverTimestamp(),
  }));
  await assertFails(getDoc(doc(anonDb, "publicPortfolios", "port-unpaid")));
  await assertFails(getDoc(doc(anonDb, "portfolios", "port-unpaid")));
  await assertFails(deleteDoc(doc(ownerDb, "publishingEntitlements", "owner-a")));
  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-unpaid"), {
    profile: { brandName: "Ada", headline: "Saved while published" },
  }));
  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-unpaid"), {
    publishing: { status: "draft", publishedAt: null },
    published: false,
  }));
  assert.equal((await getDoc(doc(ownerDb, "portfolioPublishingEntitlements", "port-unpaid"))).data()?.status, "active");
  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-unpaid"), publishFields));

  await seed(async (db) => {
    await deleteDoc(doc(db, "publishingEntitlements", "owner-a"));
    await setDoc(doc(db, "portfolios", "port-live"), publishedPortfolio("owner-a"));
    await setDoc(doc(db, "publicPortfolios", "port-live"), publicBody("port-live"));
  });
  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-live"), {
    profile: { brandName: "Ada", headline: "Still public" },
  }));
  await assertSucceeds(setDoc(doc(ownerDb, "publicPortfolios", "port-live"), publicBody("port-live")));
  await assertFails(getDoc(doc(anonDb, "publicPortfolios", "port-live")));
  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-live"), {
    publishing: { status: "draft", publishedAt: null },
    published: false,
  }));
  await assertSucceeds(deleteDoc(doc(ownerDb, "publicPortfolios", "port-live")));
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-live"), publishFields));

  const persist = testEnv.authenticatedContext("owner-persist");
  const persistDb = persist.firestore();
  const persistedEntitlement = {
    uid: "owner-persist",
    status: "active",
    source: "grandfathered",
    paymentId: null,
    providerReference: null,
    grantedAt: "2026-01-01T00:00:00.000Z",
    grantReason: "published-before-payment-gate",
    schemaVersion: 1,
  };
  const persistedPortfolioEntitlement = {
    ...persistedEntitlement,
    portfolioId: "port-persist",
  };
  await seed(async (db) => {
    await setDoc(doc(db, "portfolios", "port-persist"), {
      ...draftPortfolio("owner-persist"),
      publishing: { status: "published", publishedAt: null },
      published: true,
    });
    await setDoc(doc(db, "publishingEntitlements", "owner-persist"), persistedEntitlement);
    await setDoc(doc(db, "portfolioPublishingEntitlements", "port-persist"), persistedPortfolioEntitlement);
    await setDoc(doc(db, "publicPortfolios", "port-persist"), publicBody("port-persist"));
  });
  const persistedAtStart = await getDoc(doc(persistDb, "publishingEntitlements", "owner-persist"));
  assert.deepEqual(persistedAtStart.data(), persistedEntitlement);
  await assertSucceeds(updateDoc(doc(persistDb, "portfolios", "port-persist"), {
    publishing: { status: "draft", publishedAt: null },
    published: false,
  }));
  await assertSucceeds(deleteDoc(doc(persistDb, "publicPortfolios", "port-persist")));
  const persistedAfterUnpublish = await getDoc(doc(persistDb, "publishingEntitlements", "owner-persist"));
  assert.deepEqual(persistedAfterUnpublish.data(), persistedEntitlement);
  assert.deepEqual(
    (await getDoc(doc(persistDb, "portfolioPublishingEntitlements", "port-persist"))).data(),
    persistedPortfolioEntitlement,
  );
  await assertSucceeds(updateDoc(doc(persistDb, "portfolios", "port-persist"), {
    profile: { brandName: "Ada", headline: "Saved as a draft" },
    design: { palette: "ink" },
    publishing: { status: "draft" },
    published: false,
  }));
  await seed(async (db) => {
    await deleteDoc(doc(db, "portfolioPublishingEntitlements", "port-persist"));
  });
  await assertFails(updateDoc(doc(persistDb, "portfolios", "port-persist"), {
    publishing: { status: "published", publishedAt: null },
    published: true,
  }));
  assert.deepEqual((await getDoc(doc(persistDb, "publishingEntitlements", "owner-persist"))).data(), persistedEntitlement);
  await seed(async (db) => {
    await setDoc(doc(db, "portfolioPublishingEntitlements", "port-persist"), persistedPortfolioEntitlement);
  });
  await assertSucceeds(updateDoc(doc(persistDb, "portfolios", "port-persist"), {
    publishing: { status: "published", publishedAt: null },
    published: true,
  }));
  await assertSucceeds(setDoc(doc(persistDb, "publicPortfolios", "port-persist"), publicBody("port-persist")));
  assert.deepEqual((await getDoc(doc(persistDb, "publishingEntitlements", "owner-persist"))).data(), persistedEntitlement);
  await assertFails(deleteDoc(doc(persistDb, "publishingEntitlements", "owner-persist")));
  await assertFails(deleteDoc(doc(persistDb, "portfolioPublishingEntitlements", "port-persist")));

  await seed(async (db) => {
    await deleteDoc(doc(db, "publishingEntitlements", "owner-a"));
    await setDoc(doc(db, "publishingControls", "gate"), { enabled: false });
  });
  await seed(async (db) => {
    await setDoc(doc(db, "portfolios", "port-closed"), draftPortfolio("owner-a"));
  });
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-closed"), publishFields));
  await assertFails(setDoc(doc(ownerDb, "portfolios", "port-open-again"), publishedPortfolio("owner-a")));
  await seed(async (db) => {
    await setDoc(doc(db, "publishingEntitlements", "owner-a"), {
      uid: "owner-a",
      status: "active",
      source: "payment",
      paymentId: "pay-verified",
      providerReference: "ref-verified",
      schemaVersion: 1,
    });
    await setDoc(doc(db, "portfolioPublishingEntitlements", "port-closed"), {
      uid: "owner-a",
      portfolioId: "port-closed",
      status: "active",
      source: "payment",
      paymentId: "pay-verified",
      schemaVersion: 1,
    });
  });
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-closed"), publishFields));
  await assertFails(setDoc(doc(ownerDb, "portfolios", "port-disabled-create"), publishedPortfolio("owner-a")));
  await seed(async (db) => {
    await setDoc(doc(db, "publishingControls", "gate"), { enabled: "true" });
  });
  await assertFails(setDoc(doc(ownerDb, "portfolios", "port-malformed-gate"), publishedPortfolio("owner-a")));
  await seed(async (db) => {
    await setDoc(doc(db, "publishingControls", "gate"), { note: "present" });
  });
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-closed"), publishFields));

  await assertFails(updateDoc(doc(otherDb, "portfolios", "port-free"), {
    publishing: { status: "draft" },
    published: false,
  }));
  await assertFails(updateDoc(doc(otherDb, "portfolios", "port-unpaid"), publishFields));
  await assertFails(updateDoc(doc(ownerDb, "publishingControls", "gate"), { enabled: true }));
  await assertFails(deleteDoc(doc(ownerDb, "publishingControls", "gate")));
  await assertFails(updateDoc(doc(anonDb, "publishingControls", "gate"), { enabled: true }));

  await seed(async (db) => {
    await setDoc(doc(db, "portfolios", "port-choice"), {
      ownerId: "owner-a",
      selectedTemplate: "wdk-premium-portfolio-1",
      publishing: { status: "draft" },
      published: false,
    });
  });
  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-choice"), {
    profile: { brandName: "Ada", headline: "Still the same template" },
  }));
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-choice"), {
    selectedTemplate: "the-creative",
  }));
  await assertFails(deleteDoc(doc(ownerDb, "portfolios", "port-choice")));
  await seed(async (db) => {
    await setDoc(doc(db, "portfolios", "port-unselected"), {
      ownerId: "owner-a",
      publishing: { status: "draft" },
      published: false,
    });
  });
  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-unselected"), {
    selectedTemplate: "the-creative",
  }));
  await seed(async (db) => {
    await setDoc(doc(db, "portfolios", "port-template-public"), {
      ownerId: "owner-a",
      selectedTemplate: "wdk-premium-portfolio-1",
      publishing: { status: "published", publishedAt: null },
      published: true,
    });
  });
  await assertFails(setDoc(doc(ownerDb, "publicPortfolios", "port-template-public"), {
    ...publicBody("port-template-public"),
    selectedTemplate: "the-creative",
  }));
  await assertSucceeds(setDoc(doc(ownerDb, "publicPortfolios", "port-template-public"), publicBody("port-template-public")));

  const lockedOwner = testEnv.authenticatedContext("owner-locked");
  const lockedDb = lockedOwner.firestore();
  await seed(async (db) => {
    await setDoc(doc(db, "portfolios", "port-locked-blank"), {
      ownerId: "owner-locked",
      publishing: { status: "draft" },
      published: false,
      profile: { brandName: "Kept" },
    });
    await setDoc(doc(db, "accountPortfolios", "owner-locked"), { portfolioId: "port-locked-blank" });
    await setDoc(doc(db, "portfolios", "port-legacy-open"), {
      ownerId: "owner-b",
      publishing: { status: "draft" },
      published: false,
    });
    await setDoc(doc(db, "portfolioCreateRequests", "owner-locked", "items", "req-1"), {
      portfolioId: "port-locked-blank",
    });
  });
  await assertSucceeds(updateDoc(doc(lockedDb, "portfolios", "port-locked-blank"), {
    profile: { brandName: "Still kept" },
  }));
  await assertSucceeds(deleteDoc(doc(lockedDb, "portfolios", "port-locked-blank")));
  await seed(async (db) => {
    const lock = await getDoc(doc(db, "accountPortfolios", "owner-locked"));
    assert.equal(lock.exists(), true);
    assert.equal(lock.data()?.portfolioId, "port-locked-blank");
  });
  await assertFails(updateDoc(doc(lockedDb, "accountPortfolios", "owner-locked"), { portfolioId: "other" }));
  await assertFails(deleteDoc(doc(lockedDb, "accountPortfolios", "owner-locked")));
  await assertFails(getDoc(doc(lockedDb, "accountPortfolios", "owner-locked")));
  await assertFails(updateDoc(doc(lockedDb, "portfolioCreateRequests", "owner-locked", "items", "req-1"), {
    portfolioId: "other",
  }));
  await assertFails(deleteDoc(doc(lockedDb, "portfolioCreateRequests", "owner-locked", "items", "req-1")));
  await assertSucceeds(deleteDoc(doc(otherDb, "portfolios", "port-legacy-open")));

  const futureExpiry = Timestamp.fromMillis(Date.now() + 86_400_000);
  const pastExpiry = Timestamp.fromMillis(Date.now() - 86_400_000);
  const notAfterRequest = Timestamp.fromMillis(Date.now());
  function expiryEntitlement(portfolioId: string, uid: string, expiresAt?: unknown) {
    const record: Record<string, unknown> = {
      uid,
      portfolioId,
      status: "active",
      source: "grandfathered",
      paymentId: null,
      providerReference: null,
      grantedAt: "2026-01-01T00:00:00.000Z",
      grantReason: "published-before-payment-gate",
      schemaVersion: 1,
    };
    if (arguments.length > 2) record.expiresAt = expiresAt;
    return record;
  }

  await seed(async (db) => {
    await setDoc(doc(db, "publishingControls", "gate"), { enabled: true });
    await setDoc(doc(db, "portfolios", "port-expiry-future"), draftPortfolio("owner-a"));
    await setDoc(doc(db, "portfolioPublishingEntitlements", "port-expiry-future"), expiryEntitlement("port-expiry-future", "owner-a", futureExpiry));
    await setDoc(doc(db, "portfolios", "port-expiry-past"), draftPortfolio("owner-a"));
    await setDoc(doc(db, "portfolioPublishingEntitlements", "port-expiry-past"), expiryEntitlement("port-expiry-past", "owner-a", pastExpiry));
    await setDoc(doc(db, "portfolios", "port-expiry-now"), draftPortfolio("owner-a"));
    await setDoc(doc(db, "portfolioPublishingEntitlements", "port-expiry-now"), expiryEntitlement("port-expiry-now", "owner-a", notAfterRequest));
    await setDoc(doc(db, "portfolios", "port-expiry-grandfather"), draftPortfolio("owner-a"));
    await setDoc(doc(db, "portfolioPublishingEntitlements", "port-expiry-grandfather"), expiryEntitlement("port-expiry-grandfather", "owner-a"));
    await setDoc(doc(db, "portfolios", "port-expiry-string"), draftPortfolio("owner-a"));
    await setDoc(doc(db, "portfolioPublishingEntitlements", "port-expiry-string"), expiryEntitlement("port-expiry-string", "owner-a", "2099-01-01T00:00:00.000Z"));
    await setDoc(doc(db, "portfolios", "port-expiry-null"), draftPortfolio("owner-a"));
    await setDoc(doc(db, "portfolioPublishingEntitlements", "port-expiry-null"), expiryEntitlement("port-expiry-null", "owner-a", null));
    await setDoc(doc(db, "portfolios", "port-expiry-mismatch"), draftPortfolio("owner-a"));
    await setDoc(doc(db, "portfolioPublishingEntitlements", "port-expiry-mismatch"), expiryEntitlement("port-other-id", "owner-a", futureExpiry));
    await setDoc(doc(db, "portfolios", "port-expiry-owner"), draftPortfolio("owner-a"));
    await setDoc(doc(db, "portfolioPublishingEntitlements", "port-expiry-owner"), expiryEntitlement("port-expiry-owner", "owner-b", futureExpiry));
    await setDoc(doc(db, "portfolios", "port-expiry-missing"), draftPortfolio("owner-a"));
    await setDoc(doc(db, "portfolios", "port-expiry-live"), publishedPortfolio("owner-a"));
    await setDoc(doc(db, "portfolioPublishingEntitlements", "port-expiry-live"), expiryEntitlement("port-expiry-live", "owner-a", pastExpiry));
    await setDoc(doc(db, "publicPortfolios", "port-expiry-live"), publicBody("port-expiry-live"));
  });
  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-expiry-future"), publishFields));
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-expiry-past"), publishFields));
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-expiry-now"), publishFields));
  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-expiry-grandfather"), publishFields));
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-expiry-string"), publishFields));
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-expiry-null"), publishFields));
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-expiry-mismatch"), publishFields));
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-expiry-owner"), publishFields));
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-expiry-missing"), publishFields));
  await seed(async (db) => {
    await setDoc(doc(db, "portfolios", "port-grace-open"), publishedPortfolio("owner-a"));
    await setDoc(doc(db, "portfolioPublishingEntitlements", "port-grace-open"), expiryEntitlement("port-grace-open", "owner-a", Timestamp.fromMillis(Date.now() - 2 * 86_400_000)));
    await setDoc(doc(db, "publicPortfolios", "port-grace-open"), publicBody("port-grace-open"));
    await setDoc(doc(db, "portfolios", "port-grace-closed"), publishedPortfolio("owner-a"));
    await setDoc(doc(db, "portfolioPublishingEntitlements", "port-grace-closed"), expiryEntitlement("port-grace-closed", "owner-a", Timestamp.fromMillis(Date.now() - 8 * 86_400_000)));
    await setDoc(doc(db, "publicPortfolios", "port-grace-closed"), publicBody("port-grace-closed"));
  });
  await assertSucceeds(getDoc(doc(anonDb, "publicPortfolios", "port-grace-open")));
  await assertFails(getDoc(doc(anonDb, "publicPortfolios", "port-grace-closed")));
  await seed(async (db) => {
    await setDoc(doc(db, "portfolios", "port-legacy-public"), publishedPortfolio("owner-a"));
    await setDoc(doc(db, "portfolioPublishingEntitlements", "port-legacy-public"), expiryEntitlement("port-legacy-public", "owner-a"));
    await setDoc(doc(db, "publicPortfolios", "port-legacy-public"), publicBody("port-legacy-public"));
    await setDoc(doc(db, "portfolios", "port-legacy-draft"), draftPortfolio("owner-a"));
    await setDoc(doc(db, "portfolioPublishingEntitlements", "port-legacy-draft"), expiryEntitlement("port-legacy-draft", "owner-a"));
    await setDoc(doc(db, "publicPortfolios", "port-legacy-draft"), publicBody("port-legacy-draft"));
    await setDoc(doc(db, "portfolios", "port-renewed-public"), publishedPortfolio("owner-a"));
    await setDoc(doc(db, "portfolioPublishingEntitlements", "port-renewed-public"), expiryEntitlement("port-renewed-public", "owner-a", futureExpiry));
    await setDoc(doc(db, "publicPortfolios", "port-renewed-public"), publicBody("port-renewed-public"));
    await setDoc(doc(db, "portfolios", "port-manual-hidden"), {
      ...publishedPortfolio("owner-a"),
      publishing: { status: "draft", publishedAt: null },
      published: false,
    });
    await setDoc(doc(db, "portfolioPublishingEntitlements", "port-manual-hidden"), expiryEntitlement("port-manual-hidden", "owner-a", futureExpiry));
    await setDoc(doc(db, "publicPortfolios", "port-manual-hidden"), publicBody("port-manual-hidden"));
    const revoked = expiryEntitlement("port-revoked-public", "owner-a", futureExpiry);
    revoked.status = "revoked";
    await setDoc(doc(db, "portfolios", "port-revoked-public"), publishedPortfolio("owner-a"));
    await setDoc(doc(db, "portfolioPublishingEntitlements", "port-revoked-public"), revoked);
    await setDoc(doc(db, "publicPortfolios", "port-revoked-public"), publicBody("port-revoked-public"));
  });
  await assertSucceeds(getDoc(doc(anonDb, "publicPortfolios", "port-legacy-public")));
  await assertFails(getDoc(doc(anonDb, "publicPortfolios", "port-legacy-draft")));
  await assertSucceeds(getDoc(doc(anonDb, "publicPortfolios", "port-renewed-public")));
  await assertFails(getDoc(doc(anonDb, "publicPortfolios", "port-manual-hidden")));
  await assertFails(getDoc(doc(anonDb, "publicPortfolios", "port-revoked-public")));
  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-grace-closed"), {
    profile: { brandName: "Ada", headline: "Still editable after grace" },
  }));
  await assertSucceeds(getDoc(doc(ownerDb, "portfolios", "port-grace-closed")));

  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-expiry-live"), {
    profile: { brandName: "Ada", headline: "Saved while the entitlement is expired" },
  }));
  assert.equal((await getDoc(doc(ownerDb, "portfolios", "port-expiry-live"))).data()?.publishing.status, "published");
  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-expiry-live"), {
    publishing: { status: "draft", publishedAt: null },
    published: false,
  }));
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-expiry-live"), publishFields));
  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-expiry-future"), {
    publishing: { status: "draft", publishedAt: null },
    published: false,
  }));
  await seed(async (db) => {
    await setDoc(doc(db, "publishingControls", "gate"), { enabled: false });
  });
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-expiry-future"), publishFields));
  assert.match(rules, /!data\.keys\(\)\.hasAny\(\["expiresAt"\]\)/);
  assert.match(rules, /data\.expiresAt is timestamp && data\.expiresAt > request\.time/);
  assert.equal(rules.includes("expiresAt >= request.time"), false);
} finally {
  await testEnv.cleanup();
}

console.log("publishing entitlement rules checks passed");
