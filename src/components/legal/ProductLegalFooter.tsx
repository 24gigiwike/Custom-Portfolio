import { brand } from "../../config/branding";
import { PRIVACY_POLICY_PATH, REFUND_POLICY_PATH, TERMS_PATH } from "../../lib/legalPaths";

const LINKS = [
  { href: PRIVACY_POLICY_PATH, label: "Privacy Policy" },
  { href: TERMS_PATH, label: "Terms & Conditions" },
  { href: REFUND_POLICY_PATH, label: "Refund Policy" },
] as const;

export function ProductLegalFooter({
  onOpenPath,
  className = "",
}: {
  onOpenPath: (path: string) => void;
  className?: string;
}) {
  return (
    <footer className={`mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 ${className}`}>
      <div className="flex flex-col items-center justify-between gap-3 border-t border-[#D5E6E5] pt-5 text-[11px] leading-relaxed text-[#6E8887] sm:flex-row">
        <p>{brand.name} {brand.endorsement}</p>
        <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {LINKS.map((link) => (
            <button
              key={link.href}
              type="button"
              onClick={() => onOpenPath(link.href)}
              className="underline decoration-[#D5E6E5] underline-offset-2 hover:text-[#3E7574]"
            >
              {link.label}
            </button>
          ))}
        </nav>
      </div>
    </footer>
  );
}
