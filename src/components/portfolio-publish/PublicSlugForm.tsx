import React, { useEffect, useState } from "react";
import { canonicalPortfolioUrl } from "../../lib/portfolioSeo";
import { parsePublicSlug, SLUG_CHECK_MESSAGE, slugAvailabilityMessage, slugClaimMessage, type SlugAvailability } from "../../lib/portfolioSlug";
import { previewPublicSlug, savePortfolioSlug } from "../../lib/userPortfolio";
import type { UserPortfolio } from "../../types/userPortfolio";
import { Button } from "../ui/Button";

type PublicSlugFormProps = {
  portfolio: UserPortfolio;
  published: boolean;
  onSaved: (portfolio: UserPortfolio) => void;
};

export function PublicSlugForm({ portfolio, published, onSaved }: PublicSlugFormProps) {
  const [slug, setSlug] = useState(portfolio.publicSlug);
  const [availability, setAvailability] = useState<SlugAvailability | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSlug(portfolio.publicSlug);
    setAvailability(null);
    setSaveError(null);
  }, [portfolio.id, portfolio.publicSlug]);

  const parsed = parsePublicSlug(slug);
  const dirty = parsed.ok ? parsed.slug !== portfolio.publicSlug : slug.trim().toLowerCase() !== portfolio.publicSlug;
  const example = parsed.ok && parsed.slug ? canonicalPortfolioUrl(portfolio.id, parsed.slug) : null;
  const currentUrl = canonicalPortfolioUrl(portfolio.id, portfolio.publicSlug);

  useEffect(() => {
    if (!dirty || !parsed.ok) {
      setAvailability(null);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      void previewPublicSlug(portfolio, parsed.slug)
        .then((result) => {
          if (active) setAvailability(result);
        })
        .catch((error: unknown) => {
          if (!active) return;
          const message = error instanceof Error && error.message
            ? error.message
            : SLUG_CHECK_MESSAGE;
          setAvailability({ status: "unchecked", message });
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [dirty, parsed.ok, parsed.ok ? parsed.slug : slug, portfolio]);

  const availabilityMessage = availability ? slugAvailabilityMessage(availability) : null;
  const blocked = !parsed.ok || availability?.status === "taken" || availability?.status === "identity" || availability?.status === "reserved" || availability?.status === "invalid" || availability?.status === "alias-limit";

  const save = () => {
    if (!dirty || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    void savePortfolioSlug(portfolio.id, slug)
      .then((saved) => {
        onSaved(saved);
        setAvailability(null);
      })
      .catch((error: unknown) => {
        setSaveError(error instanceof Error ? error.message : "That address could not be saved.");
      })
      .finally(() => setIsSaving(false));
  };

  return (
    <section className="max-w-xl">
      <h2 className="text-2xl font-bold tracking-[-0.04em]">Public link</h2>
      <p className="mt-3 text-base leading-relaxed text-[#5C7372]">
        {published
          ? "Choose a shorter address for this portfolio. The original link keeps working."
          : "You can choose an address now. It stays private until you publish."}
      </p>
      {currentUrl && (
        <p className="mt-4 text-sm font-medium text-[#243838]">
          Current address
          <span className="mt-1 block break-all font-semibold">{currentUrl}</span>
        </p>
      )}
      <label className="mt-6 block text-[11px] font-bold uppercase tracking-[0.16em] text-[#3E7574]" htmlFor="portfolio-public-slug">
        Address name
      </label>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-[#D5E6E5] bg-white px-4 py-3">
        <span className="shrink-0 text-sm font-medium text-[#5C7372]">/p/</span>
        <input
          id="portfolio-public-slug"
          value={slug}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => {
            setSlug(event.target.value);
            setSaveError(null);
          }}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#243838] outline-none"
        />
      </div>
      {example && dirty && <p className="mt-3 break-all text-sm text-[#5C7372]">{example}</p>}
      {parsed.ok === false && dirty && <p className="mt-3 text-sm font-medium text-[#B93838]">{slugClaimMessage(parsed.reason)}</p>}
      {parsed.ok && parsed.slug && availability?.status === "available" && (
        <p className="mt-3 text-sm font-medium text-[#3E7574]">Available.</p>
      )}
      {parsed.ok && !parsed.slug && dirty && availability?.status === "available" && (
        <p className="mt-3 text-sm text-[#5C7372]">The original link will be the public address. Previous names stay yours.</p>
      )}
      {parsed.ok && availabilityMessage && (
        <p className="mt-3 text-sm font-medium text-[#B93838]">{availabilityMessage}</p>
      )}
      {saveError && <p className="mt-3 text-sm font-medium text-[#B93838]">{saveError}</p>}
      <div className="mt-4">
        <Button id="portfolio-slug-save" isLoading={isSaving} disabled={!dirty || blocked || isSaving} onClick={save}>
          Save address
        </Button>
      </div>
    </section>
  );
}
