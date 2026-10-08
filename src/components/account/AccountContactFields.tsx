import React from "react";
import {
  EMAIL_UPDATES_CONSENT_WORDING,
  WHATSAPP_HELPER_TEXT,
  WHATSAPP_RECOMMENDED_LABEL,
} from "../../lib/accountContact";
import { FieldError, fieldClass } from "../onboarding/StepFrame";

type AccountContactFieldsProps = {
  idPrefix: string;
  whatsappNumber: string;
  whatsappError?: string;
  emailUpdatesOptIn: boolean;
  onWhatsappChange: (value: string) => void;
  onEmailUpdatesChange: (optIn: boolean) => void;
};

export function AccountContactFields({
  idPrefix,
  whatsappNumber,
  whatsappError,
  emailUpdatesOptIn,
  onWhatsappChange,
  onEmailUpdatesChange,
}: AccountContactFieldsProps) {
  const whatsappId = `${idPrefix}-whatsapp`;
  const helpId = `${whatsappId}-help`;
  const updatesId = `${idPrefix}-email-updates`;

  return (
    <div>
      <label className="block" htmlFor={whatsappId}>
        <span className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-[#243838]">WhatsApp number</span>
          <span className="text-xs font-semibold text-[#3E7574]">{WHATSAPP_RECOMMENDED_LABEL}</span>
        </span>
        <input
          id={whatsappId}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+"
          value={whatsappNumber}
          aria-describedby={helpId}
          aria-invalid={whatsappError ? true : undefined}
          onChange={(event) => onWhatsappChange(event.target.value)}
          className={fieldClass}
        />
      </label>
      <p id={helpId} className="mt-2 text-sm leading-relaxed text-[#5C7372]">
        {WHATSAPP_HELPER_TEXT}
      </p>
      <FieldError message={whatsappError} />
      <label htmlFor={updatesId} className="mt-6 flex items-start gap-3">
        <input
          id={updatesId}
          type="checkbox"
          checked={emailUpdatesOptIn}
          onChange={(event) => onEmailUpdatesChange(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-[#3E7574]"
        />
        <span className="text-sm font-medium leading-relaxed text-[#243838]">{EMAIL_UPDATES_CONSENT_WORDING}</span>
      </label>
    </div>
  );
}
