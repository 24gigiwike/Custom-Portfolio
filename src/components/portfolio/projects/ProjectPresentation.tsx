import React from "react";
import { Star } from "lucide-react";

interface ProjectPresentationProps {
  featured: boolean;
  onFeaturedChange: (value: boolean) => void;
}

export const ProjectPresentation: React.FC<ProjectPresentationProps> = ({
  featured,
  onFeaturedChange,
}) => {
  return (
    <section
      id="project-presentation-section"
      className="bg-white border border-[#E5E5E1] rounded-[2px] p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
    >
      <div className="flex items-baseline justify-between pb-4 mb-6 border-b border-[#E5E5E1]/70">
        <div>
          <span className="font-support text-[11px] uppercase tracking-[0.15em] text-[#708595] block mb-1">
            06 / Presentation
          </span>
          <h2 className="text-lg font-medium text-[#1A1A1B] tracking-[-0.02em]">
            Hierarchy & Prominence
          </h2>
        </div>
        <span className="font-support text-[10px] uppercase tracking-[0.12em] text-[#849693]">
          Featured Showcase
        </span>
      </div>

      <div
        onClick={() => onFeaturedChange(!featured)}
        className={`p-5 rounded-[2px] border cursor-pointer transition-all flex items-start gap-4 ${
          featured
            ? "border-[#6DAEAD] bg-[#6DAEAD]/5"
            : "border-[#E5E5E1] bg-[#F8F8F7] hover:border-[#849693]"
        }`}
      >
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
            featured
              ? "bg-[#6DAEAD] text-white"
              : "bg-white border border-[#E5E5E1] text-[#849693]"
          }`}
        >
          <Star className={`w-4 h-4 ${featured ? "fill-current" : ""}`} />
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#1A1A1B]">
              Primary Featured Project
            </h3>
            <span
              className={`font-support text-[11px] px-2 py-0.5 rounded-[2px] font-medium ${
                featured
                  ? "bg-[#6DAEAD] text-white"
                  : "bg-[#E5E5E1] text-[#708595]"
              }`}
            >
              {featured ? "Featured Active" : "Standard Project"}
            </span>
          </div>

          <p className="text-xs text-[#708595] font-light mt-1.5 leading-relaxed">
            Position this project prominently as the lead case study in your portfolio overview. Only one project can serve as the primary featured work at a time.
          </p>
        </div>
      </div>
    </section>
  );
};
