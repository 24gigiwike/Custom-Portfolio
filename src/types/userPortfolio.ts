import type { Timestamp } from "firebase/firestore";
import type {
  PortfolioContact,
  PortfolioProfile,
  PortfolioSEO,
  Project as TemplateProject,
  SocialLink,
} from "../templates/wdk-premium-portfolio-1/types/portfolio";
import type { PortfolioDesign } from "./portfolioDesign";

/**
 * Persisted portfolio owned by one authenticated user.
 * This is the application record. It is not the template's PortfolioData.
 */
export interface UserPortfolio {
  id: string;
  ownerId: string;
  selectedTemplate: string;
  profile: PortfolioProfile;
  socialLinks: SocialLink[];
  projects: TemplateProject[];
  contact: PortfolioContact;
  seo: PortfolioSEO;
  design: PortfolioDesign;
  publishing: PortfolioPublishing;
  createdAt: Timestamp | string | null;
  updatedAt: Timestamp | string | null;
}

export type PublishingStatus = "draft" | "published";

/**
 * Canonical publishing state for the current portfolio.
 * publishedAt is the first successful publication, kept after unpublish.
 */
export interface PortfolioPublishing {
  status: PublishingStatus;
  publishedAt?: Timestamp | string | null;
}

export type UserPortfolioContent = Omit<UserPortfolio, "id" | "ownerId" | "createdAt" | "updatedAt">;
