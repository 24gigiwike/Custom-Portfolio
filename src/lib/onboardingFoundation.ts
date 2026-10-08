import type {
  AccountPrivate,
  FoundationDraft,
  OnboardingStep,
  PortfolioPreferences,
  ProfessionalProfile,
  UserProfile,
} from "../types";
import { normalizeWhatsappNumber, readAccountContact } from "./accountContact";

export const PROFESSIONAL_CATEGORIES = [
  "Designer",
  "Developer",
  "Engineer",
  "Photographer",
  "Writer",
  "Consultant",
  "Creative",
  "Researcher",
  "Student",
  "Freelancer",
  "Personal Brand",
  "Other",
] as const;

export const PORTFOLIO_GOALS = [
  "Get hired",
  "Find clients",
  "Showcase my work",
  "Build my personal brand",
  "Share my expertise",
  "Apply for opportunities",
  "Document my career",
  "Other",
] as const;

const STEPS = new Set<OnboardingStep>([
  "welcome",
  "about",
  "personal",
  "professional",
  "goal",
  "ready",
]);

export function emptyDraft(): FoundationDraft {
  return {
    firstName: "",
    lastName: "",
    photoURL: null,
    photoPath: null,
    dateOfBirth: "",
    categories: [],
    otherCategory: "",
    title: "",
    description: "",
    goals: [],
    otherGoal: "",
    whatsappNumber: "",
    emailUpdatesOptIn: false,
    emailUpdatesConsentAt: null,
    emailUpdatesConsentVersion: null,
  };
}

export function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === "string" && STEPS.has(value as OnboardingStep);
}

function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function draftFromAccount(
  account: UserProfile | null,
  fallback?: { displayName?: string | null; email?: string | null; photoURL?: string | null }
): FoundationDraft {
  const draft = emptyDraft();
  const named = splitDisplayName(account?.displayName || fallback?.displayName || "");
  const privateAccount = account?.accountPrivate;
  const professional = account?.professionalProfile;
  const preferences = account?.portfolioPreferences;

  draft.firstName = privateAccount?.firstName || named.firstName;
  draft.lastName = privateAccount?.lastName || named.lastName;
  draft.dateOfBirth = privateAccount?.dateOfBirth || "";
  draft.photoURL = professional?.photoURL || account?.photoURL || fallback?.photoURL || null;
  draft.photoPath = professional?.photoPath || null;
  draft.title = professional?.title || account?.profession || "";
  draft.description = professional?.description || "";

  const storedCategories = professional?.categories?.length
    ? professional.categories
    : account?.profession && PROFESSIONAL_CATEGORIES.includes(account.profession as (typeof PROFESSIONAL_CATEGORIES)[number])
      ? [account.profession]
      : [];

  const known = new Set<string>(PROFESSIONAL_CATEGORIES);
  draft.categories = storedCategories.filter((item) => known.has(item));
  const customCategory = storedCategories.find((item) => !known.has(item));
  if (customCategory) {
    draft.categories = [...draft.categories.filter((item) => item !== "Other"), "Other"];
    draft.otherCategory = customCategory;
  } else if (account?.customProfession && draft.categories.includes("Other")) {
    draft.otherCategory = account.customProfession;
  }

  const storedGoals = preferences?.goals || [];
  const knownGoals = new Set<string>(PORTFOLIO_GOALS);
  draft.goals = storedGoals.filter((item) => knownGoals.has(item));
  const customGoal = storedGoals.find((item) => !knownGoals.has(item));
  if (customGoal) {
    draft.goals = [...draft.goals.filter((item) => item !== "Other"), "Other"];
    draft.otherGoal = customGoal;
  }

  const contact = readAccountContact(
    account ? { contact: account.contact, marketing: account.marketing } : null,
  );
  draft.whatsappNumber = contact.contact.whatsappNumber;
  draft.emailUpdatesOptIn = contact.marketing.emailUpdatesOptIn;
  draft.emailUpdatesConsentAt = contact.marketing.emailUpdatesConsentAt;
  draft.emailUpdatesConsentVersion = contact.marketing.emailUpdatesConsentVersion;

  return draft;
}

