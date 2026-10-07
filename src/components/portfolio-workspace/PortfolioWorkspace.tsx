import React, { useEffect, useRef, useState } from "react";
import { brand } from "../../config/branding";
import { userFacingWriteError } from "../../lib/accountLoad";
import { useAuth } from "../../lib/authContext";
import { portfolioTemplateInfo, publishingStatusLabel } from "../../lib/portfolioTemplate";
import { contentAreaLabel, templateContentAreas, type ContentArea } from "../../lib/templateCatalog";
import { getPortfolioByOwner, type OwnedPortfolioLookup } from "../../lib/userPortfolio";
import { TEMPLATE_DISCOVERY_PATH } from "../discover/templateDiscoveryPath";
import type { UserPortfolio } from "../../types/userPortfolio";
import { Button } from "../ui/Button";
import { PORTFOLIO_DESIGN_PATH } from "../portfolio-design/portfolioDesignPath";
import { PORTFOLIO_EDITOR_PATH } from "../portfolio-editor/portfolioEditorPath";
import { PORTFOLIO_REVIEW_PATH } from "../portfolio-review/portfolioReviewPath";

type PortfolioWorkspaceProps = {
  onOpenPath: (path: string) => void;
};

export function PortfolioWorkspace({ onOpenPath }: PortfolioWorkspaceProps) {
  const { user, userAccount, signOutUser } = useAuth();
  const [lookup, setLookup] = useState<OwnedPortfolioLookup | null>(null);
  const [portfolio, setPortfolio] = useState<UserPortfolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = () => {
    const current = ++requestId.current;
    setIsLoading(true);
    setLoadError(null);
    void getPortfolioByOwner()
      .then((result) => {
        if (requestId.current !== current) return;
        setLookup(result);
        setPortfolio(result.status === "ready" ? result.portfolio : null);
      })
      .catch((error: unknown) => {
        if (requestId.current !== current) return;
        setLookup(null);
        setPortfolio(null);
        setLoadError(userFacingWriteError(error, "Your portfolio could not be loaded."));
      })
      .finally(() => {
        if (requestId.current === current) setIsLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const template = portfolio ? portfolioTemplateInfo(portfolio.selectedTemplate) : null;
  const contentAreas = portfolio ? templateContentAreas(portfolio.selectedTemplate) : null;
  const openEditor = () => onOpenPath(PORTFOLIO_EDITOR_PATH);
  const openDesign = () => onOpenPath(PORTFOLIO_DESIGN_PATH);
  const openReview = () => onOpenPath(PORTFOLIO_REVIEW_PATH);
  const openCreateFlow = () => onOpenPath(TEMPLATE_DISCOVERY_PATH);

  const accountName = userAccount?.accountPrivate?.firstName || user?.displayName || "";
  const portfolioName = portfolio?.profile.brandName.trim() || "";

  return (
    <div id="portfolio-workspace" className="min-h-screen overflow-x-hidden bg-[#F3FAF9] font-sans text-[#243838]">
      <header className="border-b border-[#D5E6E5] bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-5 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">{brand.name}</p>
              <p className="mt-1 truncate text-sm font-semibold">{portfolioName || "Portfolio"}</p>
              {accountName && !isLoading && (
                <p className="mt-1 truncate text-xs font-medium text-[#5C7372]">Signed in as {accountName}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="shrink-0 text-sm font-bold text-[#3E7574]"
            >
              Sign out
            </button>
          </div>
          <nav aria-label="Portfolio" className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <span className="font-bold text-[#243838] underline decoration-[#6DAEAD] decoration-2 underline-offset-8">
              Overview
            </span>
            <button
              type="button"
              className="font-bold text-[#3E7574] disabled:cursor-not-allowed disabled:opacity-40"
              onClick={openEditor}
              disabled={!portfolio}
            >
              Edit
            </button>
            <button
              type="button"
              id="portfolio-workspace-design"
              className="font-bold text-[#3E7574] disabled:cursor-not-allowed disabled:opacity-40"
              onClick={openDesign}
              disabled={!portfolio}
            >
              Design
            </button>
            <button
              type="button"
              id="portfolio-workspace-review"
              className="font-bold text-[#3E7574]"
              onClick={openReview}
            >
              Review
            </button>
            <span className="font-bold text-[#8AA6A5]" aria-disabled="true">
              Publish
              <span className="ml-2 text-[11px] font-bold uppercase tracking-[0.14em]">Later</span>
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        {isLoading ? (
          <p className="text-sm font-medium text-[#5C7372]">Loading your portfolio…</p>
        ) : loadError ? (
          <Status
            title="Your portfolio could not be loaded."
            body={loadError}
            action={
              <Button id="portfolio-workspace-retry" onClick={load}>
                Try again
              </Button>
            }
          />
        ) : lookup?.status === "missing" ? (
          <Status
            title="Create your portfolio first."
            body="Choose a template first. This workspace does not create a portfolio on its own."
            action={
              <Button id="portfolio-workspace-create" onClick={openCreateFlow}>
                Find a template
              </Button>
            }
          />
        ) : lookup?.status === "legacy" && lookup.reason === "unselected" ? (
          <Status
            title="Choose a template to continue building your portfolio."
            body="Your existing portfolio stays in place until you choose one."
            action={
              <Button id="portfolio-workspace-browse" onClick={openCreateFlow}>
                Browse Templates
              </Button>
            }
          />
        ) : lookup?.status === "legacy" ? (
          <Status
            title="Your workspace portfolio was left unchanged."
            body="This page is for the new template portfolio. Your existing workspace was not edited."
          />
        ) : portfolio && template ? (
          <Overview
            portfolio={portfolio}
            templateName={template.name}
            contentAreas={contentAreas}
            onEdit={openEditor}
            onReview={openReview}
          />
        ) : (
          <Status title="Your portfolio could not be loaded." />
        )}
      </main>
    </div>
  );
}

function Overview({
  portfolio,
  templateName,
  contentAreas,
  onEdit,
  onReview,
}: {
  portfolio: UserPortfolio;
  templateName: string;
  contentAreas: readonly ContentArea[] | null;
  onEdit: () => void;
  onReview: () => void;
}) {
  const name = portfolio.profile.brandName.trim() || "Untitled portfolio";
  const headline = portfolio.profile.headline.trim();
  const portrait = portfolio.profile.heroImage || portfolio.profile.heroImageMobile;
  const status = publishingStatusLabel(portfolio.publishing.status);
  const projectCount = portfolio.projects.length;

  return (
    <div className="max-w-3xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">Your portfolio</p>
      <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end">
        {portrait ? (
          <img src={portrait} alt="" className="h-24 w-24 shrink-0 rounded-full object-cover sm:h-28 sm:w-28" />
        ) : (
          <div className="h-24 w-24 shrink-0 rounded-full bg-[#E7F3F2] sm:h-28 sm:w-28" />
        )}
        <div className="min-w-0">
          <h1 className="break-words text-4xl font-bold tracking-[-0.045em] sm:text-5xl">{name}</h1>
          {headline && <p className="mt-3 break-words text-lg font-medium leading-relaxed text-[#5C7372]">{headline}</p>}
        </div>
      </div>

      <dl className="mt-12 grid gap-8 border-t border-[#D5E6E5] pt-8 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3E7574]">Template</dt>
          <dd className="mt-2 break-words text-lg font-semibold">{templateName}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3E7574]">Status</dt>
          <dd className="mt-2 text-lg font-semibold">{status}</dd>
          <dd className="mt-1 text-sm leading-relaxed text-[#5C7372]">This portfolio is not live.</dd>
        </div>
      </dl>

      <section className="mt-12 border-t border-[#D5E6E5] pt-8" aria-labelledby="portfolio-content">
        <h2 id="portfolio-content" className="text-lg font-bold tracking-[-0.03em]">
          Portfolio content
        </h2>
        {contentAreas ? (
          <>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-[#5C7372]">
              This template can present these parts of your portfolio.
            </p>
            <ul className="mt-6 space-y-3">
              {contentAreas.map((area) => (
                <li key={area} className="text-base font-semibold">
                  {contentAreaLabel(area)}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-[#5C7372]">
            This template is not registered, so its content areas are not listed.
          </p>
        )}
      </section>

      <div className="mt-12 border-t border-[#D5E6E5] pt-8">
        <h2 className="text-lg font-bold tracking-[-0.03em]">Next</h2>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-[#5C7372]">
          Edit the public name, headline, portrait, and projects. Review uses the last saved version.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button id="portfolio-workspace-edit" onClick={onEdit}>
            Edit portfolio
          </Button>
          <Button id="portfolio-workspace-review-action" variant="outline" onClick={onReview}>
            Review portfolio
          </Button>
        </div>
      </div>

      <section className="mt-12 border-t border-[#D5E6E5] pt-8" aria-labelledby="workspace-projects">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="workspace-projects" className="text-lg font-bold tracking-[-0.03em]">
            Projects
          </h2>
          <p className="text-sm font-medium text-[#5C7372]">
            {projectCount} {projectCount === 1 ? "project" : "projects"}
          </p>
        </div>
        {projectCount === 0 ? (
          <p className="mt-6 text-sm font-medium text-[#5C7372]">No projects yet.</p>
        ) : (
          <ul className="mt-6 divide-y divide-[#D5E6E5] border-y border-[#D5E6E5]">
            {portfolio.projects.map((project) => (
              <li key={project.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <span className="break-words font-semibold">{project.title.trim() || "Untitled project"}</span>
                {project.category.trim() && (
                  <span className="break-words text-sm text-[#5C7372]">{project.category}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="mt-6 text-sm font-bold text-[#3E7574] underline-offset-4 hover:underline"
        >
          Edit portfolio
        </button>
      </section>
    </div>
  );
}

function Status({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="max-w-lg">
      <h1 className="text-3xl font-bold tracking-[-0.045em] sm:text-4xl">{title}</h1>
      {body && <p className="mt-4 text-base leading-relaxed text-[#5C7372]">{body}</p>}
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}
