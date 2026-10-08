import React, { useRef, useState } from "react";
import { AccountContactFields } from "../account/AccountContactFields";
import { Button } from "../ui/Button";
import { configuredSupportWhatsapp, normalizeWhatsappNumber } from "../../lib/accountContact";
import { userFacingWriteError } from "../../lib/accountLoad";
import { useAuth } from "../../lib/authContext";
import { saveAccountContactPreferences } from "../../lib/userAccount";

export function ContactSupportLink() {
  const href = configuredSupportWhatsapp(import.meta.env);
  if (!href) return null;
  return (
    <a
      id="contact-support"
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-1 text-sm font-bold text-[#3E7574] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6DAEAD] focus-visible:ring-offset-2"
    >
      Contact Support
    </a>
  );
}

export function AccountContactPreferences() {
  const { user, userAccount, refreshAccount } = useAuth();
  const stored = userAccount?.contact?.whatsappNumber ?? "";
  const storedOptIn = userAccount?.marketing?.emailUpdatesOptIn ?? false;
  const [whatsappNumber, setWhatsappNumber] = useState(stored);
  const [emailUpdatesOptIn, setEmailUpdatesOptIn] = useState(storedOptIn);
  const [consentAt, setConsentAt] = useState(userAccount?.marketing?.emailUpdatesConsentAt ?? null);
  const [consentVersion, setConsentVersion] = useState(userAccount?.marketing?.emailUpdatesConsentVersion ?? null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const save = () => {
    if (savingRef.current || !user) return;
    const phone = normalizeWhatsappNumber(whatsappNumber);
    if (phone.ok === false) {
      setSaved(false);
      setSaveError(null);
      setFieldError(phone.error);
      return;
    }
    savingRef.current = true;
    setIsSaving(true);
    setFieldError(null);
    setSaveError(null);
    setSaved(false);
    void saveAccountContactPreferences(user.uid, {
      whatsappNumber,
      emailUpdatesOptIn,
      emailUpdatesConsentAt: consentAt,
      emailUpdatesConsentVersion: consentVersion,
    })
      .then(async (updated) => {
        setWhatsappNumber(updated.contact?.whatsappNumber ?? "");
        setEmailUpdatesOptIn(updated.marketing?.emailUpdatesOptIn ?? false);
        setConsentAt(updated.marketing?.emailUpdatesConsentAt ?? null);
        setConsentVersion(updated.marketing?.emailUpdatesConsentVersion ?? null);
        setSaved(true);
        try {
          await refreshAccount();
        } catch {
          // The write already succeeded. The form shows the saved values.
        }
      })
      .catch((error: unknown) => {
        setSaved(false);
        setSaveError(userFacingWriteError(error, "Your contact preferences could not be saved. Try again."));
      })
      .finally(() => {
        savingRef.current = false;
        setIsSaving(false);
      });
  };

  return (
    <section className="mt-14 max-w-xl border-t border-[#D5E6E5] pt-8" aria-labelledby="account-contact-heading">
      <h2 id="account-contact-heading" className="text-lg font-bold tracking-[-0.03em]">
        Account contact
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[#5C7372]">
        These details stay on your private account. They are not part of your portfolio.
      </p>
      <form
        className="mt-6"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <AccountContactFields
          idPrefix="account"
          whatsappNumber={whatsappNumber}
          whatsappError={fieldError ?? undefined}
          emailUpdatesOptIn={emailUpdatesOptIn}
          onWhatsappChange={(value) => {
            setWhatsappNumber(value);
            setSaved(false);
            setFieldError(null);
            setSaveError(null);
          }}
          onEmailUpdatesChange={(optIn) => {
            setEmailUpdatesOptIn(optIn);
            setSaved(false);
            setFieldError(null);
            setSaveError(null);
          }}
        />
        {saveError && (
          <p className="mt-4 text-sm font-medium text-[#B93838]" role="alert">{saveError}</p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button id="account-contact-save" type="submit" isLoading={isSaving}>
            Save
          </Button>
          {saved && (
            <p className="text-sm font-semibold text-[#3E7574]" aria-live="polite">
              Saved
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
