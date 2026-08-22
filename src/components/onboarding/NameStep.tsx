import React, { useState } from "react";
import { motion } from "motion/react";
import { Button } from "../ui/Button";
import { ArrowRight, AlertCircle } from "lucide-react";

interface NameStepProps {
  initialValue: string;
  onNext: (name: string) => void;
}

export const NameStep: React.FC<NameStepProps> = ({ initialValue, onNext }) => {
  const [name, setName] = useState(initialValue);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setValidationError("Tell us what we should call you.");
      return;
    }
    setValidationError(null);
    onNext(trimmed);
  };

  return (
    <motion.form
      id="onboarding-step-name"
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="w-full flex flex-col items-start text-left"
    >
      <span className="font-support text-[11px] uppercase tracking-[0.18em] text-[#708595] mb-2.5">
        Step 01 &mdash; Identity
      </span>

      <h1 className="text-3xl sm:text-4xl md:text-[46px] font-light md:font-[300] leading-[1.12] tracking-[-0.04em] text-[#1A1A1B] mb-3">
        Let&apos;s start with you.
      </h1>

      <p className="text-base text-[#708595] mb-8 font-normal">
        What should we call you?
      </p>

      <div className="w-full mb-6">
        <label
          htmlFor="name-input"
          className="block text-xs uppercase tracking-[0.1em] font-medium text-[#708595] mb-2 font-support"
        >
          Your preferred name
        </label>
        <input
          id="name-input"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (validationError) setValidationError(null);
          }}
          placeholder="e.g. Maya Chen"
          autoFocus
          className="w-full text-xl sm:text-2xl font-light text-[#1A1A1B] bg-white border border-[#E5E5E1] rounded-[2px] px-4 py-3.5 focus:outline-none focus:border-[#6DAEAD] focus:ring-1 focus:ring-[#6DAEAD] transition-all duration-200 placeholder:text-[#849693]/40 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
        />
        {validationError && (
          <div className="flex items-center gap-1.5 mt-2.5 text-xs text-[#B93838]">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}
      </div>

      <div className="w-full flex items-center justify-end pt-4 border-t border-[#E5E5E1]/60">
        <Button
          id="name-step-continue-button"
          type="submit"
          variant="primary"
          size="lg"
          rightIcon={<ArrowRight className="w-4 h-4 ml-1" />}
          className="w-full sm:w-auto min-w-[140px]"
        >
          Continue
        </Button>
      </div>
    </motion.form>
  );
};
