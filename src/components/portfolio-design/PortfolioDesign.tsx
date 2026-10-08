import React, { useEffect, useRef, useState } from "react";
import { readableSaveError } from "../../lib/accountLoad";
import { brand } from "../../config/branding";
import { confirmDiscard, useUnsavedChanges } from "../../lib/unsavedChanges";
import { contentWithDesign, designOptionSwatches } from "../../lib/portfolioDesign";
import { portfolioTemplateInfo } from "../../lib/portfolioTemplate";
import { templateDesignCapabilities } from "../../lib/templateCatalog";
import { getPortfolioByOwner, updatePortfolio, type OwnedPortfolioLookup } from "../../lib/userPortfolio";
import type { PortfolioPaletteId } from "../../types/portfolioDesign";
import type { UserPortfolio } from "../../types/userPortfolio";
import { PORTFOLIO_REVIEW_PATH } from "../portfolio-review/portfolioReviewPath";
import { Button } from "../ui/Button";

type PortfolioDesignProps = {
  onPreview: (path: string) => void;
  onWorkspace: () => void;
  onDiscover: () => void;
};

export function PortfolioDesign({ onPreview, onWorkspace, onDiscover }: PortfolioDesignProps) {
  const [lookup, setLookup] = useState<OwnedPortfolioLookup | null>(null);
  const [portfolio, setPortfolio] = useState<UserPortfolio | null>(null);
  const [palette, setPalette] = useState<PortfolioPaletteId | null>(null);
  const [savedPalette, setSavedPalette] = useState<PortfolioPaletteId | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const savingRef = useRef(false);

  const load = () => {
    setIsLoading(true);
    setLoadError(null);
    void getPortfolioByOwner()
      .then((result) => {
        setLookup(result);
        if (result.status === "ready") {
          setPortfolio(result.portfolio);
          setPalette(result.portfolio.design.palette);
          setSavedPalette(result.portfolio.design.palette);
        } else {
          setPortfolio(null);
          setPalette(null);
          setSavedPalette(null);
        }
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : "Your portfolio could not be loaded.");
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const hasUnsavedChanges = palette !== null && savedPalette !== null && palette !== savedPalette;
  useUnsavedChanges(hasUnsavedChanges);

  const save = async () => {
    if (savingRef.current || !portfolio || !palette) return;
    savingRef.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      const saved = await updatePortfolio(portfolio.id, contentWithDesign(portfolio, palette));
      setPortfolio(saved);
      setPalette(saved.design.palette);
      setSavedPalette(saved.design.palette);
      setJustSaved(true);
    } catch (error: unknown) {
      setSaveError(readableSaveError(error, "Your design could not be saved. Try again."));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  if (isLoading) return <Status title="Loading your portfolio…" />;

  if (loadError) {
    return (
      <Status title="Your portfolio could not be loaded." body={loadError}>
        <Button id="portfolio-design-retry-load" onClick={load}>
          Try again
        </Button>
      </Status>
    );
  }

  if (lookup?.status === "missing") {
    return (
      <Status
        title="Create your portfolio first."
        body="Choose a template to create a draft. Nothing is created from this page."
      >
        <Button id="portfolio-design-create" onClick={onDiscover}>
          Find a template
        </Button>
      </Status>
    );
  }

  if (lookup?.status === "legacy" && lookup.reason === "unselected") {
    return (
      <Status
        title="Choose a template to continue building your portfolio."
        body="Your existing portfolio stays in place until you choose one."
      >
        <Button id="portfolio-design-browse" onClick={onDiscover}>
          Browse Templates
        </Button>
      </Status>
    );
  }

  if (lookup?.status === "legacy") {
    return (
      <Status
        title="Your workspace portfolio was left unchanged."
        body="Design choices are for the new template portfolio. Your existing workspace was not edited."
      />
    );
  }

  if (!portfolio || !palette || !savedPalette) {
    return <Status title="Your portfolio could not be loaded." />;
  }

  const capabilities = templateDesignCapabilities(portfolio.selectedTemplate);
  const paletteControl = capabilities?.controls.find((control) => control.id === "palette") ?? null;
  const canEdit = paletteControl !== null;
  const template = portfolioTemplateInfo(portfolio.selectedTemplate);
  const leave = (go: () => void) => {
    if (!confirmDiscard(hasUnsavedChanges)) return;
    go();
  };

  return (
    <div id="portfolio-design" className="min-h-screen overflow-x-hidden bg-[#F3FAF9] font-sans text-[#243838]">
      <header className="sticky top-0 z-20 border-b border-[#D5E6E5] bg-white">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 py-5 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">{brand.name}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em]">Design</h1>
              <p className="mt-1 break-words text-sm font-semibold text-[#5C7372]">{template.name}</p>
            </div>
            {justSaved && <p className="shrink-0 pt-6 text-sm font-semibold text-[#3E7574]" aria-live="polite">Saved</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-end">
            <Button id="portfolio-design-workspace" variant="ghost" className="w-full sm:w-auto" onClick={() => leave(onWorkspace)}>
              Workspace
            </Button>
            <Button
              id="portfolio-design-review"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => leave(() => onPreview(PORTFOLIO_REVIEW_PATH))}
            >
              Review
            </Button>
            <Button
              id="portfolio-design-save"
              className="col-span-2 w-full sm:col-span-1 sm:w-auto"
              isLoading={isSaving}
              disabled={!canEdit}
              onClick={() => void save()}
            >
              Save
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <p className="max-w-xl text-sm leading-relaxed text-[#5C7372]">
          Choose a direction this template can apply. The layout and type stay with the template.
        </p>
        {hasUnsavedChanges && <p className="mt-4 text-sm font-medium text-[#5C7372]">Unsaved changes. Save before leaving.</p>}
        {saveError && <p className="mt-4 break-words text-sm font-medium text-[#B93838]" role="alert">{saveError}</p>}

        {capabilities === null && (
          <section className="mt-10 max-w-xl">
            <h2 className="text-lg font-bold tracking-[-0.03em]">This template cannot be changed here.</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#5C7372]">
              The selected template is not registered, so its design was left unchanged.
            </p>
          </section>
        )}

        {capabilities !== null && !paletteControl && (
          <section className="mt-10 max-w-xl">
            <h2 className="text-lg font-bold tracking-[-0.03em]">This template keeps its own design.</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#5C7372]">
              It does not offer visual choices. The presentation stays as the template designed it.
            </p>
          </section>
        )}

        {paletteControl && (
          <fieldset className="mt-10 max-w-xl">
            <legend className="text-lg font-bold tracking-[-0.03em]">{paletteControl.label}</legend>
            <p className="mt-2 text-sm leading-relaxed text-[#5C7372]">{paletteControl.description}</p>
            <div className="mt-6">
              {paletteControl.options.map((option) => {
                const swatches = designOptionSwatches(portfolio.selectedTemplate, option.id);
                const selected = palette === option.id;
                return (
                  <label
                    key={option.id}
                    className="flex min-w-0 cursor-pointer items-start gap-4 border-t border-[#D5E6E5] py-5"
                  >
                    <input
                      id={`portfolio-design-palette-${option.id}`}
                      className="mt-1 h-4 w-4 shrink-0 accent-[#3E7574]"
                      type="radio"
                      name="portfolio-accent"
                      value={option.id}
                      checked={selected}
                      onChange={() => {
                        setPalette(option.id);
                        setJustSaved(false);
                        setSaveError(null);
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="mt-1 block text-sm leading-relaxed text-[#5C7372]">{option.description}</span>
                      {swatches && (
                        <span className="mt-3 flex gap-2" aria-hidden="true">
                          {swatches.map((color) => (
                            <span
                              key={color}
                              className="h-5 w-5 rounded-full border border-[#D5E6E5]"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
      </main>
    </div>
  );
}

function Status({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-[#F3FAF9] px-6 font-sans text-[#243838]">
      <div className="w-full max-w-lg">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">{brand.name}</p>
        <h1 className="mt-3 break-words text-3xl font-bold tracking-[-0.045em]">{title}</h1>
        {body && <p className="mt-4 text-base leading-relaxed text-[#5C7372]">{body}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </div>
  );
}
