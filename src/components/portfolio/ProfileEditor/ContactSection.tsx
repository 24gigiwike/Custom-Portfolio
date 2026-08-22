import React from "react";
import { Mail, Info } from "lucide-react";

interface ContactSectionProps {
  email: string;
  authEmail?: string | null;
  error?: string;
  onEmailChange: (value: string) => void;
}

export const ContactSection: React.FC<ContactSectionProps> = ({
  email,
  authEmail,
  error,
  onEmailChange,
}) => {
  return (
    <section
      id="contact-section"
      className="bg-white border border-[#E5E5E1] rounded-[2px] p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
    >
      <div className="flex items-baseline justify-between pb-4 mb-6 border-b border-[#E5E5E1]/70">
        <div>
          <span className="font-support text-[11px] uppercase tracking-[0.15em] text-[#708595] block mb-1">
            03 / Direct Contact
          </span>
          <h2 className="text-lg font-medium text-[#1A1A1B] tracking-[-0.02em]">
            Public Portfolio Email
          </h2>
        </div>
        <span className="font-support text-[10px] uppercase tracking-[0.12em] text-[#849693]">
          Inquiries
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="contact-email-input"
            className="font-support text-[11px] uppercase tracking-[0.14em] text-[#708595] block mb-2"
          >
            Contact Email Address <span className="text-[#B91C1C]">*</span>
          </label>

          <div className="relative flex items-center max-w-lg">
            <Mail className="w-4 h-4 text-[#849693] absolute left-3 pointer-events-none" />
            <input
              type="email"
              id="contact-email-input"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="contact@yourdomain.com"
              className={`w-full text-sm pl-9 pr-3.5 py-2.5 bg-[#F8F8F7] border rounded-[2px] text-[#1A1A1B] placeholder:text-[#849693]/60 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors ${
                error ? "border-[#B91C1C]" : "border-[#E5E5E1]"
              }`}
            />
          </div>

          {error ? (
            <p className="text-xs text-[#B91C1C] mt-1.5 font-light">{error}</p>
          ) : (
            <div className="flex items-start gap-2 mt-2 text-xs text-[#708595] font-light">
              <Info className="w-3.5 h-3.5 text-[#849693] flex-shrink-0 mt-0.5" />
              <span>
                This is your public-facing portfolio contact address. Changing this does not affect your login account ({authEmail || "Firebase account"}).
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
