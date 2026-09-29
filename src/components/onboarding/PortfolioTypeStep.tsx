import React, { useState } from "react";
import { motion } from "motion/react";
import { Button } from "../ui/Button";
import { ArrowLeft, ArrowRight, AlertCircle, Check } from "lucide-react";

interface PortfolioTypeStepProps {
  initialPortfolioType?: string;
  onNext: (portfolioType: string) => void;
  onBack: () => void;
}

const PORTFOLIO_TYPES = [
  {
    id: "Professional Portfolio",
    title: "Professional Portfolio",
    description: "Tailored for industry positions, enterprise roles, and corporate leadership.",
  },
  {
    id: "Creative Portfolio",
    title: "Creative Portfolio",
    description: "Curated showcase for visual artists, designers, architects, and studio work.",
  },
  {
    id: "Personal Brand",
    title: "Personal Brand",
    description: "Thought leadership, writing, publications, speaking, and personal projects.",
  },
  {
    id: "Freelance Portfolio",
    title: "Freelance Portfolio",
    description: "Client case studies, service offerings, testimonials, and booking requests.",
  },
  {
    id: "Student / Graduate Portfolio",
    title: "Student / Graduate Portfolio",
    description: "Academic projects, research initiatives, early work, and internships.",
  },
] as const;

export const PortfolioTypeStep: React.FC<PortfolioTypeStepProps> = ({
  initialPortfolioType = "",
  onNext,
  onBack,
}) => {
  const [selectedType, setSelectedType] = useState<string>(initialPortfolioType);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType) {
      setValidationError("Please select the type of portfolio you are creating.");
      return;
    }
    setValidationError(null);
    onNext(selectedType);
  };

  return (
    <motion.form
      id="onboarding-step-portfolio-type"
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="w-full flex flex-col items-start text-left"
    >
      <span className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">
        Step 03 — Purpose
      </span>

      <h2 className="mb-3 text-3xl font-bold leading-[1.1] tracking-[-0.04em] text-[#243838] sm:text-4xl">
        What are you creating?
      </h2>

      <p className="mb-8 text-base text-[#5C7372]">
        This sets the strategic context for your presence.
      </p>

      {/* List of Portfolio Types */}
      <div className="w-full flex flex-col gap-3 mb-6">
        {PORTFOLIO_TYPES.map((type) => {
          const isSelected = selectedType === type.id;
          return (
            <button
              key={type.id}
              type="button"
              id={`portfolio-type-${type.id.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
              onClick={() => {
                setSelectedType(type.id);
                if (validationError) setValidationError(null);
              }}
              className={`flex w-full items-start justify-between gap-4 rounded-2xl border p-4 text-left transition-all duration-200 select-none ${
                isSelected
                  ? "border-[#6DAEAD] bg-[#E7F4F3] shadow-[0_10px_24px_rgba(109,174,173,0.14)]"
                  : "border-[#D5E6E5] bg-[#F7FBFA] hover:border-[#6DAEAD] hover:bg-white"
              }`}
            >
              <div className="flex-1">
                <div className="mb-0.5 text-base font-bold text-[#243838]">
                  {type.title}
                </div>
                <div className="text-xs font-medium leading-relaxed text-[#5C7372]">
                  {type.description}
                </div>
              </div>
              <div
                className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ${
                  isSelected
                    ? "border-[#6DAEAD] bg-[#6DAEAD] text-white"
                    : "border-[#D5E6E5] bg-white text-transparent"
                }`}
              >
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
            </button>
          );
        })}
      </div>

      {validationError && (
        <div className="mb-6 flex items-center gap-1.5 text-xs font-medium text-[#B93838]">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      <div className="flex w-full items-center justify-between gap-3 border-t border-[#E7F4F3] pt-5">
        <Button
          id="type-step-back-button"
          type="button"
          variant="outline"
          onClick={onBack}
          leftIcon={<ArrowLeft className="w-4 h-4 mr-1 text-[#5C7372]" />}
        >
          Back
        </Button>
        <Button
          id="type-step-continue-button"
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
