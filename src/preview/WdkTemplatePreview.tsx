import React, { useEffect, useState } from "react";
import { WdkPremiumPortfolio } from "../templates/wdk-premium-portfolio-1";
import type { PortfolioData } from "../templates/wdk-premium-portfolio-1";
import { useAuth } from "../lib/authContext";
import { userFacingWriteError } from "../lib/accountLoad";
import { allocateHistoryIndex, rememberHistoryIndex } from "../lib/unsavedChanges";
import { templateChoiceError } from "../lib/templateAdoption";
import {
  getPortfolioByOwner,
  useCatalogTemplate,
  type OwnedPortfolioLookup,
} from "../lib/userPortfolio";
import { savedPortfolioPresentation } from "../lib/portfolioReview";
import { catalogTemplateForPreviewPath } from "../lib/templateCatalog";
import { PORTFOLIO_DESIGN_PATH } from "../components/portfolio-design/portfolioDesignPath";
import { PORTFOLIO_EDITOR_PATH } from "../components/portfolio-editor/portfolioEditorPath";
import { isFramedPortfolioReview, PORTFOLIO_REVIEW_PATH } from "../components/portfolio-review/portfolioReviewPath";
import { PORTFOLIO_WORKSPACE_PATH } from "../components/portfolio-workspace/portfolioWorkspacePath";
import { TEMPLATE_DISCOVERY_PATH } from "../components/discover/templateDiscoveryPath";
import { WDK_TEMPLATE_PREVIEW_PATH } from "./templatePreviewPath";
import type { UserPortfolio } from "../types/userPortfolio";
import { Button } from "../components/ui/Button";
import { wdkFictionalPortfolioData } from "./wdkFictionalPortfolioData";
import { wdkSamplePortfolioData } from "./wdkSamplePortfolioData";

const FONT_AWESOME_KIT = "https://kit.fontawesome.com/53480876a4.js";

function useFontAwesomeKit() {
  useEffect(() => {
    const existing = document.querySelector(`script[src="${FONT_AWESOME_KIT}"]`);
    if (existing) return;
    const script = document.createElement("script");
    script.src = FONT_AWESOME_KIT;
    script.crossOrigin = "anonymous";
    script.async = true;
    document.head.appendChild(script);
  }, []);
}

function fixtureData(): PortfolioData | null {
  const data = new URLSearchParams(window.location.search).get("data");
  if (data === "sample") return wdkSamplePortfolioData;
  if (data === "fictional") return wdkFictionalPortfolioData;
  return null;
}

/** Sample previews can show a semantic palette. Saved portfolios ignore this. */
function fixturePalette(): string {
  return new URLSearchParams(window.location.search).get("palette") ?? "original";
}

export const WdkTemplatePreview: React.FC = () => {
  useFontAwesomeKit();
  const framed = isFramedPortfolioReview(window.location.search);
  return (
    <PersistedPortfolioPreview
      fixture={framed ? null : fixtureData()}
      palette={fixturePalette()}
      framed={framed}
    />
  );
};

const PersistedPortfolioPreview: React.FC<{ fixture: PortfolioData | null; palette: string; framed: boolean }> = ({
  fixture,
  palette,
  framed,
}) => {
  const { user, userAccount, authPhase, accountError } = useAuth();
  const template = catalogTemplateForPreviewPath(WDK_TEMPLATE_PREVIEW_PATH);
  const [lookup, setLookup] = useState<OwnedPortfolioLookup | null>(null);
  const [portfolio, setPortfolio] = useState<UserPortfolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || authPhase === "AUTH_LOADING" || authPhase === "ACCOUNT_LOADING") return;
    let active = true;
    setIsLoading(true);
    setError(null);
    void getPortfolioByOwner()
      .then((result) => {
        if (!active) return;
        setLookup(result);
        setPortfolio(result.status === "ready" ? result.portfolio : null);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(userFacingWriteError(loadError, "Your portfolio could not be loaded."));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, authPhase]);

  const useTemplate = () => {
    if (!template) {
      setError("That template is not available.");
      return;
    }
    setIsCreating(true);
    setError(null);
    void useCatalogTemplate(userAccount, template.id)
      .then(() => openAppPath(PORTFOLIO_WORKSPACE_PATH))
      .catch((createError) => {
        setError(templateChoiceError(createError, "Your portfolio could not be created."));
      })
      .finally(() => setIsCreating(false));
  };

  if (!fixture && (authPhase === "AUTH_LOADING" || authPhase === "ACCOUNT_LOADING")) {
    return <PreviewStatus title="Loading your portfolio." body="This stays on your account." />;
  }

  if (!fixture && (!user || authPhase === "SIGNED_OUT")) {
    return (
      <PreviewStatus
        title="Sign in to open your portfolio."
        body="The template renders from your saved portfolio after you are signed in."
        actionLabel="Sign in"
        onAction={() => window.location.assign("/auth")}
      />
    );
  }

  if (fixture && (!user || authPhase === "SIGNED_OUT" || authPhase === "AUTH_LOADING")) {
    return (
      <DesignPreview
        data={fixture}
        palette={palette}
        note="This is a template preview."
        actionLabel="Sign in to use this template"
        onAction={() => window.location.assign("/auth")}
      />
    );
  }

  if (fixture && (authPhase === "ACCOUNT_LOADING" || isLoading)) {
    return (
      <DesignPreview
        data={fixture}
        palette={palette}
        note="This is a template preview."
        actionLabel="Use this template"
        onAction={() => undefined}
        isLoading
      />
    );
  }

  if (!fixture && authPhase === "ACCOUNT_ERROR") {
    return (
      <PreviewStatus
        title="Your account could not be loaded."
        body={accountError || "This is not a new account."}
      />
    );
  }

  if (!fixture && isLoading && !portfolio) {
    return <PreviewStatus title="Loading your portfolio." body="This stays on your account." />;
  }

  if (!fixture && error && !portfolio) {
    return <PreviewStatus title="Something went wrong." body={error} />;
  }

  if (!fixture && portfolio) {
    const presentation = savedPortfolioPresentation(portfolio);
    if (!presentation) {
      return (
        <PreviewStatus
          title="This template cannot be reviewed yet."
          body="The portfolio was left unchanged."
        />
      );
    }
    return (
      <>
        {!framed && <OwnedPreviewActions />}
        <WdkPremiumPortfolio data={presentation.data} palette={presentation.palette} />
      </>
    );
  }

  if (fixture && portfolio) {
    return (
      <>
        <OwnedPreviewActions />
        <WdkPremiumPortfolio data={fixture} palette={palette} />
      </>
    );
  }

  if (lookup?.status === "legacy" && lookup.reason === "unknown") {
    return (
      <PreviewStatus
        title="This account already has a workspace portfolio."
        body="It was left unchanged. A second portfolio was not created."
      />
    );
  }

  if (framed) {
    return (
      <PreviewStatus
        title="Choose a template before reviewing your portfolio."
        body="This preview uses a saved portfolio. It does not create one or assign a template."
      />
    );
  }

  return (
    <DesignPreview
      data={fixture ?? wdkSamplePortfolioData}
      palette={palette}
      note="This is the template. Your portfolio starts when you use it."
      actionLabel="Use this template"
      onAction={useTemplate}
      isLoading={isCreating}
      error={error}
      onTemplates={() => openAppPath(TEMPLATE_DISCOVERY_PATH)}
    />
  );
};

