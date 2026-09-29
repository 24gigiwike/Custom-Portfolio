import React from "react";
import { Check } from "lucide-react";
import type { PortfolioAvailability } from "../../../types/portfolio";

interface AvailabilitySectionProps {
  availability: PortfolioAvailability;
  onChange: (value: PortfolioAvailability) => void;
}

const AVAILABILITY_OPTIONS: {
  value: PortfolioAvailability;
  title: string;
  desc: string;
  dotColor: string;
}[] = [
  {
    value: "Available for work",
    title: "Available for work",
    desc: "Actively taking on new client projects, contracts, or opportunities.",
    dotColor: "bg-[#388E6D]",
  },
  {
    value: "Open to opportunities",
    title: "Open to opportunities",
    desc: "Selective availability for compelling roles or select advisory work.",
    dotColor: "bg-[#6DAEAD]",
  },
  {
    value: "Currently unavailable",
    title: "Currently unavailable",
    desc: "Focusing on current commitments; not accepting new engagements.",
    dotColor: "bg-[#6E8887]",
  },
];

export const AvailabilitySection: React.FC<AvailabilitySectionProps> = ({
  availability,
  onChange,
}) => {
  return (
    <section
      id="availability-section"
      className="bg-white border border-[#D5E6E5] rounded-2xl p-6 sm:p-8 shadow-[0_12px_32px_rgba(109,174,173,0.08)]"
    >
      <div className="flex items-baseline justify-between pb-4 mb-6 border-b border-[#D5E6E5]/70">
        <div>
          <span className="font-support text-[11px] uppercase tracking-[0.15em] text-[#5C7372] block mb-1">
            05 / Availability
          </span>
          <h2 className="text-lg font-medium text-[#243838] tracking-[-0.02em]">
            Engagement Status
          </h2>
        </div>
        <span className="font-support text-[10px] uppercase tracking-[0.12em] text-[#6E8887]">
          Live Signal
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {AVAILABILITY_OPTIONS.map((option) => {
          const isSelected = availability === option.value;
          return (
            <button
              key={option.value}
              type="button"
              id={`availability-option-${option.value.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => onChange(option.value)}
              className={`p-4 text-left border rounded-2xl transition-all duration-200 flex flex-col justify-between ${
                isSelected
                  ? "bg-[#E7F4F3]/40 border-[#6DAEAD] ring-1 ring-[#6DAEAD] shadow-[0_1px_3px_rgba(109,174,173,0.12)]"
                  : "bg-white border-[#D5E6E5] hover:border-[#6E8887] hover:bg-[#FDFDFD]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${option.dotColor}`} />
                    <span className="text-sm font-medium text-[#243838]">
                      {option.title}
                    </span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[#6DAEAD]" />}
                </div>
                <p className="text-xs text-[#5C7372] font-light leading-relaxed">
                  {option.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
