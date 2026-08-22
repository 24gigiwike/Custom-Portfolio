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
    dotColor: "bg-[#849693]",
  },
];

export const AvailabilitySection: React.FC<AvailabilitySectionProps> = ({
  availability,
  onChange,
}) => {
  return (
    <section
      id="availability-section"
      className="bg-white border border-[#E5E5E1] rounded-[2px] p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
    >
      <div className="flex items-baseline justify-between pb-4 mb-6 border-b border-[#E5E5E1]/70">
        <div>
          <span className="font-support text-[11px] uppercase tracking-[0.15em] text-[#708595] block mb-1">
            05 / Availability
          </span>
          <h2 className="text-lg font-medium text-[#1A1A1B] tracking-[-0.02em]">
            Engagement Status
          </h2>
        </div>
        <span className="font-support text-[10px] uppercase tracking-[0.12em] text-[#849693]">
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
              className={`p-4 text-left border rounded-[2px] transition-all duration-200 flex flex-col justify-between ${
                isSelected
                  ? "bg-[#F0F7F6]/40 border-[#6DAEAD] ring-1 ring-[#6DAEAD] shadow-[0_1px_3px_rgba(109,174,173,0.12)]"
                  : "bg-white border-[#E5E5E1] hover:border-[#849693] hover:bg-[#FDFDFD]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${option.dotColor}`} />
                    <span className="text-sm font-medium text-[#1A1A1B]">
                      {option.title}
                    </span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[#6DAEAD]" />}
                </div>
                <p className="text-xs text-[#708595] font-light leading-relaxed">
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
