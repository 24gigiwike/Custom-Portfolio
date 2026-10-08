import React, { useEffect, useState } from "react";
import { brand } from "../../config/branding";
import { userFacingWriteError } from "../../lib/accountLoad";
import { useAuth } from "../../lib/authContext";
import { isPortfolioPublished, publishChoiceError, publishEntry } from "../../lib/portfolioPublishing";
import { publicPortfolioUrl } from "../public/publicPortfolioPath";
import { getPortfolioByOwner, publishPortfolio, syncPublishedPortfolio, unpublishPortfolio, type OwnedPortfolioLookup } from "../../lib/userPortfolio";
import type { UserPortfolio } from "../../types/userPortfolio";
import { TEMPLATE_DISCOVERY_PATH } from "../discover/templateDiscoveryPath";
import { PORTFOLIO_DESIGN_PATH } from "../portfolio-design/portfolioDesignPath";
import { PORTFOLIO_EDITOR_PATH } from "../portfolio-editor/portfolioEditorPath";
import { PORTFOLIO_REVIEW_PATH } from "../portfolio-review/portfolioReviewPath";
import { PORTFOLIO_SEO_PATH } from "../portfolio-seo/portfolioSeoPath";
import { PORTFOLIO_WORKSPACE_PATH } from "../portfolio-workspace/portfolioWorkspacePath";
import { Button } from "../ui/Button";

type PortfolioPublishProps = {
  onOpenPath: (path: string) => void;
};

