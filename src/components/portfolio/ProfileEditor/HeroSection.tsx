import React from "react";

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
      className="bg-white border border-[#D5E6E5] rounded-2xl p-6 sm:p-8 shadow-[0_12px_32px_rgba(109,174,173,0.08)]"
    >
      <div className="flex items-baseline justify-between pb-4 mb-6 border-b border-[#D5E6E5]/70">
        <div>
          <span className="font-support text-[11px] uppercase tracking-[0.15em] text-[#5C7372] block mb-1">
            02 / Hero & Narrative
          </span>
          <h2 className="text-lg font-medium text-[#243838] tracking-[-0.02em]">
            Positioning & Narrative
          </h2>
        </div>
        <span className="font-support text-[10px] uppercase tracking-[0.12em] text-[#6E8887]">
          Primary Statement
        </span>
      </div>

      <div className="space-y-6">
        {/* Headline */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label
              htmlFor="hero-headline-input"
              className="font-support text-[11px] uppercase tracking-[0.14em] text-[#5C7372] block"
            >
              Hero Headline <span className="text-[#B93838]">*</span>
            </label>
            <span className="text-[11px] font-mono text-[#6E8887]">
              {headline.length}/140
            </span>
          </div>

          <input
            type="text"
            id="hero-headline-input"
            value={headline}
            onChange={(e) => onHeadlineChange(e.target.value)}
            placeholder="I design digital experiences that help brands move forward."
            className={`w-full text-base sm:text-lg px-3.5 py-3 bg-[#F7FBFA] border rounded-2xl text-[#243838] placeholder:text-[#6E8887]/60 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors ${
              errors.headline ? "border-[#B93838]" : "border-[#D5E6E5]"
            }`}
            maxLength={140}
          />

          {errors.headline ? (
            <p className="text-xs text-[#B93838] mt-1 font-light">{errors.headline}</p>
          ) : (
            <p className="text-xs text-[#6E8887] mt-1.5 font-light leading-relaxed">
              The prominent statement displayed on your portfolio landing hero. Keep it focused and impactful.
            </p>
          )}
        </div>

        {/* Short Introduction / Bio */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label
              htmlFor="hero-bio-input"
              className="font-support text-[11px] uppercase tracking-[0.14em] text-[#5C7372] block"
            >
              Short Introduction <span className="text-[#B93838]">*</span>
            </label>
            <span className="text-[11px] font-mono text-[#6E8887]">
              {bio.length}/500
            </span>
          </div>

          <textarea
            id="hero-bio-input"
            rows={4}
            value={bio}
            onChange={(e) => onBioChange(e.target.value)}
            placeholder="I create thoughtful digital experiences across web, product and brand."
            className={`w-full text-sm sm:text-base px-3.5 py-3 bg-[#F7FBFA] border rounded-2xl text-[#243838] placeholder:text-[#6E8887]/60 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors resize-y leading-relaxed ${
              errors.bio ? "border-[#B93838]" : "border-[#D5E6E5]"
            }`}
            maxLength={500}
          />

          {errors.bio ? (
            <p className="text-xs text-[#B93838] mt-1 font-light">{errors.bio}</p>
          ) : (
            <p className="text-xs text-[#6E8887] mt-1.5 font-light leading-relaxed">
              A 2–4 sentence overview of your background, philosophy, and craft.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};
