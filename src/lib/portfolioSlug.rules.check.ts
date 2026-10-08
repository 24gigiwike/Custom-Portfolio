import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";

const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");

const testEnv = await initializeTestEnvironment({
  projectId: "demo-custom-portfolio",
  firestore: { rules, host: "127.0.0.1", port: 8080 },
});

function publicBody(publicId: string, publicSlug: string) {
  return {
    publicId,
    selectedTemplate: "wdk-premium-portfolio-1",
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
    socialLinks: [],
    projects: [],
    contact: {
      email: "",
      eyebrow: "",
      heading: "",
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

try {
  await testEnv.clearFirestore();
  const owner = testEnv.authenticatedContext("owner-a");
  const other = testEnv.authenticatedContext("owner-b");
  const anon = testEnv.unauthenticatedContext();
  const ownerDb = owner.firestore();
  const otherDb = other.firestore();
  const anonDb = anon.firestore();

  await assertFails(getDoc(doc(anonDb, "portfolios", "porta")));
  await assertSucceeds(runTransaction(ownerDb, async (transaction) => {
    transaction.set(doc(ownerDb, "portfolios", "porta"), {
      ownerId: "owner-a",
      publicSlug: "",
      publicSlugAliases: [],
      publishing: { status: "draft" },
    });
    transaction.set(doc(ownerDb, "portfolioIds", "porta"), { portfolioId: "porta" });
  }));
  await assertFails(getDoc(doc(otherDb, "portfolios", "porta")));
  await assertFails(setDoc(doc(anonDb, "portfolioSlugs", "johnpaul"), {
    slug: "johnpaul",
    portfolioId: "porta",
    role: "active",
  }));

  await assertSucceeds(runTransaction(ownerDb, async (transaction) => {
    transaction.update(doc(ownerDb, "portfolios", "porta"), {
      publicSlug: "johnpaul",
      publicSlugAliases: [],
    });
    transaction.set(doc(ownerDb, "portfolioSlugs", "johnpaul"), {
      slug: "johnpaul",
      portfolioId: "porta",
      role: "active",
    });
  }));

  await assertFails(getDoc(doc(anonDb, "portfolioSlugs", "johnpaul")));
  await assertSucceeds(getDoc(doc(ownerDb, "portfolioSlugs", "johnpaul")));

  await assertSucceeds(runTransaction(otherDb, async (transaction) => {
    transaction.set(doc(otherDb, "portfolios", "portb"), {
      ownerId: "owner-b",
      publicSlug: "",
      publicSlugAliases: [],
      publishing: { status: "draft" },
    });
    transaction.set(doc(otherDb, "portfolioIds", "portb"), { portfolioId: "portb" });
  }));
  await assertFails(runTransaction(otherDb, async (transaction) => {
    transaction.update(doc(otherDb, "portfolios", "portb"), {
      publicSlug: "johnpaul",
      publicSlugAliases: [],
    });
    transaction.set(doc(otherDb, "portfolioSlugs", "johnpaul"), {
      slug: "johnpaul",
      portfolioId: "portb",
      role: "active",
    });
  }));

  await assertFails(runTransaction(ownerDb, async (transaction) => {
    transaction.update(doc(ownerDb, "portfolios", "porta"), { publicSlug: "admin", publicSlugAliases: [] });
    transaction.set(doc(ownerDb, "portfolioSlugs", "admin"), {
      slug: "admin",
      portfolioId: "porta",
      role: "active",
    });
  }));
  await assertFails(runTransaction(otherDb, async (transaction) => {
    transaction.update(doc(otherDb, "portfolios", "portb"), { publicSlug: "porta", publicSlugAliases: [] });
    transaction.set(doc(otherDb, "portfolioSlugs", "porta"), {
      slug: "porta",
      portfolioId: "portb",
      role: "active",
    });
  }));

  await assertSucceeds(runTransaction(ownerDb, async (transaction) => {
    transaction.update(doc(ownerDb, "portfolios", "porta"), {
      ownerId: "owner-a",
      publicSlug: "johnpaul-animation",
      publicSlugAliases: ["johnpaul"],
      publishing: { status: "published" },
    });
    transaction.update(doc(ownerDb, "portfolioSlugs", "johnpaul"), {
      slug: "johnpaul",
      portfolioId: "porta",
      role: "alias",
    });
    transaction.set(doc(ownerDb, "portfolioSlugs", "johnpaul-animation"), {
      slug: "johnpaul-animation",
      portfolioId: "porta",
      role: "active",
    });
    transaction.set(doc(ownerDb, "publicPortfolios", "porta"), publicBody("porta", "johnpaul-animation"));
  }));

  await assertFails(runTransaction(otherDb, async (transaction) => {
    transaction.update(doc(otherDb, "portfolios", "portb"), {
      publicSlug: "johnpaul",
      publicSlugAliases: [],
    });
    transaction.set(doc(otherDb, "portfolioSlugs", "johnpaul"), {
      slug: "johnpaul",
      portfolioId: "portb",
      role: "active",
    });
  }));
  const alias = await getDoc(doc(anonDb, "portfolioSlugs", "johnpaul"));
  assert.equal(alias.exists(), true);
  assert.equal(alias.data()?.portfolioId, "porta");
  assert.equal(alias.data()?.ownerId, undefined);

  await assertSucceeds(runTransaction(ownerDb, async (transaction) => {
    transaction.update(doc(ownerDb, "portfolios", "porta"), {
      publishing: { status: "draft" },
    });
    transaction.delete(doc(ownerDb, "publicPortfolios", "porta"));
  }));
  await assertFails(getDoc(doc(anonDb, "portfolioSlugs", "johnpaul")));
  await assertFails(getDoc(doc(anonDb, "portfolioSlugs", "johnpaul-animation")));
  await assertSucceeds(getDoc(doc(ownerDb, "portfolioSlugs", "johnpaul")));
  await assertFails(getDoc(doc(anonDb, "portfolios", "porta")));

  const shared = "shared-name";
  const first = testEnv.authenticatedContext("owner-c").firestore();
  const second = testEnv.authenticatedContext("owner-d").firestore();
  await assertSucceeds(setDoc(doc(first, "portfolios", "portc"), {
    ownerId: "owner-c",
    publicSlug: shared,
    publicSlugAliases: [],
    publishing: { status: "draft" },
  }));
  await assertSucceeds(setDoc(doc(second, "portfolios", "portd"), {
    ownerId: "owner-d",
    publicSlug: shared,
    publicSlugAliases: [],
    publishing: { status: "draft" },
  }));
  const results = await Promise.allSettled([
    runTransaction(first, async (transaction) => {
      transaction.set(doc(first, "portfolioSlugs", shared), {
        slug: shared,
        portfolioId: "portc",
        role: "active",
      });
    }),
    runTransaction(second, async (transaction) => {
      transaction.set(doc(second, "portfolioSlugs", shared), {
        slug: shared,
        portfolioId: "portd",
        role: "active",
      });
    }),
  ]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  assert.equal(fulfilled.length, 1);
} finally {
  await testEnv.cleanup();
}

console.log("portfolio slug rules checks passed");
