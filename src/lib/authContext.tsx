import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import {
  getOrCreateUserAccount,
  getUserAccount,
  completeUserOnboarding,
} from "./userAccount";
import type {
  AuthContextType,
  AuthStatus,
  AuthUser,
  UserProfile,
  OnboardingData,
  AuthPhase,
} from "../types";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userAccount, setUserAccount] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [authPhase, setAuthPhase] = useState<AuthPhase>("AUTH_LOADING");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sync strictly with Firebase Auth state observer and Firestore user document
  useEffect(() => {
    let isMounted = true;

    try {
      const unsubscribe = onAuthStateChanged(
        auth,
        async (fbUser: FirebaseUser | null) => {
          if (!isMounted) return;

          if (fbUser) {
            const mappedUser: AuthUser = {
              uid: fbUser.uid,
              email: fbUser.email,
              displayName:
                fbUser.displayName ||
                (fbUser.email ? fbUser.email.split("@")[0] : "Creator"),
              photoURL: fbUser.photoURL,
              providerId: fbUser.providerData[0]?.providerId || "google.com",
              emailVerified: fbUser.emailVerified,
            };
            setUser(mappedUser);
            setStatus("authenticated");
            setAuthPhase("ACCOUNT_LOADING");

            try {
              const account = await getOrCreateUserAccount(mappedUser);
              if (isMounted) {
                setUserAccount(account);
                if (account.onboardingCompleted) {
                  setAuthPhase("READY");
                } else {
                  setAuthPhase("ONBOARDING_REQUIRED");
                }
              }
            } catch (err) {
              console.error("Error loading/creating Firestore user account:", err);
              if (isMounted) {
                // If Firestore error occurs, we still preserve the user but flag onboarding
                setAuthPhase("ONBOARDING_REQUIRED");
              }
            }
          } else {
            setUser(null);
            setUserAccount(null);
            setStatus("unauthenticated");
            setAuthPhase("SIGNED_OUT");
          }
          setIsLoading(false);
        },
        (authError) => {
          console.error("Firebase Auth listener error:", authError);
          if (isMounted) {
            setUser(null);
            setUserAccount(null);
            setStatus("unauthenticated");
            setAuthPhase("SIGNED_OUT");
            setIsLoading(false);
          }
        }
      );

      return () => {
        isMounted = false;
        unsubscribe();
      };
    } catch (err) {
      console.error("Firebase Auth initialization error:", err);
      setIsLoading(false);
      setAuthPhase("SIGNED_OUT");
    }
  }, []);

  const signInWithGoogle = async () => {
    setStatus("authenticating");
    setError(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;

      if (fbUser) {
        const mappedUser: AuthUser = {
          uid: fbUser.uid,
          email: fbUser.email,
          displayName:
            fbUser.displayName ||
            (fbUser.email ? fbUser.email.split("@")[0] : "Creator"),
          photoURL: fbUser.photoURL,
          providerId: fbUser.providerData[0]?.providerId || "google.com",
          emailVerified: fbUser.emailVerified,
        };

        setUser(mappedUser);
        setStatus("authenticated");
        setAuthPhase("ACCOUNT_LOADING");

        try {
          const account = await getOrCreateUserAccount(mappedUser);
          setUserAccount(account);
          if (account.onboardingCompleted) {
            setAuthPhase("READY");
          } else {
            setAuthPhase("ONBOARDING_REQUIRED");
          }
        } catch (dbErr) {
          console.error("Firestore user account creation error on sign in:", dbErr);
          setAuthPhase("ONBOARDING_REQUIRED");
        }
      }
    } catch (err: unknown) {
      console.error("Google sign-in error:", err);

      const errorCode = (err as { code?: string })?.code;

      if (
        errorCode === "auth/popup-closed-by-user" ||
        errorCode === "auth/cancelled-popup-request"
      ) {
        setError("Sign-in window was closed before completion. Please try again.");
        setStatus("unauthenticated");
        return;
      }

      if (errorCode === "auth/network-request-failed") {
        setError("Network connection issue. Please verify your internet connection.");
        setStatus("error");
        return;
      }

      if (errorCode === "auth/unauthorized-domain") {
        setError(
          "This domain is not authorized in Firebase. Please add this domain under Firebase Console → Authentication → Settings → Authorized domains."
        );
        setStatus("error");
        return;
      }

      setError("We couldn't sign you in with Google. Please try again.");
      setStatus("error");
    }
  };

  const signOutUser = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error("Firebase sign out error:", err);
    } finally {
      setUser(null);
      setUserAccount(null);
      setStatus("unauthenticated");
      setAuthPhase("SIGNED_OUT");
    }
  };

  const saveOnboarding = async (data: OnboardingData): Promise<UserProfile> => {
    if (!user) {
      throw new Error("Cannot save onboarding without an active authenticated session.");
    }
    try {
      const updated = await completeUserOnboarding(user.uid, data);
      setUserAccount(updated);
      setAuthPhase("READY");
      return updated;
    } catch (err) {
      console.error("Failed to save onboarding data:", err);
      throw err;
    }
  };

  const refreshAccount = useCallback(async (): Promise<UserProfile | null> => {
    if (!user) return null;
    try {
      const account = await getUserAccount(user.uid);
      if (account) {
        setUserAccount(account);
        if (account.onboardingCompleted) {
          setAuthPhase("READY");
        } else {
          setAuthPhase("ONBOARDING_REQUIRED");
        }
      }
      return account;
    } catch (err) {
      console.error("Error refreshing account:", err);
      return null;
    }
  }, [user]);

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        userAccount,
        status,
        authPhase,
        isLoading,
        error,
        signInWithGoogle,
        signOutUser,
        clearError,
        saveOnboarding,
        refreshAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
