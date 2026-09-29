import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { brand } from "../../config/branding";
import { useAuth } from "../../lib/authContext";
import { OnboardingProgress } from "./OnboardingProgress";
import { NameStep } from "./NameStep";
import { ProfessionStep } from "./ProfessionStep";
import { PortfolioTypeStep } from "./PortfolioTypeStep";
import { LocationStep } from "./LocationStep";
import type { OnboardingData } from "../../types";

interface OnboardingScreenProps {
  onCompleted: () => void;
}

const STEP_COPY = [
  { kicker: "Identity", title: "Start with the name people should remember." },
  { kicker: "Craft", title: "Name the work you actually do." },
  { kicker: "Purpose", title: "Choose the presence you are building." },
  { kicker: "Origin", title: "Place yourself, if you want to." },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onCompleted }) => {
  const { user, userAccount, saveOnboarding } = useAuth();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<OnboardingData>({
    displayName: userAccount?.displayName || user?.displayName || "",
    profession: userAccount?.profession || "",
    customProfession: userAccount?.customProfession || "",
    portfolioType: userAccount?.portfolioType || "",
    location: userAccount?.location || "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleNameComplete = (name: string) => {
    setFormData((prev) => ({ ...prev, displayName: name }));
    setCurrentStep(2);
  };

  const handleProfessionComplete = (profession: string, customProfession?: string) => {
    setFormData((prev) => ({
      ...prev,
      profession,
      customProfession: customProfession || "",
    }));
    setCurrentStep(3);
  };

  const handlePortfolioTypeComplete = (portfolioType: string) => {
    setFormData((prev) => ({ ...prev, portfolioType }));
    setCurrentStep(4);
  };

  const handleLocationSubmit = async (location?: string) => {
    const finalData: OnboardingData = {
      ...formData,
      location: location || "",
    };

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await saveOnboarding(finalData);
      onCompleted();
    } catch (err) {
      console.error("Onboarding submission failed:", err);
      setSubmitError("We couldn't save your information. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepCopy = STEP_COPY[currentStep - 1];

  return (
    <div
      id="onboarding-screen"
      className="min-h-screen bg-[#F3FAF9] text-[#243838] selection:bg-[#6DAEAD]/25"
    >
      <div className="mx-auto grid min-h-screen w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:py-8">
        <aside className="relative flex flex-col justify-between overflow-hidden rounded-[28px] bg-[#6DAEAD] px-7 py-8 text-white sm:px-10">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-bold tracking-[-0.04em]">{brand.name}</div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">
              Account setup
            </div>
          </div>
          <div className="py-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/75">
              {stepCopy.kicker}
            </p>
            <h1 className="mt-3 max-w-sm text-4xl font-bold leading-[1.05] tracking-[-0.045em] sm:text-5xl">
              {stepCopy.title}
            </h1>
          </div>
          <OnboardingProgress currentStep={currentStep} totalSteps={4} tone="inverse" />
        </aside>

        <main className="flex flex-col justify-center rounded-[28px] border border-white/80 bg-white px-5 py-8 shadow-[0_16px_50px_rgba(109,174,173,0.08)] sm:px-10 sm:py-12">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <NameStep
                key="step-1"
                initialValue={formData.displayName}
                onNext={handleNameComplete}
              />
            )}

            {currentStep === 2 && (
              <ProfessionStep
                key="step-2"
                initialProfession={formData.profession}
                initialCustomProfession={formData.customProfession}
                onNext={handleProfessionComplete}
                onBack={() => setCurrentStep(1)}
              />
            )}

            {currentStep === 3 && (
              <PortfolioTypeStep
                key="step-3"
                initialPortfolioType={formData.portfolioType}
                onNext={handlePortfolioTypeComplete}
                onBack={() => setCurrentStep(2)}
              />
            )}

            {currentStep === 4 && (
              <LocationStep
                key="step-4"
                initialLocation={formData.location}
                isSubmitting={isSubmitting}
                submitError={submitError}
                onSubmit={handleLocationSubmit}
                onBack={() => setCurrentStep(3)}
              />
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};
