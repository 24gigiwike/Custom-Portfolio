import React from "react";
import { ChoiceGrid } from "./ChoiceGrid";
import { FieldError, StepFrame, fieldClass } from "./StepFrame";
import { PORTFOLIO_GOALS } from "../../lib/onboardingFoundation";
import type { FoundationDraft } from "../../types";

interface PortfolioGoalStepProps {
  draft: FoundationDraft;
  errors: { goals?: string; otherGoal?: string };
  saveError: string | null;
  isSaving: boolean;
  onChange: (patch: Partial<FoundationDraft>) => void;
  onContinue: () => void;
  onBack: () => void;
}

export const PortfolioGoalStep: React.FC<PortfolioGoalStepProps> = ({
  draft,
  errors,
  saveError,
  isSaving,
  onChange,
  onContinue,
  onBack,
}) => {
  const toggle = (option: string) => {
    const goals = draft.goals.includes(option)
      ? draft.goals.filter((item) => item !== option)
      : [...draft.goals, option];
    onChange({ goals });
  };

  return (
    <StepFrame
      id="onboarding-goal"
      kicker="04 — Portfolio goal"
      title="What do you want your portfolio to help you do?"
      copy="Choose what matters most to you. We'll use this to help shape your starting point."
      onContinue={onContinue}
      onBack={onBack}
      isSaving={isSaving}
      saveError={saveError}
    >
      <div className="mb-4 rounded-2xl border border-[#D5E6E5] bg-[#F7FBFA] px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3E7574]">
          Private product preferences
        </p>
        <p className="mt-1 text-sm text-[#5C7372]">These choices stay private and are not shown on your portfolio.</p>
      </div>
      <ChoiceGrid options={PORTFOLIO_GOALS} selected={draft.goals} onToggle={toggle} idPrefix="goal" />
      <FieldError message={errors.goals} />
      {draft.goals.includes("Other") && (
        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-semibold text-[#243838]">Your goal</span>
          <input
            id="other-goal-input"
            value={draft.otherGoal}
            onChange={(event) => onChange({ otherGoal: event.target.value })}
            className={fieldClass}
          />
          <FieldError message={errors.otherGoal} />
        </label>
      )}
    </StepFrame>
  );
};
