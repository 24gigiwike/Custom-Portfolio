/**
 * Custom Portfolio by BroadBrand
 * Core TypeScript type definitions
 */

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
  status: AuthStatus;
  isLoading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  clearError: () => void;
}

export type AppRoute = "/" | "/auth" | "/app";
