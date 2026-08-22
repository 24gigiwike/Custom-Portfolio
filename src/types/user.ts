import type { Timestamp } from "firebase/firestore";

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
}

export interface OnboardingData {
  displayName: string;
  profession: string;
  customProfession?: string;
  portfolioType: string;
  location?: string;
}

export type AuthPhase = 
  | "AUTH_LOADING"
  | "SIGNED_OUT"
  | "ACCOUNT_LOADING"
  | "ONBOARDING_REQUIRED"
  | "READY";
