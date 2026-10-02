import { templateConfig } from "../templates/wdk-premium-portfolio-1/data/template-config";
import type { UserProfile } from "../types";
import type { PortfolioPublishing, UserPortfolioContent } from "../types/userPortfolio";

const EMPTY_PUBLISHING: PortfolioPublishing = { status: "draft" };

function text(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Initial portfolio content from the public professional profile.
 * Date of birth, login email, and portfolio goals stay off this object.
 */
export function seedPortfolioFromAccount(account: UserProfile | null): UserPortfolioContent {
  const firstName = text(account?.accountPrivate?.firstName);
  const lastName = text(account?.accountPrivate?.lastName);
  const brandName = [firstName, lastName].filter(Boolean).join(" ") || text(account?.displayName);
  const professional = account?.professionalProfile;
  const headline = text(professional?.title) || text(account?.profession);
  const description = text(professional?.description);
  const portrait = text(professional?.photoURL) || text(account?.photoURL);
  const capabilityTags = (professional?.categories || []).map((item) => item.trim()).filter(Boolean);

  return {
    selectedTemplate: templateConfig.id,
    profile: {
      brandName,
      logo: "",
      heroImage: portrait,
      heroImageMobile: portrait,
      headline,
      capabilityTags,
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
      description,
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
    publishing: EMPTY_PUBLISHING,
  };
}
