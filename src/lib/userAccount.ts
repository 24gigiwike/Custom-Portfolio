import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import type { AuthUser, FoundationDraft, OnboardingStep, UserProfile } from "../types";
import { accountContactPayload, readAccountContact } from "./accountContact";
import {
  displayNameFromDraft,
  draftFromAccount,
  isOnboardingStep,
  resolvedCategories,
  stepFromAccount,
  toAccountPrivate,
  toPortfolioPreferences,
  toProfessionalProfile,
} from "./onboardingFoundation";

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
      return mapUserAccount(uid, docSnap.data());
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
 * Save onboarding progress on the private user document.
 * This does not create a portfolio and does not mark the legacy workspace as ready.
 */
export async function saveFoundationProgress(
  uid: string,
  draft: FoundationDraft,
  step: OnboardingStep,
  options?: { readyForTemplates?: boolean }
): Promise<UserProfile> {
  const path = `users/${uid}`;
  const readyForTemplates = Boolean(options?.readyForTemplates);
  const email = auth.currentUser?.email || "";
  const professional = toProfessionalProfile(draft);
  const categories = resolvedCategories(draft);
  const preferences = accountContactPayload(draft, new Date().toISOString());

  try {
    const userRef = doc(db, "users", uid);
    await setDoc(
      userRef,
      {
        displayName: displayNameFromDraft(draft) || auth.currentUser?.displayName || "",
        photoURL: professional.photoURL,
        profession: professional.title || categories[0] || "",
        customProfession: draft.categories.includes("Other") ? draft.otherCategory.trim() : "",
        accountPrivate: toAccountPrivate(draft, email),
        contact: preferences.contact,
        marketing: preferences.marketing,
        professionalProfile: professional,
        portfolioPreferences: toPortfolioPreferences(draft),
        onboarding: {
          completed: false,
          readyForTemplates,
          currentStep: readyForTemplates ? "ready" : step,
          version: 1,
        },
        onboardingCompleted: false,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const refreshed = await getUserAccount(uid);
    if (!refreshed) {
      throw new Error("Failed to retrieve your account after saving.");
    }
    return refreshed;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Update only the private contact preferences on users/{uid}.
 * Does not create a portfolio or change onboarding completion.
 */
export async function saveAccountContactPreferences(
  uid: string,
  draft: Pick<
    FoundationDraft,
    "whatsappNumber" | "emailUpdatesOptIn" | "emailUpdatesConsentAt" | "emailUpdatesConsentVersion"
  >,
  nowIso = new Date().toISOString(),
): Promise<UserProfile> {
  const path = `users/${uid}`;
  const preferences = accountContactPayload(draft, nowIso);
  try {
    const userRef = doc(db, "users", uid);
    await setDoc(
      userRef,
      {
        contact: preferences.contact,
        marketing: preferences.marketing,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    const refreshed = await getUserAccount(uid);
    if (!refreshed) throw new Error("Failed to retrieve your account after saving.");
    return refreshed;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

function mapUserAccount(uid: string, data: Record<string, unknown>): UserProfile {
  const onboardingData = isRecord(data.onboarding) ? data.onboarding : undefined;
  const privateData = isRecord(data.accountPrivate) ? data.accountPrivate : undefined;
  const professionalData = isRecord(data.professionalProfile) ? data.professionalProfile : undefined;
  const preferenceData = isRecord(data.portfolioPreferences) ? data.portfolioPreferences : undefined;
  const storedContact = readAccountContact(data);
  const currentStep = onboardingData?.currentStep;

  const account: UserProfile = {
    uid,
    email: typeof data.email === "string" ? data.email : "",
    displayName: typeof data.displayName === "string" ? data.displayName : "",
    photoURL: typeof data.photoURL === "string" ? data.photoURL : null,
    createdAt: (data.createdAt as UserProfile["createdAt"]) || null,
    updatedAt: (data.updatedAt as UserProfile["updatedAt"]) || null,
    onboardingCompleted: Boolean(data.onboardingCompleted),
    profession: typeof data.profession === "string" ? data.profession : undefined,
    customProfession: typeof data.customProfession === "string" ? data.customProfession : undefined,
    portfolioType: typeof data.portfolioType === "string" ? data.portfolioType : undefined,
    location: typeof data.location === "string" ? data.location : undefined,
  };

  if (onboardingData) {
    account.onboarding = {
      completed: Boolean(onboardingData.completed),
      readyForTemplates: Boolean(onboardingData.readyForTemplates),
      currentStep: isOnboardingStep(currentStep) ? currentStep : "welcome",
      version: 1,
    };
  }

  account.contact = storedContact.contact;
  account.marketing = storedContact.marketing;

  if (privateData) {
    account.accountPrivate = {
      firstName: typeof privateData.firstName === "string" ? privateData.firstName : "",
      lastName: typeof privateData.lastName === "string" ? privateData.lastName : "",
      dateOfBirth: typeof privateData.dateOfBirth === "string" ? privateData.dateOfBirth : null,
      email: typeof privateData.email === "string" ? privateData.email : account.email,
    };
  }

  if (professionalData) {
    account.professionalProfile = {
      categories: stringList(professionalData.categories),
      title: typeof professionalData.title === "string" ? professionalData.title : "",
      description: typeof professionalData.description === "string" ? professionalData.description : "",
      photoURL: typeof professionalData.photoURL === "string" ? professionalData.photoURL : null,
      photoPath: typeof professionalData.photoPath === "string" ? professionalData.photoPath : null,
    };
  }

  if (preferenceData) {
    account.portfolioPreferences = { goals: stringList(preferenceData.goals) };
  }

  return account;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export { draftFromAccount, stepFromAccount };
