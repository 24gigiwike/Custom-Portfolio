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
      <span className="font-support text-[11px] uppercase tracking-[0.18em] text-[#708595] mb-2.5">
        Step 02 &mdash; Craft
      </span>

      <h1 className="text-3xl sm:text-4xl md:text-[46px] font-light md:font-[300] leading-[1.12] tracking-[-0.04em] text-[#1A1A1B] mb-3">
        What do you do?
      </h1>

      <p className="text-base text-[#708595] mb-8 font-normal">
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
              className={`relative flex items-center justify-between px-3.5 py-3 text-left border rounded-[2px] transition-all duration-200 text-sm font-medium select-none ${
                isSelected
                  ? "bg-white border-[#6DAEAD] text-[#1A1A1B] ring-1 ring-[#6DAEAD] shadow-[0_2px_8px_rgba(109,174,173,0.12)]"
                  : "bg-white/80 border-[#E5E5E1] text-[#708595] hover:border-[#708595]/50 hover:text-[#1A1A1B] hover:bg-white"
              }`}
            >
              <span className="truncate">{prof}</span>
              {isSelected && <Check className="w-3.5 h-3.5 text-[#6DAEAD] flex-shrink-0 ml-1.5" />}
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
            className="block text-xs uppercase tracking-[0.1em] font-medium text-[#708595] mb-2 font-support"
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
            className="w-full text-base sm:text-lg font-light text-[#1A1A1B] bg-white border border-[#E5E5E1] rounded-[2px] px-4 py-3 focus:outline-none focus:border-[#6DAEAD] focus:ring-1 focus:ring-[#6DAEAD] transition-all duration-200 placeholder:text-[#849693]/40 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
          />
        </motion.div>
      )}

      {validationError && (
        <div className="flex items-center gap-1.5 mb-6 text-xs text-[#B93838]">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      <div className="w-full flex items-center justify-between pt-4 border-t border-[#E5E5E1]/60 gap-3">
        <Button
          id="profession-step-back-button"
          type="button"
          variant="outline"
          onClick={onBack}
          leftIcon={<ArrowLeft className="w-4 h-4 mr-1 text-[#708595]" />}
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