function OwnedPreviewActions() {
  return (
    <div className="fixed right-4 top-4 z-[80] flex max-w-[calc(100%-2rem)] flex-wrap justify-end gap-2">
      <button
        type="button"
        id="portfolio-preview-review"
        onClick={() => openAppPath(PORTFOLIO_REVIEW_PATH)}
        className="rounded-full border border-[#D5E6E5] bg-white/95 px-4 py-2 text-sm font-bold tracking-[-0.02em] text-[#243838] shadow-[0_8px_20px_rgba(36,56,56,0.08)]"
      >
        Review
      </button>
      <button
        type="button"
        id="portfolio-preview-workspace"
        onClick={() => openAppPath(PORTFOLIO_WORKSPACE_PATH)}
        className="rounded-full border border-[#D5E6E5] bg-white/95 px-4 py-2 text-sm font-bold tracking-[-0.02em] text-[#243838] shadow-[0_8px_20px_rgba(36,56,56,0.08)]"
      >
        Workspace
      </button>
      <button
        type="button"
        id="portfolio-preview-edit"
        onClick={() => openAppPath(PORTFOLIO_EDITOR_PATH)}
        className="rounded-full border border-[#D5E6E5] bg-white/95 px-4 py-2 text-sm font-bold tracking-[-0.02em] text-[#243838] shadow-[0_8px_20px_rgba(36,56,56,0.08)]"
      >
        Edit portfolio
      </button>
      <button
        type="button"
        id="portfolio-preview-design"
        onClick={() => openAppPath(PORTFOLIO_DESIGN_PATH)}
        className="rounded-full border border-[#D5E6E5] bg-white/95 px-4 py-2 text-sm font-bold tracking-[-0.02em] text-[#243838] shadow-[0_8px_20px_rgba(36,56,56,0.08)]"
      >
        Design
      </button>
    </div>
  );
}

function DesignPreview({
  data,
  palette = "original",
  note,
  actionLabel,
  onAction,
  isLoading = false,
  error,
  onTemplates,
}: {
  data: PortfolioData;
  palette?: string;
  note: string;
  actionLabel: string;
  onAction: () => void;
  isLoading?: boolean;
  error?: string | null;
  onTemplates?: () => void;
}) {
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-[80] flex flex-wrap items-center justify-between gap-3 border-t border-[#D5E6E5] bg-white/95 px-4 py-3 sm:px-6">
        <p className="min-w-0 max-w-xl text-sm leading-relaxed text-[#5C7372]">{note}</p>
        <div className="flex flex-wrap items-center gap-2">
          {onTemplates && (
            <button type="button" onClick={onTemplates} className="px-2 text-sm font-bold text-[#3E7574]">
              Templates
            </button>
          )}
          <Button id="portfolio-preview-action" isLoading={isLoading} onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
        {error && <p className="w-full text-sm font-medium text-[#B93838]">{error}</p>}
      </div>
      <WdkPremiumPortfolio data={data} palette={palette} />
    </>
  );
}

function openAppPath(path: string) {
  if (window.location.pathname !== path) {
    const idx = allocateHistoryIndex();
    try {
      window.history.pushState({ idx }, "", path);
    } catch {
      rememberHistoryIndex(idx - 1);
    }
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function PreviewStatus({
  title,
  body,
  actionLabel,
  onAction,
  isLoading = false,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  isLoading?: boolean;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F8F7] px-6 text-[#243838]">
      <div className="w-full max-w-lg">
        <h1 className="text-4xl font-bold tracking-[-0.045em]">{title}</h1>
        <p className="mt-4 text-base leading-relaxed text-[#5C7372]">{body}</p>
        {actionLabel && onAction && (
          <div className="mt-8">
            <Button id="portfolio-preview-action" size="lg" isLoading={isLoading} onClick={onAction}>
              {actionLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
