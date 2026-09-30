import React from "react";
import { ChoiceGrid } from "./ChoiceGrid";
import { FieldError, fieldClass, StepFrame } from "./StepFrame";
import { PROFESSIONAL_CATEGORIES } from "../../lib/onboardingFoundation";
import type { FoundationDraft } from "../../types";

interface ProfessionalIdentityStepProps {
  draft: FoundationDraft;
  errors: {
    categories?: string;
    otherCategory?: string;
    title?: string;
    description?: string;
  };
  saveError: string | null;
  isSaving: boolean;
  onChange: (patch: Partial<FoundationDraft>) => void;
  onContinue: () => void;
  onBack: () => void;
}

export const ProfessionalIdentityStep: React.FC<ProfessionalIdentityStepProps> = ({
  draft,
  errors,
  saveError,
  isSaving,
  onChange,
  onContinue,
  onBack,
}) => {
  const toggle = (option: string) => {
    const categories = draft.categories.includes(option)
      ? draft.categories.filter((item) => item !== option)
      : [...draft.categories, option];
    onChange({ categories });
  };

  return (
    <StepFrame
      id="onboarding-professional"
      kicker="03 — Professional identity"
      title="What do you do?"
      copy="Tell us about your professional world. We'll use this later to help you find a portfolio direction that fits."
      onContinue={onContinue}
      onBack={onBack}
      isSaving={isSaving}
      saveError={saveError}
    >
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#3E7574]">
        Public professional information
      </p>
      <ChoiceGrid
        options={PROFESSIONAL_CATEGORIES}
        selected={draft.categories}
        onToggle={toggle}
        idPrefix="profession"
      />
      <FieldError message={errors.categories} />
      {draft.categories.includes("Other") && (
        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-semibold text-[#243838]">Your profession</span>
          <input
            id="other-profession-input"
            value={draft.otherCategory}
            onChange={(event) => onChange({ otherCategory: event.target.value })}
            className={fieldClass}
          />
          <FieldError message={errors.otherCategory} />
        </label>
      )}
      <label className="mt-6 block">
        <span className="mb-2 block text-sm font-semibold text-[#243838]">Professional title</span>
        <input
          id="professional-title-input"
          value={draft.title}
          placeholder="Product Designer"
          onChange={(event) => onChange({ title: event.target.value })}
          className={fieldClass}
        />
        <FieldError message={errors.title} />
      </label>
      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-semibold text-[#243838]">Short professional description</span>
        <textarea
          id="professional-description-input"
          value={draft.description}
          rows={4}
          placeholder="I design and build digital experiences for growing businesses."
          onChange={(event) => onChange({ description: event.target.value })}
          className={`${fieldClass} resize-y`}
        />
        <FieldError message={errors.description} />
      </label>
    </StepFrame>
  );
};
