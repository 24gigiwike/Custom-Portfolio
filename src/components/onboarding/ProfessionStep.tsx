import React, { useState } from "react";
import { motion } from "motion/react";
import { Button } from "../ui/Button";
import { ArrowLeft, ArrowRight, AlertCircle, Check } from "lucide-react";

interface ProfessionStepProps {
  initialProfession?: string;
  initialCustomProfession?: string;
  onNext: (profession: string, customProfession?: string) => void;
  onBack: () => void;
}

const PROFESSIONS = [
  "Developer",
  "Designer",
  "Engineer",
  "Photographer",
  "Writer",
  "Animator",
  "Creative",
  "Consultant",
  "Freelancer",
  "Student",
  "Researcher",
  "Other",
] as const;

export const ProfessionStep: React.FC<ProfessionStepProps> = ({
  initialProfession = "",
  initialCustomProfession = "",
  onNext,
  onBack,
}) => {
  const [selectedProfession, setSelectedProfession] = useState<string>(initialProfession);
  const [customProfession, setCustomProfession] = useState<string>(initialCustomProfession);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfession) {
      setValidationError("Choose what best describes your work.");
      return;
    }
    if (selectedProfession === "Other" && !customProfession.trim()) {
      setValidationError("Please specify your profession or title.");
      return;
    }
    setValidationError(null);
    onNext(
      selectedProfession,
      selectedProfession === "Other" ? customProfession.trim() : undefined
    );
  };

  return (
    <motion.form
      id="onboarding-step-profession"
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="w-full flex flex-col items-start text-left"
    >
      <span className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">
        Step 02 — Craft
      </span>

      <h2 className="mb-3 text-3xl font-bold leading-[1.1] tracking-[-0.04em] text-[#243838] sm:text-4xl">
        What do you do?
      </h2>

      <p className="mb-8 text-base text-[#5C7372]">
        Select what best describes your core discipline.
      </p>

      {/* Grid of Profession Options */}
      <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 mb-6">
        {PROFESSIONS.map((prof) => {
          const isSelected = selectedProfession === prof;
          return (
            <button
              key={prof}
              type="button"
              id={`profession-option-${prof.toLowerCase()}`}
              onClick={() => {
                setSelectedProfession(prof);
                if (validationError) setValidationError(null);
              }}
              className={`relative flex min-h-12 items-center justify-between rounded-xl border px-3.5 py-3 text-left text-sm font-bold select-none transition-all duration-200 ${
                isSelected
                  ? "border-[#6DAEAD] bg-[#E7F4F3] text-[#243838] shadow-[0_8px_20px_rgba(109,174,173,0.16)]"
                  : "border-[#D5E6E5] bg-[#F7FBFA] text-[#5C7372] hover:border-[#6DAEAD] hover:bg-white hover:text-[#243838]"
              }`}
            >
              <span className="truncate">{prof}</span>
              {isSelected && <Check className="ml-1.5 h-3.5 w-3.5 flex-shrink-0 text-[#3E7574]" />}
            </button>
          );
        })}
      </div>

      {/* Custom Input for 'Other' */}
      {selectedProfession === "Other" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="w-full mb-6"
        >
          <label
            htmlFor="custom-profession-input"
            className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#3E7574]"
          >
            Specify your discipline / craft
          </label>
          <input
            id="custom-profession-input"
            type="text"
            value={customProfession}
            onChange={(e) => {
              setCustomProfession(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder="e.g. Sound Architect, 3D Typographer"
            autoFocus
            className="w-full rounded-xl border border-[#D5E6E5] bg-[#F7FBFA] px-4 py-3 text-base font-semibold text-[#243838] transition-all duration-200 placeholder:text-[#8AADAC] focus:border-[#6DAEAD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6DAEAD]/30 sm:text-lg"
          />
        </motion.div>
      )}

      {validationError && (
        <div className="mb-6 flex items-center gap-1.5 text-xs font-medium text-[#B93838]">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      <div className="flex w-full items-center justify-between gap-3 border-t border-[#E7F4F3] pt-5">
        <Button
          id="profession-step-back-button"
          type="button"
          variant="outline"
          onClick={onBack}
          leftIcon={<ArrowLeft className="w-4 h-4 mr-1 text-[#5C7372]" />}
        >
          Back
        </Button>
        <Button
          id="profession-step-continue-button"
          type="submit"
          variant="primary"
          size="lg"
          rightIcon={<ArrowRight className="w-4 h-4 ml-1" />}
          className="min-w-[140px]"
        >
          Continue
        </Button>
      </div>
    </motion.form>
  );
};
