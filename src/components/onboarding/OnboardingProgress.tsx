import React from "react";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  tone?: "default" | "inverse";
}

export const OnboardingProgress: React.FC<OnboardingProgressProps> = ({
  currentStep,
  totalSteps,
  tone = "default",
}) => {
  const formattedCurrent = String(currentStep).padStart(2, "0");
  const formattedTotal = String(totalSteps).padStart(2, "0");

  return (
    <div id="onboarding-step-indicator" className="flex items-center gap-3 select-none">
      <span
        className={`text-xs font-bold tracking-[0.16em] ${
          tone === "inverse" ? "text-white" : "text-[#3E7574]"
        }`}
      >
        {formattedCurrent}
        <span className={tone === "inverse" ? "text-white/60" : "text-[#8AADAC]"}> / </span>
        {formattedTotal}
      </span>
      <div
        className={`relative h-1.5 w-24 overflow-hidden rounded-full ${
          tone === "inverse" ? "bg-white/25" : "bg-[#E7F4F3]"
        }`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            tone === "inverse" ? "bg-white" : "bg-[#6DAEAD]"
          }`}
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>
    </div>
  );
};
