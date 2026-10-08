import React from "react";
import { AccountContactFields } from "../account/AccountContactFields";
import { FieldError, fieldClass, StepFrame } from "./StepFrame";
import type { FoundationDraft } from "../../types";

interface PersonalDetailsStepProps {
  draft: FoundationDraft;
  email: string;
  errors: { dateOfBirth?: string; whatsappNumber?: string };
  saveError: string | null;
  isSaving: boolean;
  onChange: (patch: Partial<FoundationDraft>) => void;
  onContinue: () => void;
  onBack: () => void;
}

export const PersonalDetailsStep: React.FC<PersonalDetailsStepProps> = ({
  draft,
  email,
  errors,
  saveError,
  isSaving,
  onChange,
  onContinue,
  onBack,
}) => {
  return (
    <StepFrame
      id="onboarding-personal"
      kicker="02 — Personal details"
      title="A few personal details."
      copy="Some of this information helps us manage your account and stays private."
      onContinue={onContinue}
      onBack={onBack}
      isSaving={isSaving}
      saveError={saveError}
    >
      <div className="rounded-2xl border border-[#D5E6E5] bg-[#F7FBFA] p-5 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3E7574]">
          Private account information
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[#5C7372]">
          These details stay with your account. They are not part of your public portfolio.
        </p>
        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-semibold text-[#243838]">Date of birth</span>
          <input
            id="date-of-birth-input"
            type="date"
            value={draft.dateOfBirth}
            onChange={(event) => onChange({ dateOfBirth: event.target.value })}
            className={fieldClass}
          />
          <FieldError message={errors.dateOfBirth} />
        </label>
        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-semibold text-[#243838]">Email</span>
          <input
            id="account-email-input"
            value={email || "No email is available from Google"}
            readOnly
            className={`${fieldClass} bg-[#F3FAF9] text-[#5C7372]`}
          />
        </label>
        <div className="mt-6 border-t border-[#D5E6E5] pt-6">
          <AccountContactFields
            idPrefix="onboarding"
            whatsappNumber={draft.whatsappNumber}
            whatsappError={errors.whatsappNumber}
            emailUpdatesOptIn={draft.emailUpdatesOptIn}
            onWhatsappChange={(whatsappNumber) => onChange({ whatsappNumber })}
            onEmailUpdatesChange={(emailUpdatesOptIn) => onChange({ emailUpdatesOptIn })}
          />
        </div>
      </div>
    </StepFrame>
  );
};
