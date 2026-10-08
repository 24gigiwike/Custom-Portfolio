import React, { useEffect, useState } from "react";
import { WdkPremiumPortfolio } from "../../templates/wdk-premium-portfolio-1";
import { getPublicPortfolio, type PublicPortfolioLookup } from "../../lib/publicPortfolioStore";
import { resolvePublicPortfolioSeo, resolvedToPortfolioSeo, siteEnvironmentFromHost } from "../../lib/portfolioSeo";
import { publicPortfolioPresentation } from "../../lib/publicPortfolio";
import type { PublicPortfolio } from "../../types/publicPortfolio";

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

function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export function PublicPortfolioView({ publicId }: { publicId: string }) {
  useFontAwesomeKit();
  const [lookup, setLookup] = useState<PublicPortfolioLookup | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLookup(null);
    void getPublicPortfolio(publicId).then((result) => {
      if (active) setLookup(result);
    });
    return () => {
      active = false;
    };
  }, [publicId, attempt]);

  if (!lookup) {
    return <PublicStatus title="Loading portfolio…" titleText="Portfolio" />;
  }

  if (lookup.status === "error") {
    return (
      <PublicStatus title="This portfolio could not be loaded." titleText="Portfolio">
        <button
          type="button"
          id="public-portfolio-retry"
          onClick={() => setAttempt((value) => value + 1)}
          className="text-sm font-semibold text-[#243838] underline decoration-[#243838]/30 underline-offset-4"
        >
          Try again
        </button>
      </PublicStatus>
    );
  }

  if (lookup.status === "unavailable") {
    return <PublicStatus title="This portfolio is not available." titleText="Portfolio" />;
  }

  return <PublishedPortfolio portfolio={lookup.portfolio} />;
}

function PublishedPortfolio({ portfolio }: { portfolio: PublicPortfolio }) {
  const presentation = publicPortfolioPresentation(portfolio);
  const resolved = resolvePublicPortfolioSeo(portfolio, siteEnvironmentFromHost(window.location.hostname));

  if (!presentation || !resolved) {
    return <PublicStatus title="This portfolio is not available." titleText="Portfolio" />;
  }

  return (
    <WdkPremiumPortfolio
      data={{ ...presentation.data, seo: resolvedToPortfolioSeo(resolved) }}
      palette={presentation.palette}
      robots={resolved.robots}
    />
  );
}

function PublicStatus({
  title,
  titleText,
  children,
}: {
  title: string;
  titleText: string;
  children?: React.ReactNode;
}) {
  useDocumentTitle(titleText);
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F5F0] px-6 font-sans text-[#243838]">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">{title}</h1>
        {children && <div className="mt-6">{children}</div>}
      </div>
    </main>
  );
}
