import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import type { AuthUser, UserProfile, OnboardingData } from "../types";

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error:", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Fetch user profile document by Firebase Auth UID from users/{uid}
 */
export async function getUserAccount(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const userRef = doc(db, "users", uid);
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        uid,
        email: data.email || "",
        displayName: data.displayName || "",
        photoURL: data.photoURL || null,
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
        onboardingCompleted: Boolean(data.onboardingCompleted),
        profession: data.profession || undefined,
        customProfession: data.customProfession || undefined,
        portfolioType: data.portfolioType || undefined,
        location: data.location || undefined,
      };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Create a new user profile document in users/{uid}
 */
export async function createUserAccount(user: AuthUser): Promise<UserProfile> {
  const path = `users/${user.uid}`;
  try {
    const userRef = doc(db, "users", user.uid);
    const initialProfile: Record<string, unknown> = {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || (user.email ? user.email.split("@")[0] : "Creator"),
      photoURL: user.photoURL || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      onboardingCompleted: false,
    };

    await setDoc(userRef, initialProfile);

    return {
      uid: user.uid,
      email: user.email || "",
      displayName: (initialProfile.displayName as string) || "Creator",
      photoURL: user.photoURL || null,
      createdAt: null,
      updatedAt: null,
      onboardingCompleted: false,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Obtain an existing user document or initialize a new one if it doesn't exist
 */
export async function getOrCreateUserAccount(user: AuthUser): Promise<UserProfile> {
  const existing = await getUserAccount(user.uid);
  if (existing) {
    return existing;
  }
  return createUserAccount(user);
}

/**
 * Complete onboarding and update the users/{uid} document with profile data
 */
export async function completeUserOnboarding(
  uid: string,
  data: OnboardingData
): Promise<UserProfile> {
  const path = `users/${uid}`;
  try {
    const userRef = doc(db, "users", uid);
    
    const updatePayload: Record<string, unknown> = {
      displayName: data.displayName.trim(),
      profession: data.profession,
      portfolioType: data.portfolioType,
      onboardingCompleted: true,
      updatedAt: serverTimestamp(),
    };

    if (data.customProfession && data.customProfession.trim()) {
      updatePayload.customProfession = data.customProfession.trim();
    }

    if (data.location && data.location.trim()) {
      updatePayload.location = data.location.trim();
    }

    await updateDoc(userRef, updatePayload);

    const refreshed = await getUserAccount(uid);
    if (!refreshed) {
      throw new Error("Failed to retrieve updated user profile after onboarding completion.");
    }
    return refreshed;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