export function PortfolioPublish({ onOpenPath }: PortfolioPublishProps) {
  const { signOutUser } = useAuth();
  const [lookup, setLookup] = useState<OwnedPortfolioLookup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);

  const load = () => {
    setIsLoading(true);
    setLoadError(null);
    void getPortfolioByOwner()
      .then(async (result) => {
        setLookup(result);
        setConfirmUnpublish(false);
        if (result.status === "ready" && isPortfolioPublished(result.portfolio.publishing)) {
          try {
            await syncPublishedPortfolio(result.portfolio.id);
          } catch (error: unknown) {
            setActionError(publishChoiceError(error, "The public page could not be updated."));
          }
        }
      })
      .catch((error: unknown) => {
        setLookup(null);
        setLoadError(userFacingWriteError(error, "Your portfolio could not be loaded."));
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const remember = (portfolio: UserPortfolio) => {
    setLookup({ status: "ready", portfolio });
    setActionError(null);
    setConfirmUnpublish(false);
  };

  const publish = (portfolioId: string) => {
    setIsPublishing(true);
    setActionError(null);
    void publishPortfolio(portfolioId)
      .then(remember)
      .catch((error: unknown) => {
        setActionError(publishChoiceError(error, "Your portfolio could not be published."));
      })
      .finally(() => setIsPublishing(false));
  };

  const unpublish = (portfolioId: string) => {
    setIsUnpublishing(true);
    setActionError(null);
    void unpublishPortfolio(portfolioId)
      .then(remember)
      .catch((error: unknown) => {
        setActionError(publishChoiceError(error, "Your portfolio could not be unpublished."));
      })
      .finally(() => setIsUnpublishing(false));
  };

  const entry = lookup ? publishEntry(lookup) : null;
  const busy = isPublishing || isUnpublishing;

  return (
    <div id="portfolio-publish" className="min-h-screen overflow-x-hidden bg-[#F3FAF9] font-sans text-[#243838]">
      <header className="border-b border-[#D5E6E5] bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-5 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">{brand.name}</p>
              <p className="mt-1 text-sm font-semibold">Publish</p>
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
            <button type="button" className="font-bold text-[#3E7574]" onClick={() => onOpenPath(PORTFOLIO_REVIEW_PATH)}>
              Review
            </button>
            <button type="button" className="font-bold text-[#3E7574]" onClick={() => onOpenPath(PORTFOLIO_SEO_PATH)}>
              SEO
            </button>
            <span className="font-bold text-[#243838] underline decoration-[#6DAEAD] decoration-2 underline-offset-8">
              Publish
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        {isLoading ? (
          <p className="text-sm font-medium text-[#5C7372]">Loading your portfolio…</p>
        ) : loadError ? (
          <Status title="Your portfolio could not be loaded." body={loadError}>
            <Button id="portfolio-publish-retry" onClick={load}>
              Try again
            </Button>
          </Status>
        ) : entry?.kind === "missing" ? (
          <Status title="Create your portfolio first." body="Choose a template first. This page does not create a portfolio.">
            <Button id="portfolio-publish-create" onClick={() => onOpenPath(TEMPLATE_DISCOVERY_PATH)}>
              Find a template
            </Button>
          </Status>
        ) : entry?.kind === "choose-template" ? (
          <Status
            title="Choose a template before publishing your portfolio."
            body="Your existing portfolio stays in place until you choose one."
          >
            <Button id="portfolio-publish-browse" onClick={() => onOpenPath(TEMPLATE_DISCOVERY_PATH)}>
              Browse Templates
            </Button>
          </Status>
        ) : entry?.kind === "unsupported" ? (
          <Status title="This template cannot be published." body="The portfolio was left unchanged." />
        ) : entry?.kind === "published" ? (
          <PublishedState
            publicUrl={publicPortfolioUrl(entry.portfolio.id)}
            confirming={confirmUnpublish}
            busy={busy}
            isUnpublishing={isUnpublishing}
            error={actionError}
            onAsk={() => setConfirmUnpublish(true)}
            onCancel={() => setConfirmUnpublish(false)}
            onConfirm={() => unpublish(entry.portfolio.id)}
          />
        ) : entry?.kind === "draft" ? (
          <DraftState
            ready={entry.blockers.length === 0}
            blockers={entry.blockers}
            busy={busy}
            isPublishing={isPublishing}
            error={actionError}
            onPublish={() => publish(entry.portfolio.id)}
            onReview={() => onOpenPath(PORTFOLIO_REVIEW_PATH)}
          />
        ) : (
          <Status title="Your portfolio could not be loaded." />
        )}
      </main>
    </div>
  );
}

function DraftState({
  ready,
  blockers,
  busy,
  isPublishing,
  error,
  onPublish,
  onReview,
}: {
  ready: boolean;
  blockers: { id: string; label: string; detail: string }[];
  busy: boolean;
  isPublishing: boolean;
  error: string | null;
  onPublish: () => void;
  onReview: () => void;
}) {
  return (
    <div className="max-w-xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">Draft</p>
      <h1 className="mt-3 text-4xl font-bold tracking-[-0.045em] sm:text-5xl">
        {ready ? "Ready to publish" : "Not ready to publish"}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-[#5C7372]">
        Publish makes this portfolio available at a public address. You can still edit it afterward.
      </p>
      {blockers.length > 0 && (
        <ul className="mt-8 divide-y divide-[#D5E6E5] border-y border-[#D5E6E5]">
          {blockers.map((item) => (
            <li key={item.id} className="py-4">
              <p className="font-semibold">{item.label}</p>
              <p className="mt-1 text-sm leading-relaxed text-[#5C7372]">{item.detail}</p>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-6 text-sm font-medium text-[#B93838]">{error}</p>}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {ready ? (
          <Button id="portfolio-publish-action" isLoading={isPublishing} disabled={busy} onClick={onPublish}>
            Publish Portfolio
          </Button>
        ) : (
          <Button id="portfolio-publish-review" onClick={onReview}>
            Review your portfolio
          </Button>
        )}
      </div>
    </div>
  );
}

function PublishedState({
  publicUrl,
  confirming,
  busy,
  isUnpublishing,
  error,
  onAsk,
  onCancel,
  onConfirm,
}: {
  publicUrl: string;
  confirming: boolean;
  busy: boolean;
  isUnpublishing: boolean;
  error: string | null;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");

  const copyLink = () => {
    const write = navigator.clipboard?.writeText(publicUrl);
    if (!write) {
      setCopyState("manual");
      return;
    }
    void write.then(
      () => setCopyState("copied"),
      () => setCopyState("manual")
    );
  };

  return (
    <div className="max-w-xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">Published</p>
      <h1 className="mt-3 text-4xl font-bold tracking-[-0.045em] sm:text-5xl">Your portfolio is live</h1>
      <p className="mt-4 text-base leading-relaxed text-[#5C7372]">
        Anyone with this address can view the published portfolio. You can still edit it.
      </p>
      <label className="mt-8 block text-[11px] font-bold uppercase tracking-[0.16em] text-[#3E7574]" htmlFor="portfolio-public-url">
        Public address
      </label>
      <input
        id="portfolio-public-url"
        readOnly
        value={publicUrl}
        onFocus={(event) => event.currentTarget.select()}
        className="mt-2 w-full rounded-xl border border-[#D5E6E5] bg-white px-4 py-3 text-sm font-medium text-[#243838]"
      />
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <a
          id="portfolio-view-public"
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-[#6DAEAD] px-5 text-sm font-bold text-white"
        >
          View Portfolio
        </a>
        <Button id="portfolio-copy-link" variant="outline" onClick={copyLink}>
          Copy Link
        </Button>
      </div>
      {copyState === "copied" && <p className="mt-3 text-sm font-medium text-[#3E7574]">Link copied.</p>}
      {copyState === "manual" && (
        <p className="mt-3 text-sm font-medium text-[#5C7372]">Select the address above and copy it.</p>
      )}
      {error && <p className="mt-6 text-sm font-medium text-[#B93838]">{error}</p>}
      {confirming ? (
        <div className="mt-10 border-t border-[#D5E6E5] pt-8">
          <h2 className="text-2xl font-bold tracking-[-0.04em]">Unpublish this portfolio?</h2>
          <p className="mt-3 text-base leading-relaxed text-[#5C7372]">
            It returns to a draft, and the public address stops showing it. Your content, design, and template stay where they are.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button id="portfolio-unpublish-confirm" isLoading={isUnpublishing} disabled={busy} onClick={onConfirm}>
              Unpublish
            </Button>
            <Button id="portfolio-unpublish-cancel" variant="outline" disabled={busy} onClick={onCancel}>
              Keep published
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <Button id="portfolio-unpublish" variant="outline" disabled={busy} onClick={onAsk}>
            Unpublish
          </Button>
        </div>
      )}
    </div>
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
