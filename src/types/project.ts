import type { Timestamp } from "firebase/firestore";

export interface Project {
  id: string;
  portfolioId: string;
  ownerId?: string;

  title: string;
  slug: string;

  shortDescription: string;
  description: string;

  coverImage: string | null;
  images: string[];

  role: string;
  client: string;
  year: string;

  services: string[];
  tools: string[];

  projectUrl: string;
  caseStudyUrl?: string;

  featured: boolean;
  order: number;

  createdAt?: string | Timestamp | null;
  updatedAt?: string | Timestamp | null;
}

export interface CreateProjectInput {
  title: string;
  slug?: string;
  shortDescription: string;
  description?: string;
  coverImage?: string | null;
  images?: string[];
  role?: string;
  client?: string;
  year?: string;
  services?: string[];
  tools?: string[];
  projectUrl?: string;
  caseStudyUrl?: string;
  featured?: boolean;
}

export interface UpdateProjectInput {
  title: string;
  slug?: string;
  shortDescription: string;
  description?: string;
  coverImage?: string | null;
  images?: string[];
  role?: string;
  client?: string;
  year?: string;
  services?: string[];
  tools?: string[];
  projectUrl?: string;
  caseStudyUrl?: string;
  featured?: boolean;
  order?: number;
}
