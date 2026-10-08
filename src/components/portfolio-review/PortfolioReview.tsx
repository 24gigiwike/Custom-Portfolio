import React, { useEffect, useState } from "react";
import { brand } from "../../config/branding";
import { userFacingWriteError } from "../../lib/accountLoad";
import { useAuth } from "../../lib/authContext";
import {
  DEFAULT_REVIEW_VIEWPORT,
  reviewEntry,
  reviewViewport,
  type ReviewViewport,
} from "../../lib/portfolioReview";
import { getPortfolioByOwner, type OwnedPortfolioLookup } from "../../lib/userPortfolio";
import { TEMPLATE_DISCOVERY_PATH } from "../discover/templateDiscoveryPath";
import { PORTFOLIO_DESIGN_PATH } from "../portfolio-design/portfolioDesignPath";
import { PORTFOLIO_EDITOR_PATH } from "../portfolio-editor/portfolioEditorPath";
import { PORTFOLIO_PUBLISH_PATH } from "../portfolio-publish/portfolioPublishPath";
import { PORTFOLIO_SEO_PATH } from "../portfolio-seo/portfolioSeoPath";
import { PORTFOLIO_WORKSPACE_PATH } from "../portfolio-workspace/portfolioWorkspacePath";
import { Button } from "../ui/Button";
import { reviewFramePath } from "./portfolioReviewPath";

type PortfolioReviewProps = {
  onOpenPath: (path: string) => void;
};

