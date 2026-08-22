import React from "react";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
}

export const OnboardingProgress: React.FC<OnboardingProgressProps> = ({
  currentStep,
  totalSteps,
}) => {
  const formattedCurrent = String(currentStep).padStart(2, "0");
  const formattedTotal = String(totalSteps).padStart(2, "0");

  return (
    <div
      id="onboarding-step-indicator"
      className="flex items-center gap-3 select-none"
    >
      <span className="font-mono text-xs tracking-widest text-[#708595]">
        {formattedCurrent} <span className="text-[#849693]/50">/</span> {formattedTotal}
      </span>
      <div className="w-16 h-[2px] bg-[#E5E5E1] rounded-full overflow-hidden relative">
        <div
          className="h-full bg-gradient-to-r from-[#708595] to-[#6DAEAD] transition-all duration-500 ease-out"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>
    </div>
  );
};
