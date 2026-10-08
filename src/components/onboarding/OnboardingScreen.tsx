import React, { useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { brand } from "../../config/branding";
import { useAuth } from "../../lib/authContext";
import { userFacingWriteError } from "../../lib/accountLoad";
import { normalizeWhatsappNumber } from "../../lib/accountContact";
import {
  draftFromAccount,
  hasErrors,
  stepFromAccount,
  validateAbout,
  validateGoals,
  validatePersonal,
  validateProfessional,
} from "../../lib/onboardingFoundation";
import type { FoundationDraft, OnboardingStep } from "../../types";
import { OnboardingProgress } from "./OnboardingProgress";
import { WelcomeStep } from "./WelcomeStep";
import { AboutYouStep } from "./AboutYouStep";
import { PersonalDetailsStep } from "./PersonalDetailsStep";
import { ProfessionalIdentityStep } from "./ProfessionalIdentityStep";
import { PortfolioGoalStep } from "./PortfolioGoalStep";
import { ReadyStep } from "./ReadyStep";

interface OnboardingScreenProps {
  onDiscover: () => void;
}

const FORM_STEP_INDEX: Partial<Record<OnboardingStep, number>> = {
  about: 1,
  personal: 2,
  professional: 3,
  goal: 4,
};

const PREVIOUS_STEP: Partial<Record<OnboardingStep, OnboardingStep>> = {
  about: "welcome",
  personal: "about",
  professional: "personal",
  goal: "professional",
  ready: "goal",
};

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onDiscover }) => {
  const { user, userAccount, saveOnboardingProgress, finishOnboardingFoundation, signOutUser } = useAuth();
  const [step, setStep] = useState<OnboardingStep>(() => stepFromAccount(userAccount));
  const [draft, setDraft] = useState<FoundationDraft>(() => draftFromAccount(userAccount, user));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const patchDraft = (patch: Partial<FoundationDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setFieldErrors({});
  };

  const whatsappError = () => {
    const phone = normalizeWhatsappNumber(draft.whatsappNumber);
    return phone.ok === false ? phone.error : null;
  };

  const persist = async (nextStep: OnboardingStep, ready = false) => {
    if (savingRef.current) return;
    const invalidWhatsapp = whatsappError();
    if (invalidWhatsapp) {
      setFieldErrors({ whatsappNumber: invalidWhatsapp });
      setStep("personal");
      return;
    }
    savingRef.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = ready ? await finishOnboardingFoundation(draft) : await saveOnboardingProgress(draft, nextStep);
      setDraft((current) => ({
        ...current,
        whatsappNumber: updated.contact?.whatsappNumber ?? "",
        emailUpdatesOptIn: updated.marketing?.emailUpdatesOptIn ?? false,
        emailUpdatesConsentAt: updated.marketing?.emailUpdatesConsentAt ?? null,
        emailUpdatesConsentVersion: updated.marketing?.emailUpdatesConsentVersion ?? null,
      }));
      if (ready) onDiscover();
      else setStep(nextStep);
    } catch (error) {
      console.error("Onboarding save failed:", error);
      setSaveError(userFacingWriteError(error, "We couldn't save your information. Please try again."));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const continueForward = () => {
    if (step === "welcome") {
      void persist("about");
      return;
    }
    if (step === "about") {
      const errors = validateAbout(draft);
      if (hasErrors(errors)) {
        setFieldErrors(errors);
        return;
      }
      void persist("personal");
      return;
    }
    if (step === "personal") {
      const errors = validatePersonal(draft);
      if (hasErrors(errors)) {
        setFieldErrors(errors);
        return;
      }
      void persist("professional");
      return;
    }
    if (step === "professional") {
      const errors = validateProfessional(draft);
      if (hasErrors(errors)) {
        setFieldErrors(errors);
        return;
      }
      void persist("goal");
      return;
    }
    if (step === "goal") {
      const errors = validateGoals(draft);
      if (hasErrors(errors)) {
        setFieldErrors(errors);
        return;
      }
      void persist("ready");
      return;
    }
    void persist("ready", true);
  };

  const goBack = () => {
    const previous = PREVIOUS_STEP[step];
    if (!previous || savingRef.current) return;
    const invalidWhatsapp = whatsappError();
    if (invalidWhatsapp) {
      setFieldErrors({ whatsappNumber: invalidWhatsapp });
      setStep("personal");
      return;
    }
    setFieldErrors({});
    setStep(previous);
    savingRef.current = true;
    setIsSaving(true);
    void saveOnboardingProgress(draft, previous)
      .catch((error) => {
        console.error("Onboarding back-save failed:", error);
        setSaveError(userFacingWriteError(error, "We couldn't save your information. Please try again."));
      })
      .finally(() => {
        savingRef.current = false;
        setIsSaving(false);
      });
  };

  const progressIndex = FORM_STEP_INDEX[step];

  return (
    <div id="onboarding-screen" className="min-h-screen bg-[#F8F8F7] text-[#243838]">
      <div className="pointer-events-none fixed left-0 top-0 z-30 h-full w-1 bg-gradient-to-b from-[#708595] to-[#6DAEAD]" />
      <header className="flex items-center justify-between gap-4 px-5 py-5 sm:px-10">
        <div>
          <p className="text-lg font-bold tracking-[-0.04em]">{brand.name}</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5C7372]">{brand.endorsement}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {progressIndex && <OnboardingProgress currentStep={progressIndex} totalSteps={4} />}
          <button type="button" onClick={() => void signOutUser()} className="text-sm font-bold text-[#3E7574]">
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl px-5 pb-20 pt-4 sm:px-10 sm:pt-10">
        <AnimatePresence mode="wait">
          {step === "welcome" && (
            <WelcomeStep key="welcome" onContinue={continueForward} isSaving={isSaving} saveError={saveError} />
          )}
          {step === "about" && (
            <AboutYouStep
              key="about"
              draft={draft}
              errors={fieldErrors}
              saveError={saveError}
              isSaving={isSaving}
              onChange={patchDraft}
              onContinue={continueForward}
              onBack={goBack}
            />
          )}
          {step === "personal" && (
            <PersonalDetailsStep
              key="personal"
              draft={draft}
              email={userAccount?.accountPrivate?.email || userAccount?.email || user?.email || ""}
              errors={fieldErrors}
              saveError={saveError}
              isSaving={isSaving}
              onChange={patchDraft}
              onContinue={continueForward}
              onBack={goBack}
            />
          )}
          {step === "professional" && (
            <ProfessionalIdentityStep
              key="professional"
              draft={draft}
              errors={fieldErrors}
              saveError={saveError}
              isSaving={isSaving}
              onChange={patchDraft}
              onContinue={continueForward}
              onBack={goBack}
            />
          )}
          {step === "goal" && (
            <PortfolioGoalStep
              key="goal"
              draft={draft}
              errors={fieldErrors}
              saveError={saveError}
              isSaving={isSaving}
              onChange={patchDraft}
              onContinue={continueForward}
              onBack={goBack}
            />
          )}
          {step === "ready" && (
            <ReadyStep
              key="ready"
              onContinue={continueForward}
              onBack={goBack}
              isSaving={isSaving}
              saveError={saveError}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};
