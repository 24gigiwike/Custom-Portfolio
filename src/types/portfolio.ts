import type { Timestamp } from "firebase/firestore";

export type PortfolioStylePreset = "MINIMAL" | "CREATIVE" | "EDITORIAL" | "BOLD";

export type PortfolioAvailability = 
  | "Available for work"
  | "Open to opportunities"
  | "Currently unavailable";

export interface PortfolioSocialLinks {
  website?: string;
  linkedin?: string;
  github?: string;
  instagram?: string;
  twitter?: string;
  other?: string;
}

export interface PortfolioTheme {
  mode: "light";
  accent: string;
}

export interface PortfolioEnabledSections {
  hero: boolean;
  about: boolean;
  projects: boolean;
  experience: boolean;
  skills: boolean;
  services: boolean;
  education: boolean;
  certifications: boolean;
  testimonials: boolean;
  clients: boolean;
  contact: boolean;
}

export interface Portfolio {
  id: string;
  ownerId: string;
  title: string;
  slug: string;
  profession: string;
  headline: string;
  bio: string;
  location?: string;
  profileImage: string | null;
  availability?: PortfolioAvailability;
  email: string;
  socialLinks: PortfolioSocialLinks;
  stylePreset: PortfolioStylePreset;
  theme: PortfolioTheme;
  enabledSections: PortfolioEnabledSections;
  createdAt: Timestamp | string | null;
  updatedAt: Timestamp | string | null;
  published: boolean;
}

export interface CreatePortfolioInput {
  ownerId: string;
  title: string;
  profession: string;
  headline: string;
  bio: string;
  location?: string;
  profileImage?: string | null;
  availability?: PortfolioAvailability;
  email: string;
  socialLinks: PortfolioSocialLinks;
  stylePreset?: PortfolioStylePreset;
}