export function PortfolioReview({ onOpenPath }: PortfolioReviewProps) {
  const { signOutUser } = useAuth();
  const [lookup, setLookup] = useState<OwnedPortfolioLookup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ReviewViewport>(DEFAULT_REVIEW_VIEWPORT);

  const load = () => {
    setIsLoading(true);
    setLoadError(null);
    void getPortfolioByOwner()
      .then((result) => setLookup(result))
      .catch((error: unknown) => {
        setLookup(null);
        setLoadError(userFacingWriteError(error, "Your portfolio could not be loaded."));
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const entry = lookup ? reviewEntry(lookup) : null;
  const chooseViewport = (next: ReviewViewport) => setViewport((current) => reviewViewport(current, next));

  return (
    <div id="portfolio-review" className="min-h-screen overflow-x-hidden bg-[#F3FAF9] font-sans text-[#243838]">
      <header className="border-b border-[#D5E6E5] bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-5 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">{brand.name}</p>
              <p className="mt-1 text-sm font-semibold">Review</p>
            </div>
            <button type="button" onClick={() => void signOutUser()} className="shrink-0 text-sm font-bold text-[#3E7574]">
              Sign out
            </button>
          </div>
          <nav aria-label="Portfolio" className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <button type="button" className="font-bold text-[#3E7574]" onClick={() => onOpenPath(PORTFOLIO_WORKSPACE_PATH)}>
              Overview
            </button>
            <button type="button" className="font-bold text-[#3E7574]" onClick={() => onOpenPath(PORTFOLIO_EDITOR_PATH)}>
              Edit
            </button>
            <button type="button" className="font-bold text-[#3E7574]" onClick={() => onOpenPath(PORTFOLIO_DESIGN_PATH)}>
              Design
            </button>
            <span className="font-bold text-[#243838] underline decoration-[#6DAEAD] decoration-2 underline-offset-8">
              Review
            </span>
            <button type="button" className="font-bold text-[#3E7574]" onClick={() => onOpenPath(PORTFOLIO_SEO_PATH)}>
              SEO
            </button>
            <button type="button" className="font-bold text-[#3E7574]" onClick={() => onOpenPath(PORTFOLIO_PUBLISH_PATH)}>
              Publish
            </button>
          </nav>
        </div>
      </header>

      <main className="pb-16">
        {isLoading ? (
          <p className="mx-auto w-full max-w-5xl px-5 py-10 text-sm font-medium text-[#5C7372] sm:px-8">Loading your portfolio…</p>
        ) : loadError ? (
          <section className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
            <Status title="Your portfolio could not be loaded." body={loadError}>
              <Button id="portfolio-review-retry" onClick={load}>
                Try again
              </Button>
            </Status>
          </section>
        ) : entry?.kind === "missing" ? (
          <section className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
            <Status
              title="Create your portfolio first."
              body="Choose a template first. Review does not create a portfolio."
            >
              <Button id="portfolio-review-create" onClick={() => onOpenPath(TEMPLATE_DISCOVERY_PATH)}>
                Find a template
              </Button>
            </Status>
          </section>
        ) : entry?.kind === "choose-template" ? (
          <section className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
            <Status
              title="Choose a template before reviewing your portfolio."
              body="Your existing portfolio stays in place until you choose one."
            >
              <Button id="portfolio-review-browse" onClick={() => onOpenPath(TEMPLATE_DISCOVERY_PATH)}>
                Browse Templates
              </Button>
            </Status>
          </section>
        ) : entry?.kind === "unsupported" ? (
          <section className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
            <Status
              title="This template cannot be reviewed yet."
              body="The portfolio was left unchanged."
            />
          </section>
        ) : entry?.kind === "review" ? (
          <ReviewBody
            title={entry.assessment.title}
            summary={entry.assessment.summary}
            attention={entry.assessment.items.filter((item) => item.status === "attention")}
            viewport={viewport}
            onViewport={chooseViewport}
            frameSrc={entry.previewPath ? reviewFramePath(entry.previewPath) : null}
            onEdit={() => onOpenPath(PORTFOLIO_EDITOR_PATH)}
            onDesign={() => onOpenPath(PORTFOLIO_DESIGN_PATH)}
            onFullPreview={entry.previewPath ? () => onOpenPath(entry.previewPath as string) : null}
            readyToPublish={!entry.assessment.items.some((item) => item.importance === "important" && item.status === "attention")}
            onPublish={() => onOpenPath(PORTFOLIO_PUBLISH_PATH)}
          />
        ) : (
          <section className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
            <Status title="Your portfolio could not be loaded." />
          </section>
        )}
      </main>
    </div>
  );
}

function ReviewBody({
  title,
  summary,
  attention,
  viewport,
  onViewport,
  frameSrc,
  onEdit,
  onDesign,
  onFullPreview,
  readyToPublish,
  onPublish,
}: {
  title: string;
  summary: string;
  attention: { id: string; label: string; detail: string; importance: "important" | "optional" }[];
  viewport: ReviewViewport;
  onViewport: (next: ReviewViewport) => void;
  frameSrc: string | null;
  onEdit: () => void;
  onDesign: () => void;
  onFullPreview: (() => void) | null;
  readyToPublish: boolean;
  onPublish: () => void;
}) {
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      onViewport("mobile");
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      onViewport("desktop");
    }
  };

  return (
    <>
      <div className="mx-auto w-full max-w-5xl px-5 pt-10 sm:px-8 sm:pt-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">Before publishing</p>
        <h1 className="mt-3 max-w-xl text-4xl font-bold tracking-[-0.045em] sm:text-5xl">Review your portfolio</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-[#5C7372]">
          See how your saved portfolio will appear. This does not publish it.
        </p>
        <div
          role="radiogroup"
          aria-label="Portfolio preview size"
          className="mt-8 flex gap-6"
          onKeyDown={onKeyDown}
        >
          <ViewportChoice
            id="portfolio-review-desktop"
            label="Desktop"
            checked={viewport === "desktop"}
            onChoose={() => onViewport("desktop")}
          />
          <ViewportChoice
            id="portfolio-review-mobile"
            label="Mobile"
            checked={viewport === "mobile"}
            onChoose={() => onViewport("mobile")}
          />
        </div>
      </div>

      <div className="mt-8 overflow-x-auto">
        {frameSrc ? (
          <iframe
            title={viewport === "mobile" ? "Mobile portfolio preview" : "Desktop portfolio preview"}
            src={frameSrc}
            className={
              viewport === "mobile"
                ? "mx-auto block h-[min(844px,78vh)] w-[390px] max-w-full border-0 bg-[#F8F5F0]"
                : "block h-[min(920px,82vh)] w-full min-w-[1100px] border-0 bg-[#F8F5F0]"
            }
          />
        ) : (
          <p className="px-5 text-sm font-medium text-[#5C7372]">This template does not have a preview.</p>
        )}
      </div>

      <section className="mx-auto w-full max-w-5xl px-5 pt-12 sm:px-8" aria-labelledby="review-status">
        <h2 id="review-status" className="text-2xl font-bold tracking-[-0.04em]">{title}</h2>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-[#5C7372]">{summary}</p>
        {attention.length > 0 && (
          <ul className="mt-8 max-w-xl divide-y divide-[#D5E6E5] border-y border-[#D5E6E5]">
            {attention.map((item) => (
              <li key={item.id} className="py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3E7574]">
                  {item.importance === "optional" ? "Optional" : "Needs attention"}
                </p>
                <p className="mt-2 font-semibold">{item.label}</p>
                <p className="mt-1 text-sm leading-relaxed text-[#5C7372]">{item.detail}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button id="portfolio-review-edit" onClick={onEdit}>
            Edit Content
          </Button>
          <Button id="portfolio-review-design" variant="outline" onClick={onDesign}>
            Adjust Design
          </Button>
          {onFullPreview && (
            <button
              type="button"
              id="portfolio-review-full"
              onClick={onFullPreview}
              className="px-2 text-sm font-bold text-[#3E7574]"
            >
              Open full preview
            </button>
          )}
        </div>
        {readyToPublish ? (
          <div className="mt-8">
            <Button id="portfolio-review-publish" variant="outline" onClick={onPublish}>
              Continue to Publish
            </Button>
          </div>
        ) : (
          <p className="mt-8 max-w-xl text-sm leading-relaxed text-[#5C7372]">
            Publishing stays unavailable until the items above are in place.
          </p>
        )}
      </section>
    </>
  );
}

function ViewportChoice({
  id,
  label,
  checked,
  onChoose,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      id={id}
      aria-checked={checked}
      onClick={onChoose}
      className={
        checked
          ? "font-bold text-[#243838] underline decoration-[#6DAEAD] decoration-2 underline-offset-8"
          : "font-bold text-[#3E7574]"
      }
    >
      {label}
    </button>
  );
}

function Status({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <div className="max-w-lg">
      <h1 className="text-3xl font-bold tracking-[-0.045em] sm:text-4xl">{title}</h1>
      {body && <p className="mt-4 text-base leading-relaxed text-[#5C7372]">{body}</p>}
      {children && <div className="mt-8">{children}</div>}
    </div>
  );
}
