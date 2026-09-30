import React from "react";
import { motion } from "motion/react";
import { brand } from "../../config/branding";
import { Button } from "../ui/Button";

interface WelcomeStepProps {
  onContinue: () => void;
  isSaving: boolean;
  saveError: string | null;
}

export const WelcomeStep: React.FC<WelcomeStepProps> = ({ onContinue, isSaving, saveError }) => {
  return (
    <motion.section
      id="onboarding-welcome"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">{brand.endorsement}</p>
      <h1 className="mt-3 max-w-xl text-4xl font-bold leading-[1.05] tracking-[-0.045em] text-[#243838] sm:text-6xl">
        Welcome.
      </h1>
      <p className="mt-5 max-w-lg text-base font-medium leading-relaxed text-[#5C7372] sm:text-lg">
        We'll take a few quiet steps to learn who you are. Then you can find a portfolio direction that fits your work.
      </p>
      {saveError && <p className="mt-5 text-sm font-medium text-[#B93838]">{saveError}</p>}
      <div className="mt-10">
        <Button id="welcome-continue" size="lg" isLoading={isSaving} onClick={onContinue} className="w-full sm:w-auto">
          Continue
        </Button>
      </div>
    </motion.section>
  );
};