export function stepFromAccount(account: UserProfile | null): OnboardingStep {
  const step = account?.onboarding?.currentStep;
  if (isOnboardingStep(step)) return step;
  return "welcome";
}

export function validateAbout(draft: FoundationDraft): { firstName?: string; lastName?: string } {
  const errors: { firstName?: string; lastName?: string } = {};
  if (!draft.firstName.trim()) errors.firstName = "Please enter your first name.";
  if (!draft.lastName.trim()) errors.lastName = "Please enter your last name.";
  return errors;
}

export function validatePersonal(draft: FoundationDraft): { dateOfBirth?: string; whatsappNumber?: string } {
  const errors: { dateOfBirth?: string; whatsappNumber?: string } = {};
  if (!draft.dateOfBirth) errors.dateOfBirth = "Please enter your date of birth.";
  else {
    const parsed = new Date(`${draft.dateOfBirth}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) errors.dateOfBirth = "Please enter a valid date of birth.";
    else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (parsed > today) errors.dateOfBirth = "Date of birth can't be in the future.";
    }
  }
  const phone = normalizeWhatsappNumber(draft.whatsappNumber);
  if (phone.ok === false) errors.whatsappNumber = phone.error;
  return errors;
}

export function validateProfessional(draft: FoundationDraft): {
  categories?: string;
  otherCategory?: string;
  title?: string;
  description?: string;
} {
  const errors: {
    categories?: string;
    otherCategory?: string;
    title?: string;
    description?: string;
  } = {};
  if (draft.categories.length === 0) errors.categories = "Select at least one profession.";
  if (draft.categories.includes("Other") && !draft.otherCategory.trim()) {
    errors.otherCategory = "Tell us the profession that fits you.";
  }
  if (!draft.title.trim()) errors.title = "Please enter your professional title.";
  if (!draft.description.trim()) errors.description = "Please add a short professional description.";
  return errors;
}

export function validateGoals(draft: FoundationDraft): { goals?: string; otherGoal?: string } {
  const errors: { goals?: string; otherGoal?: string } = {};
  if (draft.goals.length === 0) errors.goals = "Select at least one goal.";
  if (draft.goals.includes("Other") && !draft.otherGoal.trim()) {
    errors.otherGoal = "Tell us the goal that fits you.";
  }
  return errors;
}

export function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}

export function displayNameFromDraft(draft: FoundationDraft): string {
  return `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim();
}

export function resolvedCategories(draft: FoundationDraft): string[] {
  return draft.categories.map((category) =>
    category === "Other" ? draft.otherCategory.trim() : category
  ).filter(Boolean);
}

export function resolvedGoals(draft: FoundationDraft): string[] {
  return draft.goals.map((goal) => (goal === "Other" ? draft.otherGoal.trim() : goal)).filter(Boolean);
}

export function toAccountPrivate(draft: FoundationDraft, email: string): AccountPrivate {
  return {
    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    dateOfBirth: draft.dateOfBirth || null,
    email,
  };
}

export function toProfessionalProfile(draft: FoundationDraft): ProfessionalProfile {
  return {
    categories: resolvedCategories(draft),
    title: draft.title.trim(),
    description: draft.description.trim(),
    photoURL: draft.photoURL,
    photoPath: draft.photoPath,
  };
}

export function toPortfolioPreferences(draft: FoundationDraft): PortfolioPreferences {
  return { goals: resolvedGoals(draft) };
}

/**
 * Fields that may later seed a portfolio. Private account data stays out.
 */
export function publicProfessionalSeed(draft: FoundationDraft) {
  return {
    displayName: displayNameFromDraft(draft),
    title: draft.title.trim(),
    description: draft.description.trim(),
    categories: resolvedCategories(draft),
    photoURL: draft.photoURL,
  };
}
