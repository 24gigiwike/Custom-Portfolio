import React from "react";
import { Sparkles, Hash } from "lucide-react";

interface ProjectOverviewProps {
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  errors: Record<string, string>;
  onTitleChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onShortDescriptionChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}

export const ProjectOverview: React.FC<ProjectOverviewProps> = ({
  title,
  slug,
  shortDescription,
  description,
  errors,
  onTitleChange,
  onSlugChange,
  onShortDescriptionChange,
  onDescriptionChange,
}) => {
  return (
    <section
      id="project-overview-section"
      className="bg-white border border-[#E5E5E1] rounded-[2px] p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
    >
      <div className="flex items-baseline justify-between pb-4 mb-6 border-b border-[#E5E5E1]/70">
        <div>
          <span className="font-support text-[11px] uppercase tracking-[0.15em] text-[#708595] block mb-1">
            01 / Project
          </span>
          <h2 className="text-lg font-medium text-[#1A1A1B] tracking-[-0.02em]">
            Identity & Narrative
          </h2>
        </div>
        <span className="font-support text-[10px] uppercase tracking-[0.12em] text-[#849693]">
          Essential Content
        </span>
      </div>

      <div className="space-y-6">
        {/* Project Title */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label
              htmlFor="project-title-input"
              className="font-support text-[11px] uppercase tracking-[0.14em] text-[#708595] block"
            >
              Project Title <span className="text-[#B91C1C]">*</span>
            </label>
            <span className="text-[11px] font-mono text-[#849693]">
              {title.length}/100
            </span>
          </div>
          <input
            type="text"
            id="project-title-input"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="e.g. Brand identity for a growing technology company"
            maxLength={100}
            className={`w-full text-base sm:text-lg font-medium px-4 py-3 bg-[#F8F8F7] border ${
              errors.title ? "border-[#B91C1C]" : "border-[#E5E5E1]"
            } rounded-[2px] text-[#1A1A1B] placeholder:text-[#849693]/50 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors`}
          />
          {errors.title ? (
            <p className="font-support text-xs text-[#B91C1C] mt-1.5">{errors.title}</p>
          ) : (
            <p className="text-xs text-[#849693] mt-1.5 font-light">
              Clear, descriptive name of the creative or engineering project.
            </p>
          )}
        </div>

        {/* Project Slug */}
        <div>
          <label
            htmlFor="project-slug-input"
            className="font-support text-[11px] uppercase tracking-[0.14em] text-[#708595] block mb-2"
          >
            Project URL Identifier (Slug)
          </label>
          <div className="relative flex items-center">
            <Hash className="w-4 h-4 text-[#849693] absolute left-3 pointer-events-none" />
            <input
              type="text"
              id="project-slug-input"
              value={slug}
              onChange={(e) => onSlugChange(e.target.value)}
              placeholder="brand-identity-technology"
              className="w-full text-xs font-mono pl-9 pr-3.5 py-2.5 bg-[#F8F8F7] border border-[#E5E5E1] rounded-[2px] text-[#1A1A1B] placeholder:text-[#849693]/60 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors"
            />
          </div>
          <p className="text-[11px] text-[#849693] mt-1 font-light">
            Used in direct links and navigational anchors. Generated from title.
          </p>
        </div>

        {/* Short Description */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label
              htmlFor="project-short-description-input"
              className="font-support text-[11px] uppercase tracking-[0.14em] text-[#708595] block"
            >
              Short Description <span className="text-[#B91C1C]">*</span>
            </label>
            <span className="text-[11px] font-mono text-[#849693]">
              {shortDescription.length}/300
            </span>
          </div>
          <textarea
            id="project-short-description-input"
            rows={2}
            value={shortDescription}
            onChange={(e) => onShortDescriptionChange(e.target.value)}
            placeholder="e.g. A visual identity system created to give a technology brand a clearer and more confident presence."
            maxLength={300}
            className={`w-full text-sm px-4 py-3 bg-[#F8F8F7] border ${
              errors.shortDescription ? "border-[#B91C1C]" : "border-[#E5E5E1]"
            } rounded-[2px] text-[#1A1A1B] placeholder:text-[#849693]/50 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors resize-y`}
          />
          {errors.shortDescription ? (
            <p className="font-support text-xs text-[#B91C1C] mt-1.5">{errors.shortDescription}</p>
          ) : (
            <p className="text-xs text-[#849693] mt-1.5 font-light">
              Concise summary that appears on project cards and list previews.
            </p>
          )}
        </div>

        {/* Detailed Description / Narrative */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label
              htmlFor="project-long-description-input"
              className="font-support text-[11px] uppercase tracking-[0.14em] text-[#708595] block"
            >
              Full Description & Narrative (Optional)
            </label>
            <span className="text-[11px] font-mono text-[#849693]">
              {description.length} characters
            </span>
          </div>
          <textarea
            id="project-long-description-input"
            rows={6}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Elaborate on the challenge, thinking, process, design decisions, and ultimate outcome. Multiple paragraphs are preserved with line breaks."
            className="w-full text-sm px-4 py-3 bg-[#F8F8F7] border border-[#E5E5E1] rounded-[2px] text-[#1A1A1B] placeholder:text-[#849693]/50 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors resize-y leading-relaxed font-normal whitespace-pre-wrap"
          />
          <p className="text-xs text-[#849693] mt-1.5 font-light">
            Paragraph structure and whitespace are preserved as structured editorial text.
          </p>
        </div>
      </div>
    </section>
  );
};
