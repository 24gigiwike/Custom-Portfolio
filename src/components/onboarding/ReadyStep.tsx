import React from "react";
import { motion } from "motion/react";
import { Button } from "../ui/Button";

interface ReadyStepProps {
  onContinue: () => void;
  onBack: () => void;
  isSaving: boolean;
  saveError: string | null;
}

export const ReadyStep: React.FC<ReadyStepProps> = ({ onContinue, onBack, isSaving, saveError }) => {
  return (
    <motion.section
      id="onboarding-ready"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">Ready</p>
      <h1 className="mt-3 max-w-xl text-4xl font-bold leading-[1.05] tracking-[-0.045em] text-[#243838] sm:text-5xl">
        You're ready to build your portfolio.
      </h1>
      <p className="mt-5 max-w-lg text-base font-medium leading-relaxed text-[#5C7372]">
        We've got to know you. Next, we'll help you find a portfolio direction that fits your work.
      </p>
      {saveError && <p className="mt-5 text-sm font-medium text-[#B93838]">{saveError}</p>}
      <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <Button id="ready-back" type="button" variant="ghost" onClick={onBack} disabled={isSaving}>
          Back
        </Button>
        <Button id="find-starting-point" size="lg" isLoading={isSaving} onClick={onContinue} className="w-full sm:w-auto">
          Find my starting point
        </Button>
      </div>
    </motion.section>
  );
};
