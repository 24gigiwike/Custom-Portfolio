import React from "react";
import { Globe, BookOpen, ExternalLink } from "lucide-react";

interface ProjectLinksProps {
  projectUrl: string;
  caseStudyUrl: string;
  onProjectUrlChange: (value: string) => void;
  onCaseStudyUrlChange: (value: string) => void;
}

export const ProjectLinks: React.FC<ProjectLinksProps> = ({
  projectUrl,
  caseStudyUrl,
  onProjectUrlChange,
  onCaseStudyUrlChange,
}) => {
  return (
    <section
      id="project-links-section"
      className="bg-white border border-[#D5E6E5] rounded-2xl p-6 sm:p-8 shadow-[0_12px_32px_rgba(109,174,173,0.08)]"
    >
      <div className="flex items-baseline justify-between pb-4 mb-6 border-b border-[#D5E6E5]/70">
        <div>
          <span className="font-support text-[11px] uppercase tracking-[0.15em] text-[#5C7372] block mb-1">
            05 / Links
          </span>
          <h2 className="text-lg font-medium text-[#243838] tracking-[-0.02em]">
            External Destinations
          </h2>
        </div>
        <span className="font-support text-[10px] uppercase tracking-[0.12em] text-[#6E8887]">
          Optional Links
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Project URL */}
        <div>
          <label
            htmlFor="project-url-input"
            className="font-support text-[11px] uppercase tracking-[0.14em] text-[#5C7372] block mb-2"
          >
            Live Project / Website URL
          </label>
          <div className="relative flex items-center">
            <Globe className="w-4 h-4 text-[#6E8887] absolute left-3 pointer-events-none" />
            <input
              type="text"
              id="project-url-input"
              value={projectUrl}
              onChange={(e) => onProjectUrlChange(e.target.value)}
              placeholder="https://example.com"
              className="w-full text-xs font-mono pl-9 pr-3.5 py-2.5 bg-[#F7FBFA] border border-[#D5E6E5] rounded-2xl text-[#243838] placeholder:text-[#6E8887]/60 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors"
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] text-[#6E8887] font-light">
              Direct link to the active website or product.
            </p>
            {projectUrl && (
              <a
                href={projectUrl.startsWith("http") ? projectUrl : `https://${projectUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-[#6DAEAD] hover:underline"
              >
                <span>Preview</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Case Study URL */}
        <div>
          <label
            htmlFor="project-casestudy-url-input"
            className="font-support text-[11px] uppercase tracking-[0.14em] text-[#5C7372] block mb-2"
          >
            External Case Study URL
          </label>
          <div className="relative flex items-center">
            <BookOpen className="w-4 h-4 text-[#6E8887] absolute left-3 pointer-events-none" />
            <input
              type="text"
              id="project-casestudy-url-input"
              value={caseStudyUrl}
              onChange={(e) => onCaseStudyUrlChange(e.target.value)}
              placeholder="https://readcv.com/... or https://medium.com/..."
              className="w-full text-xs font-mono pl-9 pr-3.5 py-2.5 bg-[#F7FBFA] border border-[#D5E6E5] rounded-2xl text-[#243838] placeholder:text-[#6E8887]/60 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors"
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] text-[#6E8887] font-light">
              Link to an in-depth writeup or slide deck.
            </p>
            {caseStudyUrl && (
              <a
                href={caseStudyUrl.startsWith("http") ? caseStudyUrl : `https://${caseStudyUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-[#6DAEAD] hover:underline"
              >
                <span>Preview</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
