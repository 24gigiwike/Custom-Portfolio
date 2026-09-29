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
      className="bg-white border border-[#D5E6E5] rounded-2xl p-6 sm:p-8 shadow-[0_12px_32px_rgba(109,174,173,0.08)]"
    >
      <div className="flex items-baseline justify-between pb-4 mb-6 border-b border-[#D5E6E5]/70">
        <div>
          <span className="font-support text-[11px] uppercase tracking-[0.15em] text-[#5C7372] block mb-1">
            03 / Direct Contact
          </span>
          <h2 className="text-lg font-medium text-[#243838] tracking-[-0.02em]">
            Public Portfolio Email
          </h2>
        </div>
        <span className="font-support text-[10px] uppercase tracking-[0.12em] text-[#6E8887]">
          Inquiries
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="contact-email-input"
            className="font-support text-[11px] uppercase tracking-[0.14em] text-[#5C7372] block mb-2"
          >
            Contact Email Address <span className="text-[#B93838]">*</span>
          </label>

          <div className="relative flex items-center max-w-lg">
            <Mail className="w-4 h-4 text-[#6E8887] absolute left-3 pointer-events-none" />
            <input
              type="email"
              id="contact-email-input"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="contact@yourdomain.com"
              className={`w-full text-sm pl-9 pr-3.5 py-2.5 bg-[#F7FBFA] border rounded-2xl text-[#243838] placeholder:text-[#6E8887]/60 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors ${
                error ? "border-[#B93838]" : "border-[#D5E6E5]"
              }`}
            />
          </div>

          {error ? (
            <p className="text-xs text-[#B93838] mt-1.5 font-light">{error}</p>
          ) : (
            <div className="flex items-start gap-2 mt-2 text-xs text-[#5C7372] font-light">
              <Info className="w-3.5 h-3.5 text-[#6E8887] flex-shrink-0 mt-0.5" />
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
