import React from "react";

interface ChoiceGridProps {
  options: readonly string[];
  selected: string[];
  onToggle: (option: string) => void;
  idPrefix: string;
}

export const ChoiceGrid: React.FC<ChoiceGridProps> = ({ options, selected, onToggle, idPrefix }) => {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            id={`${idPrefix}-${option.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            aria-pressed={active}
            onClick={() => onToggle(option)}
            className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
              active
                ? "border-[#6DAEAD] bg-[#F3FAF9] text-[#243838]"
                : "border-[#D5E6E5] bg-white text-[#3E5453] hover:border-[#8FC4C3]"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
};
