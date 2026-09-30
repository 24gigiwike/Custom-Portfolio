import type { Timestamp } from "firebase/firestore";

export const ONBOARDING_STEPS = [
  "welcome",
  "about",
  "personal",
  "professional",
  "goal",
  "ready",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export interface AccountPrivate {
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  email: string;
}

export interface ProfessionalProfile {
  categories: string[];
  title: string;
  description: string;
  photoURL: string | null;
  photoPath: string | null;
}

export interface PortfolioPreferences {
  goals: string[];
}

export interface OnboardingProgress {
  completed: boolean;
  readyForTemplates: boolean;
  currentStep: OnboardingStep;
  version: 1;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  createdAt: Timestamp | string | null;
  updatedAt: Timestamp | string | null;
  onboardingCompleted: boolean;
  profession?: string;
  customProfession?: string;
  portfolioType?: string;
  location?: string;
  onboarding?: OnboardingProgress;
  accountPrivate?: AccountPrivate;
  professionalProfile?: ProfessionalProfile;
  portfolioPreferences?: PortfolioPreferences;
}

export interface FoundationDraft {
  firstName: string;
  lastName: string;
  photoURL: string | null;
  photoPath: string | null;
  dateOfBirth: string;
  categories: string[];
  otherCategory: string;
  title: string;
  description: string;
  goals: string[];
  otherGoal: string;
}

export type AuthPhase = 
  | "AUTH_LOADING"
  | "SIGNED_OUT"
  | "ACCOUNT_LOADING"
  | "ACCOUNT_ERROR"
  | "ONBOARDING_REQUIRED"
  | "TEMPLATE_DISCOVERY"
  | "READY";
