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
      <span className="font-support text-[11px] uppercase tracking-[0.18em] text-[#708595] mb-2.5">
        Step 03 &mdash; Purpose
      </span>

      <h1 className="text-3xl sm:text-4xl md:text-[46px] font-light md:font-[300] leading-[1.12] tracking-[-0.04em] text-[#1A1A1B] mb-3">
        What are you creating?
      </h1>

      <p className="text-base text-[#708595] mb-8 font-normal">
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
              className={`w-full p-4 text-left border rounded-[2px] transition-all duration-200 select-none flex items-start justify-between gap-4 ${
                isSelected
                  ? "bg-white border-[#6DAEAD] ring-1 ring-[#6DAEAD] shadow-[0_2px_10px_rgba(109,174,173,0.12)]"
                  : "bg-white/80 border-[#E5E5E1] hover:border-[#708595]/50 hover:bg-white"
              }`}
            >
              <div className="flex-1">
                <div className="text-base font-medium text-[#1A1A1B] mb-0.5">
                  {type.title}
                </div>
                <div className="text-xs text-[#708595] font-normal leading-relaxed">
                  {type.description}
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors duration-150 ${
                  isSelected
                    ? "bg-[#6DAEAD] border-[#6DAEAD] text-white"
                    : "border-[#E5E5E1] bg-white text-transparent"
                }`}
              >
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
            </button>
          );
        })}
      </div>

      {validationError && (
        <div className="flex items-center gap-1.5 mb-6 text-xs text-[#B93838]">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      <div className="w-full flex items-center justify-between pt-4 border-t border-[#E5E5E1]/60 gap-3">
        <Button
          id="type-step-back-button"
          type="button"
          variant="outline"
          onClick={onBack}
          leftIcon={<ArrowLeft className="w-4 h-4 mr-1 text-[#708595]" />}
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
