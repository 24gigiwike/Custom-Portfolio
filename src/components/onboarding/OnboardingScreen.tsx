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

  return (
    <div
      id="onboarding-screen"
      className="relative min-h-screen w-full flex flex-col justify-between items-center px-6 sm:px-12 py-10 sm:py-12 bg-[#F8F8F7] text-[#1A1A1B] selection:bg-[#6DAEAD]/20 overflow-x-hidden"
    >
      {/* Foundation Accent Bar */}
      <div className="fixed left-0 top-0 w-1 h-full bg-gradient-to-b from-[#708595] to-[#6DAEAD] z-30 pointer-events-none" />

      {/* Top Header */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-4xl flex items-center justify-between pt-2 pb-6 border-b border-[#E5E5E1]"
      >
        <div className="flex items-baseline gap-3">
          <div className="text-[20px] font-medium tracking-[-0.03em] text-[#1A1A1B]">
            {brand.name}
          </div>
          <div className="font-support text-[11px] uppercase tracking-[0.15em] text-[#708595] hidden sm:block">
            {brand.endorsement}
          </div>
        </div>

        <OnboardingProgress currentStep={currentStep} totalSteps={4} />
      </motion.header>

      {/* Main Step Container */}
      <main className="w-full max-w-2xl flex flex-col items-center my-auto py-8 sm:py-12">
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

      {/* Legal Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between text-[10px] sm:text-[11px] uppercase tracking-[0.12em] text-[#849693] pt-6 border-t border-[#E5E5E1] gap-3"
      >
        <div>&copy; 2024 BroadBrand. All Rights Reserved.</div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6DAEAD]" />
          <span>Account Setup</span>
        </div>
      </motion.footer>
    </div>
  );
};
