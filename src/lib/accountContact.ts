import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import type { AccountContact, AccountMarketing, FoundationDraft } from "../types";

export const EMAIL_UPDATES_CONSENT_VERSION = "email-updates-v1";

export const EMAIL_UPDATES_CONSENT_WORDING =
  "Email me occasional updates about new templates, improvements, and Custom Portfolio news.";

export const WHATSAPP_HELPER_TEXT =
  "Recommended for direct account support from BroadBrand. Your number stays private and won't appear on your portfolio.";

export const WHATSAPP_RECOMMENDED_LABEL = "Recommended — optional";

export const SUPPORT_MESSAGE = "Hello BroadBrand, I need help with my Custom Portfolio account.";

const COUNTRY_CODE_MESSAGE = "Enter the number with its country code, starting with +.";
const INVALID_NUMBER_MESSAGE = "Enter a valid WhatsApp number with its country code.";

export type WhatsappParse =
  | { ok: true; e164: string }
  | { ok: false; error: string };

export function normalizeWhatsappNumber(input: string): WhatsappParse {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, e164: "" };
  if (!trimmed.startsWith("+")) return { ok: false, error: COUNTRY_CODE_MESSAGE };
  const parsed = parsePhoneNumberFromString(trimmed);
  if (!parsed || !parsed.isValid()) return { ok: false, error: INVALID_NUMBER_MESSAGE };
  return { ok: true, e164: parsed.number };
}

export function declinedMarketing(): AccountMarketing {
  return {
    emailUpdatesOptIn: false,
    emailUpdatesConsentAt: null,
    emailUpdatesConsentVersion: null,
  };
}

export function readAccountContact(data: { contact?: unknown; marketing?: unknown } | null | undefined): {
  contact: AccountContact;
  marketing: AccountMarketing;
} {
  const contactRecord = isRecord(data?.contact) ? data.contact : undefined;
  const storedNumber = contactRecord && typeof contactRecord.whatsappNumber === "string" ? contactRecord.whatsappNumber : "";
  const marketingRecord = isRecord(data?.marketing) ? data.marketing : undefined;
  const optIn = marketingRecord?.emailUpdatesOptIn === true;
  const consentAt =
    marketingRecord && typeof marketingRecord.emailUpdatesConsentAt === "string" && marketingRecord.emailUpdatesConsentAt
      ? marketingRecord.emailUpdatesConsentAt
      : null;
  const consentVersion =
    marketingRecord && typeof marketingRecord.emailUpdatesConsentVersion === "string" && marketingRecord.emailUpdatesConsentVersion
      ? marketingRecord.emailUpdatesConsentVersion
      : null;
  const marketing =
    optIn && consentAt && consentVersion
      ? {
          emailUpdatesOptIn: true,
          emailUpdatesConsentAt: consentAt,
          emailUpdatesConsentVersion: consentVersion,
        }
      : declinedMarketing();
  return { contact: { whatsappNumber: storedNumber }, marketing };
}

/**
 * Keep an existing consent timestamp when the same choice and wording remain.
 * Withdrawal clears the opt-in flag, timestamp, and version together.
 */
export function resolveMarketingConsent(
  existing: AccountMarketing,
  optIn: boolean,
  nowIso: string,
): AccountMarketing {
  if (!optIn) return declinedMarketing();
  if (
    existing.emailUpdatesOptIn &&
    existing.emailUpdatesConsentAt &&
    existing.emailUpdatesConsentVersion === EMAIL_UPDATES_CONSENT_VERSION
  ) {
    return {
      emailUpdatesOptIn: true,
      emailUpdatesConsentAt: existing.emailUpdatesConsentAt,
      emailUpdatesConsentVersion: EMAIL_UPDATES_CONSENT_VERSION,
    };
  }
  return {
    emailUpdatesOptIn: true,
    emailUpdatesConsentAt: nowIso,
    emailUpdatesConsentVersion: EMAIL_UPDATES_CONSENT_VERSION,
  };
}

export function accountContactPayload(
  draft: Pick<
    FoundationDraft,
    "whatsappNumber" | "emailUpdatesOptIn" | "emailUpdatesConsentAt" | "emailUpdatesConsentVersion"
  >,
  nowIso: string,
): { contact: AccountContact; marketing: AccountMarketing } {
  const phone = normalizeWhatsappNumber(draft.whatsappNumber);
  if (phone.ok === false) throw new Error(phone.error);
  return {
    contact: { whatsappNumber: phone.e164 },
    marketing: resolveMarketingConsent(
      {
        emailUpdatesOptIn: Boolean(
          draft.emailUpdatesOptIn && draft.emailUpdatesConsentAt && draft.emailUpdatesConsentVersion,
        ),
        emailUpdatesConsentAt: draft.emailUpdatesConsentAt,
        emailUpdatesConsentVersion: draft.emailUpdatesConsentVersion,
      },
      draft.emailUpdatesOptIn,
      nowIso,
    ),
  };
}

/**
 * The support variable may be E.164 (`+234…`) or digits with a country code (`234…`).
 * A leading + is added only so the number can be checked. It is not stored as a customer number.
 */
function supportNumberInput(configuredNumber: string): string {
  const compact = configuredNumber.trim().replace(/[\s().-]/g, "");
  if (compact.startsWith("+") || !/^\d+$/.test(compact)) return compact;
  return `+${compact}`;
}

/** Opens WhatsApp with a prefilled message. Returns null when the support number is missing or invalid. */
export function supportWhatsappLink(configuredNumber: string | null | undefined, message = SUPPORT_MESSAGE): string | null {
  if (!configuredNumber || !configuredNumber.trim()) return null;
  const phone = normalizeWhatsappNumber(supportNumberInput(configuredNumber));
  if (phone.ok === false || phone.e164 === "") return null;
  const url = new URL(`https://wa.me/${phone.e164.slice(1)}`);
  url.searchParams.set("text", message);
  return url.toString();
}

export function configuredSupportWhatsapp(env: { VITE_BROADBRAND_SUPPORT_WHATSAPP?: string } | undefined): string | null {
  return supportWhatsappLink(env?.VITE_BROADBRAND_SUPPORT_WHATSAPP);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
