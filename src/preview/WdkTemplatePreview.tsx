import React, { useEffect, useState } from "react";
import { WdkPremiumPortfolio } from "../templates/wdk-premium-portfolio-1";
import type { PortfolioData } from "../templates/wdk-premium-portfolio-1";
import { useAuth } from "../lib/authContext";
import { userFacingWriteError } from "../lib/accountLoad";
import {
  createPortfolio,
  getPortfolioByOwner,
  type OwnedPortfolioLookup,
} from "../lib/userPortfolio";
import { toWdkPremiumPortfolioData } from "../lib/wdkPortfolioAdapter";
import { PORTFOLIO_EDITOR_PATH } from "../components/portfolio-editor/portfolioEditorPath";
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

export const WdkTemplatePreview: React.FC = () => {
  useFontAwesomeKit();
  const fixture = fixtureData();
  if (fixture) {
    return <WdkPremiumPortfolio data={fixture} />;
  }
  return <PersistedPortfolioPreview />;
};

const PersistedPortfolioPreview: React.FC = () => {
  const { user, userAccount, authPhase, accountError } = useAuth();
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

  const create = () => {
    setIsCreating(true);
    setError(null);
    void createPortfolio(userAccount)
      .then((created) => {
        setPortfolio(created);
        setLookup({ status: "ready", portfolio: created });
      })
      .catch((createError) => {
        setError(userFacingWriteError(createError, "Your portfolio could not be created."));
      })
      .finally(() => setIsCreating(false));
  };

  if (authPhase === "AUTH_LOADING" || authPhase === "ACCOUNT_LOADING") {
    return <PreviewStatus title="Loading your portfolio." body="This stays on your account." />;
  }

  if (!user || authPhase === "SIGNED_OUT") {
    return (
      <PreviewStatus
        title="Sign in to open your portfolio."
        body="The template renders from your saved portfolio after you are signed in."
        actionLabel="Sign in"
        onAction={() => window.location.assign("/auth")}
      />
    );
  }

  if (authPhase === "ACCOUNT_ERROR") {
    return (
      <PreviewStatus
        title="Your account could not be loaded."
        body={accountError || "This is not a new account."}
      />
    );
  }

  if (isLoading && !portfolio) {
    return <PreviewStatus title="Loading your portfolio." body="This stays on your account." />;
  }

  if (error) {
    return <PreviewStatus title="Something went wrong." body={error} />;
  }

  if (portfolio) {
    return (
      <>
        <button
          type="button"
          id="portfolio-preview-edit"
          onClick={openPortfolioEditor}
          className="fixed right-4 top-4 z-[80] rounded-full border border-[#D5E6E5] bg-white/95 px-4 py-2 text-sm font-bold tracking-[-0.02em] text-[#243838] shadow-[0_8px_20px_rgba(36,56,56,0.08)]"
        >
          Edit portfolio
        </button>
        <WdkPremiumPortfolio data={toWdkPremiumPortfolioData(portfolio)} />
      </>
    );
  }

  if (lookup?.status === "legacy") {
    return (
      <PreviewStatus
        title="This account already has a workspace portfolio."
        body="It was left unchanged. A second portfolio was not created."
      />
    );
  }

  return (
    <PreviewStatus
      title="Create your portfolio."
      body="This starts a draft from your professional profile. It is not published."
      actionLabel="Create portfolio"
      onAction={create}
      isLoading={isCreating}
    />
  );
};

function openPortfolioEditor() {
  if (window.location.pathname !== PORTFOLIO_EDITOR_PATH) {
    window.history.pushState(null, "", PORTFOLIO_EDITOR_PATH);
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
