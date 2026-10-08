import type { Timestamp } from "firebase/firestore";
import type {
  PortfolioContact,
  PortfolioProfile,
  PortfolioSEO,
  Project,
  SocialLink,
} from "../templates/wdk-premium-portfolio-1/types/portfolio";
import type { PortfolioDiscoverability } from "./discoverability";
import type { PortfolioDesign } from "./portfolioDesign";

/**
 * Anonymous presentation of one published portfolio.
 * This is not the private CMS record and it is not a UserPortfolio alias.
 */
export interface PublicPortfolio {
  publicId: string;
  selectedTemplate: string;
  profile: PortfolioProfile;
  socialLinks: SocialLink[];
  projects: Project[];
  contact: PortfolioContact;
  seo: PortfolioSEO;
  discoverability: PortfolioDiscoverability;
  design: PortfolioDesign;
  /** Active public address. Empty means visitors use the permanent portfolio id. */
  publicSlug: string;
  publishedAt: Timestamp | string | null;
  updatedAt: Timestamp | string | null;
}
