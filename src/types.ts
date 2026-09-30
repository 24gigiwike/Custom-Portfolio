/**
 * Custom Portfolio by BroadBrand
 * Core TypeScript type definitions
 */

import type { UserProfile, OnboardingData, AuthPhase } from "./types/user";
import type { Portfolio, PortfolioStylePreset, CreatePortfolioInput } from "./types/portfolio";

export * from "./types/user";
export * from "./types/portfolio";

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  providerId?: string;
  emailVerified?: boolean;
}

export type AuthStatus = "idle" | "authenticating" | "authenticated" | "unauthenticated" | "error";

export interface AuthContextType {
  user: AuthUser | null;
  userAccount: UserProfile | null;
  status: AuthStatus;
  authPhase: AuthPhase;
  isLoading: boolean;
  error: string | null;
  accountError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  clearError: () => void;
  saveOnboarding: (data: OnboardingData) => Promise<UserProfile>;
  refreshAccount: () => Promise<UserProfile | null>;
  retryLoadAccount: () => Promise<void>;
}

export type AppRoute = "/" | "/auth" | "/onboarding" | "/app" | (string & {});

