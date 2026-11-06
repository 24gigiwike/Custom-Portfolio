import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

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
  await assertSucceeds(setDoc(doc(ownerDb, "portfolios", "port-free"), draftPortfolio("owner-a")));
  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-free"), {
    publishing: { status: "published", publishedAt: null },
    published: true,
    profile: { brandName: "Ada", headline: "Updated" },
    design: { palette: "ink" },
  }));
  await assertSucceeds(setDoc(doc(ownerDb, "publicPortfolios", "port-free"), publicBody("port-free")));
  await assertSucceeds(setDoc(doc(ownerDb, "sitemapEntries", "port-free"), {
    publicId: "port-free",
    slug: "",
    updatedAt: serverTimestamp(),
  }));
  await assertSucceeds(getDoc(doc(anonDb, "publicPortfolios", "port-free")));
  await assertSucceeds(getDoc(doc(anonDb, "sitemapEntries", "port-free")));
  await assertFails(getDoc(doc(anonDb, "portfolios", "port-free")));

  await seed(async (db) => {
    await setDoc(doc(db, "publishingControls", "gate"), { enabled: true });
  });

  await assertSucceeds(setDoc(doc(ownerDb, "portfolios", "port-unpaid"), draftPortfolio("owner-a")));
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-unpaid"), {
    publishing: { status: "published", publishedAt: null },
    published: true,
  }));
  await seed(async (db) => {
    await setDoc(doc(db, "publishingEntitlements", "owner-a"), {
      uid: "owner-a",
      status: "inactive",
      source: "payment",
      schemaVersion: 1,
    });
  });
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-unpaid"), {
    publishing: { status: "published", publishedAt: null },
    published: true,
  }));
  await seed(async (db) => {
    await deleteDoc(doc(db, "publishingEntitlements", "owner-a"));
  });
  await assertFails(setDoc(doc(ownerDb, "portfolios", "port-created-live"), {
    ...draftPortfolio("owner-a"),
    publishing: { status: "published" },
    published: true,
  }));
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

  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-free"), {
    profile: { brandName: "Ada", headline: "Saved while live" },
    design: { palette: "ink" },
    publishing: { status: "published", publishedAt: null },
    published: true,
  }));
  await assertSucceeds(setDoc(doc(ownerDb, "publicPortfolios", "port-free"), publicBody("port-free")));
  await assertSucceeds(setDoc(doc(ownerDb, "sitemapEntries", "port-free"), {
    publicId: "port-free",
    slug: "",
    updatedAt: serverTimestamp(),
  }));

  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-free"), {
    publishing: { status: "draft", publishedAt: null },
    published: false,
  }));
  await assertFails(updateDoc(doc(ownerDb, "portfolios", "port-free"), {
    publishing: { status: "published", publishedAt: null },
    published: true,
  }));
  await seed(async (db) => {
    await setDoc(doc(db, "publishingEntitlements", "owner-a"), {
      uid: "owner-a",
      status: "active",
      source: "grandfathered",
      paymentId: null,
      providerReference: null,
      schemaVersion: 1,
    });
  });
  await assertSucceeds(deleteDoc(doc(ownerDb, "publicPortfolios", "port-free")));
  await assertSucceeds(deleteDoc(doc(ownerDb, "sitemapEntries", "port-free")));
  const entitlementAfterUnpublish = await getDoc(doc(ownerDb, "publishingEntitlements", "owner-a"));
  assert.equal(entitlementAfterUnpublish.exists(), true);
  assert.equal(entitlementAfterUnpublish.data()?.source, "grandfathered");
  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-free"), {
    publishing: { status: "published", publishedAt: null },
    published: true,
  }));
  await assertSucceeds(setDoc(doc(ownerDb, "publicPortfolios", "port-free"), publicBody("port-free")));
  await assertFails(deleteDoc(doc(ownerDb, "publishingEntitlements", "owner-a")));

  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-free"), {
    publishing: { status: "draft", publishedAt: null },
    published: false,
  }));
  await seed(async (db) => {
    await setDoc(doc(db, "publishingEntitlements", "owner-a"), {
      uid: "owner-a",
      status: "active",
      source: "payment",
      paymentId: "pay-1",
      providerReference: "ref-1",
      schemaVersion: 1,
    });
  });
  await assertSucceeds(updateDoc(doc(ownerDb, "portfolios", "port-free"), {
    publishing: { status: "published", publishedAt: null },
    published: true,
  }));

  const persist = testEnv.authenticatedContext("owner-persist");
  const persistDb = persist.firestore();
  const persistedEntitlement = {
    uid: "owner-persist",
    status: "active",
    source: "grandfathered",
    paymentId: null,
    providerReference: null,
    schemaVersion: 1,
  };
  await seed(async (db) => {
    await setDoc(doc(db, "portfolios", "port-persist"), {
      ...draftPortfolio("owner-persist"),
      publishing: { status: "published", publishedAt: null },
      published: true,
    });
    await setDoc(doc(db, "publishingEntitlements", "owner-persist"), persistedEntitlement);
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
  await assertSucceeds(updateDoc(doc(persistDb, "portfolios", "port-persist"), {
    profile: { brandName: "Ada", headline: "Saved as a draft" },
    design: { palette: "ink" },
    publishing: { status: "draft" },
    published: false,
  }));
  const persistedAfterDraftSave = await getDoc(doc(persistDb, "publishingEntitlements", "owner-persist"));
  assert.deepEqual(persistedAfterDraftSave.data(), persistedEntitlement);
  await seed(async (db) => {
    await deleteDoc(doc(db, "publishingEntitlements", "owner-persist"));
  });
  await assertFails(updateDoc(doc(persistDb, "portfolios", "port-persist"), {
    publishing: { status: "published", publishedAt: null },
    published: true,
  }));
  await seed(async (db) => {
    await setDoc(doc(db, "publishingEntitlements", "owner-persist"), persistedEntitlement);
  });
  await assertSucceeds(updateDoc(doc(persistDb, "portfolios", "port-persist"), {
    publishing: { status: "published", publishedAt: null },
    published: true,
  }));
  await assertSucceeds(setDoc(doc(persistDb, "publicPortfolios", "port-persist"), publicBody("port-persist")));
  const persistedAfterRepublish = await getDoc(doc(persistDb, "publishingEntitlements", "owner-persist"));
  assert.deepEqual(persistedAfterRepublish.data(), persistedEntitlement);
  await assertFails(deleteDoc(doc(persistDb, "publishingEntitlements", "owner-persist")));

  await seed(async (db) => {
    await setDoc(doc(db, "publishingControls", "gate"), { enabled: false });
  });
  await assertSucceeds(setDoc(doc(ownerDb, "portfolios", "port-open-again"), {
    ...draftPortfolio("owner-a"),
    publishing: { status: "published" },
    published: true,
  }));

  await assertFails(updateDoc(doc(otherDb, "portfolios", "port-free"), {
    publishing: { status: "draft" },
    published: false,
  }));
} finally {
  await testEnv.cleanup();
}

console.log("publishing entitlement rules checks passed");
