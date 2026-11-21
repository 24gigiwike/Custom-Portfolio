import type { PortfolioData } from "../../wdk-premium-portfolio-1/types/portfolio.ts";
import { CREATIVE_PORTRAIT, CREATIVE_PROJECT_IMAGES } from "../assets/defaultImages.ts";

/**
 * Preview-only fixture for The Creative.
 * The photographs are Unsplash URLs owned by this template. They are not WDK assets.
 */
export const creativeSamplePortfolioData: PortfolioData = {
  profile: {
    brandName: "Mara Ellison",
    logo: "",
    heroImage: CREATIVE_PORTRAIT,
    heroImageMobile: "",
    headline: "Designer & art director",
    capabilityTags: ["Identity", "Art direction", "Digital"],
    ctaLabel: "About me",
    ctaHref: "#about",
    email: "studio@maraellison.example",
  },
  socialLinks: [
    { platform: "instagram", url: "https://instagram.com" },
    { platform: "x", url: "https://x.com" },
  ],
  projects: [
    {
      id: "atelier",
      title: "Atelier North",
      category: "Identity",
      url: "https://example.com/atelier",
      tech: ["Art direction"],
      image: CREATIVE_PROJECT_IMAGES[0],
      client: "Atelier North",
      year: "2024",
      summary: "A quieter identity for a furniture studio, built around proportion, material, and a single wordmark.",
    },
    {
      id: "field",
      title: "Field Office",
      category: "Digital",
      url: "",
      tech: [],
      image: CREATIVE_PROJECT_IMAGES[1],
      client: "Field Office",
      year: "2024",
      summary: "An editorial site for an architecture practice. The external link is intentionally absent.",
    },
    {
      id: "linen",
      title: "Linen Room",
      category: "Art direction",
      url: "https://example.com/linen",
      tech: ["Photography"],
      image: CREATIVE_PROJECT_IMAGES[2],
      client: "Linen Room",
      year: "2023",
      summary: "Campaign photography and a small digital lookbook for a home label.",
    },
    {
      id: "harbor",
      title: "Harbor Index",
      category: "Editorial",
      url: "https://example.com/harbor",
      tech: [],
      image: "",
      client: "",
      year: "2023",
      summary: "A reading room and archive. This project uses the template photograph until one is added.",
    },
  ],
  contact: {
    email: "studio@maraellison.example",
    eyebrow: "",
    heading: "Helping studios find a clearer visual voice.",
    description: "Identity, art direction, and digital work for teams who care how the result feels.",
    projectTypes: ["Identity", "Art direction", "Digital"],
    formEndpoint: "",
  },
  seo: {
    title: "Mara Ellison",
    description: "Designer and art director.",
    canonicalUrl: "",
    ogTitle: "Mara Ellison",
    ogDescription: "Designer and art director.",
    ogImage: CREATIVE_PORTRAIT,
    twitterTitle: "Mara Ellison",
    twitterDescription: "Designer and art director.",
    twitterImage: "",
  },
};

export const creativeOneProjectData: PortfolioData = {
  ...creativeSamplePortfolioData,
  projects: [creativeSamplePortfolioData.projects[0]],
};
