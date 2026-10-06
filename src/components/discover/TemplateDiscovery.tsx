import React, { useEffect, useState } from "react";
import { brand } from "../../config/branding";
import { userFacingWriteError } from "../../lib/accountLoad";
import { useAuth } from "../../lib/authContext";
import { listCatalogTemplates, type CatalogTemplate } from "../../lib/templateCatalog";
import { createPortfolio, getPortfolioByOwner, type OwnedPortfolioLookup } from "../../lib/userPortfolio";
import { PORTFOLIO_WORKSPACE_PATH } from "../portfolio-workspace/portfolioWorkspacePath";
import { Button } from "../ui/Button";

function selectionError(error: unknown): string {
  const guarded = userFacingWriteError(error, "");
  if (guarded) return guarded;
  const raw = error instanceof Error ? error.message : "";
  if (
    raw === "That template is not available." ||
    raw === "This account already has a workspace portfolio. It was left unchanged." ||
    raw === "You need to be signed in to use your portfolio."
  ) {
    return raw;
  }
  return "Your portfolio could not be created.";
}

type TemplateDiscoveryProps = {
  onOpenPath: (path: string) => void;
};

export function TemplateDiscovery({ onOpenPath }: TemplateDiscoveryProps) {
  const { user, userAccount, signOutUser } = useAuth();
  const templates = listCatalogTemplates();
  const template = templates[0] ?? null;
  const [lookup, setLookup] = useState<OwnedPortfolioLookup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChoosing, setIsChoosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    void getPortfolioByOwner()
      .then((result) => {
        if (active) setLookup(result);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(userFacingWriteError(loadError, "Your portfolio could not be loaded."));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const choose = (selected: CatalogTemplate) => {
    if (lookup?.status === "ready") {
      onOpenPath(PORTFOLIO_WORKSPACE_PATH);
      return;
    }
    setIsChoosing(true);
    setError(null);
    void createPortfolio(userAccount, selected.id)
      .then(() => onOpenPath(PORTFOLIO_WORKSPACE_PATH))
      .catch((chooseError: unknown) => {
        setError(selectionError(chooseError));
      })
      .finally(() => setIsChoosing(false));
  };

  const name = userAccount?.accountPrivate?.firstName || user?.displayName;
  const alreadyHasPortfolio = lookup?.status === "ready";
  const hasLegacyPortfolio = lookup?.status === "legacy";

  return (
    <div id="template-discovery" className="min-h-screen overflow-x-hidden bg-[#F3FAF9] font-sans text-[#243838]">
      <header className="border-b border-[#D5E6E5] bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-start justify-between gap-4 px-5 py-5 sm:px-8">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">{brand.name}</p>
            <p className="mt-1 truncate text-sm font-semibold">Find a template</p>
          </div>
          <button type="button" onClick={() => void signOutUser()} className="shrink-0 text-sm font-bold text-[#3E7574]">
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">Templates</p>
        <h1 className="mt-3 max-w-xl break-words text-4xl font-bold leading-[1.05] tracking-[-0.045em] sm:text-5xl">
          {name ? `${name}, choose a starting point.` : "Choose a starting point."}
        </h1>
        <p className="mt-5 max-w-xl text-base font-medium leading-relaxed text-[#5C7372]">
          One portfolio direction is available. Preview it, then use it when you want a draft. Nothing is created before that.
        </p>

        {isLoading ? (
          <p className="mt-12 text-sm font-medium text-[#5C7372]">Loading templates…</p>
        ) : template ? (
          <article className="mt-12 border-t border-[#D5E6E5] pt-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3E7574]">Available now</p>
            <h2 className="mt-3 break-words text-3xl font-bold tracking-[-0.04em]">{template.name}</h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[#5C7372]">{template.description}</p>
            <p className="mt-4 max-w-xl text-base leading-relaxed">{template.fit}</p>
            <p className="mt-6 text-sm font-medium text-[#5C7372]">Version {template.version}</p>

            {alreadyHasPortfolio && (
              <p className="mt-8 max-w-xl text-sm leading-relaxed text-[#5C7372]">
                You already have a draft portfolio. Using this template again will not create another one.
              </p>
            )}
            {hasLegacyPortfolio && (
              <p className="mt-8 max-w-xl text-sm leading-relaxed text-[#5C7372]">
                This account already has a workspace portfolio. It was left unchanged.
              </p>
            )}
            {error && <p className="mt-8 text-sm font-medium text-[#B93838]">{error}</p>}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                id="template-preview"
                variant="outline"
                onClick={() => onOpenPath(template.previewPath)}
              >
                Preview
              </Button>
              {!hasLegacyPortfolio && (
                <Button
                  id="template-use"
                  isLoading={isChoosing}
                  onClick={() => choose(template)}
                >
                  {alreadyHasPortfolio ? "Open your portfolio" : "Use this template"}
                </Button>
              )}
            </div>
          </article>
        ) : (
          <p className="mt-12 text-base leading-relaxed text-[#5C7372]">No templates are available yet.</p>
        )}
      </main>
    </div>
  );
}
