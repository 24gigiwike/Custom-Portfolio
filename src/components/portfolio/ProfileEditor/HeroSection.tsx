import React from "react";
import { Sparkles, FileText } from "lucide-react";

interface HeroSectionProps {
  headline: string;
  bio: string;
  errors?: {
    headline?: string;
    bio?: string;
  };
  onHeadlineChange: (value: string) => void;
  onBioChange: (value: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  headline,
  bio,
  errors,
  onHeadlineChange,
  onBioChange,
}) => {
  return (
    <section
      id="hero-section"
      className="bg-white border border-[#E5E5E1] rounded-[2px] p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
    >
      <div className="flex items-baseline justify-between pb-4 mb-6 border-b border-[#E5E5E1]/70">
        <div>
          <span className="font-support text-[11px] uppercase tracking-[0.15em] text-[#708595] block mb-1">
            02 / Hero & Narrative
          </span>
          <h2 className="text-lg font-medium text-[#1A1A1B] tracking-[-0.02em]">
            Positioning & Narrative
          </h2>
        </div>
        <span className="font-support text-[10px] uppercase tracking-[0.12em] text-[#849693]">
          Primary Statement
        </span>
      </div>

      <div className="space-y-6">
        {/* Headline */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label
              htmlFor="hero-headline-input"
              className="font-support text-[11px] uppercase tracking-[0.14em] text-[#708595] block"
            >
              Hero Headline <span className="text-[#B91C1C]">*</span>
            </label>
            <span className="text-[11px] font-mono text-[#849693]">
              {headline.length}/140
            </span>
          </div>

          <input
            type="text"
            id="hero-headline-input"
            value={headline}
            onChange={(e) => onHeadlineChange(e.target.value)}
            placeholder="I design digital experiences that help brands move forward."
            className={`w-full text-base sm:text-lg px-3.5 py-3 bg-[#F8F8F7] border rounded-[2px] text-[#1A1A1B] placeholder:text-[#849693]/60 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors ${
              errors.headline ? "border-[#B91C1C]" : "border-[#E5E5E1]"
            }`}
            maxLength={140}
          />

          {errors.headline ? (
            <p className="text-xs text-[#B91C1C] mt-1 font-light">{errors.headline}</p>
          ) : (
            <p className="text-xs text-[#849693] mt-1.5 font-light leading-relaxed">
              The prominent statement displayed on your portfolio landing hero. Keep it focused and impactful.
            </p>
          )}
        </div>

        {/* Short Introduction / Bio */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label
              htmlFor="hero-bio-input"
              className="font-support text-[11px] uppercase tracking-[0.14em] text-[#708595] block"
            >
              Short Introduction <span className="text-[#B91C1C]">*</span>
            </label>
            <span className="text-[11px] font-mono text-[#849693]">
              {bio.length}/500
            </span>
          </div>

          <textarea
            id="hero-bio-input"
            rows={4}
            value={bio}
            onChange={(e) => onBioChange(e.target.value)}
            placeholder="I create thoughtful digital experiences across web, product and brand."
            className={`w-full text-sm sm:text-base px-3.5 py-3 bg-[#F8F8F7] border rounded-[2px] text-[#1A1A1B] placeholder:text-[#849693]/60 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors resize-y leading-relaxed ${
              errors.bio ? "border-[#B91C1C]" : "border-[#E5E5E1]"
            }`}
            maxLength={500}
          />

          {errors.bio ? (
            <p className="text-xs text-[#B91C1C] mt-1 font-light">{errors.bio}</p>
          ) : (
            <p className="text-xs text-[#849693] mt-1.5 font-light leading-relaxed">
              A 2–4 sentence overview of your background, philosophy, and craft.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};
