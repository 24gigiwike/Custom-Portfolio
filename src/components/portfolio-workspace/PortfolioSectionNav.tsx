import React from "react";
import { PORTFOLIO_DESIGN_PATH } from "../portfolio-design/portfolioDesignPath";
import { PORTFOLIO_EDITOR_PATH } from "../portfolio-editor/portfolioEditorPath";
import { PORTFOLIO_PUBLISH_PATH } from "../portfolio-publish/portfolioPublishPath";
import { PORTFOLIO_REVIEW_PATH } from "../portfolio-review/portfolioReviewPath";
import { PORTFOLIO_SEO_PATH } from "../portfolio-seo/portfolioSeoPath";
import { PORTFOLIO_WORKSPACE_PATH } from "./portfolioWorkspacePath";

export type PortfolioSection = "overview" | "edit" | "design" | "review" | "seo" | "publish";

const SECTIONS: { id: PortfolioSection; label: string; path: string }[] = [
  { id: "overview", label: "Overview", path: PORTFOLIO_WORKSPACE_PATH },
  { id: "edit", label: "Edit", path: PORTFOLIO_EDITOR_PATH },
  { id: "design", label: "Design", path: PORTFOLIO_DESIGN_PATH },
  { id: "review", label: "Review", path: PORTFOLIO_REVIEW_PATH },
  { id: "seo", label: "SEO", path: PORTFOLIO_SEO_PATH },
  { id: "publish", label: "Publish", path: PORTFOLIO_PUBLISH_PATH },
];

const linkClass =
  "inline-flex min-h-11 items-center rounded-lg px-1 font-bold text-[#3E7574] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6DAEAD] focus-visible:ring-offset-2";

type PortfolioSectionNavProps = {
  current: PortfolioSection;
  onOpenPath: (path: string) => void;
  beforeLeave?: () => boolean;
};

export function PortfolioSectionNav({ current, onOpenPath, beforeLeave }: PortfolioSectionNavProps) {
  return (
    <nav aria-label="Portfolio" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {SECTIONS.map((section) =>
        section.id === current ? (
          <span
            key={section.id}
            className="inline-flex min-h-11 items-center font-bold text-[#243838] underline decoration-[#6DAEAD] decoration-2 underline-offset-8"
            aria-current="page"
          >
            {section.label}
          </span>
        ) : (
          <button
            key={section.id}
            type="button"
            className={linkClass}
            onClick={() => {
              if (beforeLeave && !beforeLeave()) return;
              onOpenPath(section.path);
            }}
          >
            {section.label}
          </button>
        ),
      )}
    </nav>
  );
}

export function SignOutControl({ onSignOut }: { onSignOut: () => void }) {
  return (
    <button
      type="button"
      onClick={onSignOut}
      className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-1 text-sm font-bold text-[#3E7574] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6DAEAD] focus-visible:ring-offset-2"
    >
      Sign out
    </button>
  );
}
