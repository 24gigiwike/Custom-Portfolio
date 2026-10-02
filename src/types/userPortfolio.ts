import type { Timestamp } from "firebase/firestore";
import type {
  PortfolioContact,
  PortfolioProfile,
  PortfolioSEO,
  Project as TemplateProject,
  SocialLink,
} from "../templates/wdk-premium-portfolio-1/types/portfolio";

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
  publishing: PortfolioPublishing;
  createdAt: Timestamp | string | null;
  updatedAt: Timestamp | string | null;
}

export interface PortfolioPublishing {
  status: "draft";
}

export type UserPortfolioContent = Omit<UserPortfolio, "id" | "ownerId" | "createdAt" | "updatedAt">;
