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
      <span className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">
        Step 01 — Identity
      </span>

      <h2 className="mb-3 text-3xl font-bold leading-[1.1] tracking-[-0.04em] text-[#243838] sm:text-4xl">
        Let&apos;s start with you.
      </h2>

      <p className="mb-8 text-base text-[#5C7372]">
        What should we call you?
      </p>

      <div className="w-full mb-6">
        <label
          htmlFor="name-input"
          className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#3E7574]"
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
          className="w-full rounded-xl border border-[#D5E6E5] bg-[#F7FBFA] px-4 py-3.5 text-xl font-semibold text-[#243838] shadow-none transition-all duration-200 placeholder:text-[#8AADAC] focus:border-[#6DAEAD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6DAEAD]/30 sm:text-2xl"
        />
        {validationError && (
          <div className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-[#B93838]">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}
      </div>

      <div className="flex w-full items-center justify-end border-t border-[#E7F4F3] pt-5">
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
