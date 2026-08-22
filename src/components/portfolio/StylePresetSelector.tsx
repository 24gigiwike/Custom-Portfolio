import React from "react";
import { Check } from "lucide-react";
import type { PortfolioStylePreset } from "../../types/portfolio";

interface StylePresetSelectorProps {
  selected: PortfolioStylePreset;
  onSelect: (preset: PortfolioStylePreset) => void;
}

interface PresetOption {
  id: PortfolioStylePreset;
  name: string;
  tagline: string;
  description: string;
  previewClass: string;
}

const PRESET_OPTIONS: PresetOption[] = [
  {
    id: "MINIMAL",
    name: "Minimal",
    tagline: "Default archetype",
    description: "Clean, focused and typography-led. Generous whitespace with sharp hierarchy.",
    previewClass: "border-[#1A1A1B]/20 bg-white",
  },
  {
    id: "CREATIVE",
    name: "Creative",
    tagline: "Visual prominence",
    description: "Expressive, visual and image-led. Crafted for visual creators and studios.",
    previewClass: "border-[#6DAEAD]/30 bg-[#F0F7F6]",
  },
  {
    id: "EDITORIAL",
    name: "Editorial",
    tagline: "Storytelling layout",
    description: "Structured around narrative, deep reading rhythms, and refined serif pairings.",
    previewClass: "border-[#708595]/30 bg-[#F5F7F8]",
  },
  {
    id: "BOLD",
    name: "Bold",
    tagline: "High contrast",
    description: "Confident, expressive and personality-driven with strong visual statements.",
    previewClass: "border-[#1A1A1B]/40 bg-[#EDEFEF]",
  },
];

export const StylePresetSelector: React.FC<StylePresetSelectorProps> = ({
  selected,
  onSelect,
}) => {
  return (
    <div id="style-preset-selector" className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      {PRESET_OPTIONS.map((preset) => {
        const isSelected = selected === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            id={`preset-option-${preset.id.toLowerCase()}`}
            onClick={() => onSelect(preset.id)}
            className={`w-full p-4 text-left border rounded-[2px] transition-all duration-200 select-none flex flex-col justify-between ${
              isSelected
                ? "bg-white border-[#6DAEAD] ring-1 ring-[#6DAEAD] shadow-[0_2px_12px_rgba(109,174,173,0.14)]"
                : "bg-white/80 border-[#E5E5E1] hover:border-[#708595]/50 hover:bg-white"
            }`}
          >
            <div>
              {/* Preview Indicator */}
              <div
                className={`w-full h-10 rounded-[2px] border mb-3 flex items-center justify-between px-3 ${preset.previewClass}`}
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#708595]" />
                  <div className="w-12 h-1.5 bg-[#E5E5E1] rounded-full" />
                </div>
                <div className="w-6 h-1.5 bg-[#6DAEAD]/50 rounded-full" />
              </div>

              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-medium text-[#1A1A1B] uppercase tracking-[0.06em]">
                  {preset.name}
                </div>
                {preset.id === "MINIMAL" && (
                  <span className="font-support text-[10px] uppercase tracking-[0.1em] text-[#708595] bg-[#F0F2F2] px-1.5 py-0.5 rounded-[2px]">
                    Default
                  </span>
                )}
              </div>

              <p className="text-xs text-[#708595] font-normal leading-relaxed mb-3">
                {preset.description}
              </p>
            </div>

            <div className="flex items-center justify-between pt-2.5 border-t border-[#E5E5E1]/60">
              <span className="font-support text-[10px] uppercase tracking-[0.12em] text-[#849693]">
                {preset.tagline}
              </span>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors duration-150 ${
                  isSelected
                    ? "bg-[#6DAEAD] border-[#6DAEAD] text-white"
                    : "border-[#E5E5E1] bg-white text-transparent"
                }`}
              >
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
