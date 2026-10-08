import React, { useEffect, useState } from "react";
import { brand } from "../../config/branding";
import { userFacingWriteError } from "../../lib/accountLoad";
import { useAuth } from "../../lib/authContext";
import { FAQ_LIMIT, normalizeDiscoverability } from "../../lib/discoverability";
import {
  contentWithSeo,
  portfolioCanonicalUrl,
  portfolioPageDescription,
  portfolioPageTitle,
  templateOffersDiscoverability,
  templateOffersSeo,
} from "../../lib/portfolioSeo";
import type { PortfolioIdentity } from "../../types/discoverability";
import { uploadPortfolioImage, type ImageUploadStatus } from "../../lib/storage";
import { getPortfolioByOwner, updatePortfolio, type OwnedPortfolioLookup } from "../../lib/userPortfolio";
import type { UserPortfolio } from "../../types/userPortfolio";
import { TEMPLATE_DISCOVERY_PATH } from "../discover/templateDiscoveryPath";
import { ImageField } from "../portfolio-editor/ImageField";
import { PORTFOLIO_DESIGN_PATH } from "../portfolio-design/portfolioDesignPath";
import { PORTFOLIO_EDITOR_PATH } from "../portfolio-editor/portfolioEditorPath";
import { PORTFOLIO_PUBLISH_PATH } from "../portfolio-publish/portfolioPublishPath";
import { PORTFOLIO_REVIEW_PATH } from "../portfolio-review/portfolioReviewPath";
import { PORTFOLIO_WORKSPACE_PATH } from "../portfolio-workspace/portfolioWorkspacePath";
import { Button } from "../ui/Button";

type PortfolioSeoProps = {
  onOpenPath: (path: string) => void;
};

export function PortfolioSeo({ onOpenPath }: PortfolioSeoProps) {
  const { signOutUser } = useAuth();
  const [lookup, setLookup] = useState<OwnedPortfolioLookup | null>(null);
  const [portfolio, setPortfolio] = useState<UserPortfolio | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [identity, setIdentity] = useState<PortfolioIdentity>("");
  const [serviceRegion, setServiceRegion] = useState("");
  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>([]);
  const [savedKey, setSavedKey] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageStatus, setImageStatus] = useState<ImageUploadStatus | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const apply = (next: UserPortfolio) => {
    setPortfolio(next);
    setTitle(next.seo.title);
    setDescription(next.seo.description);
    const facts = normalizeDiscoverability(next.discoverability);
    setImage(next.seo.ogImage || next.seo.twitterImage);
    setIdentity(facts.identity);
    setServiceRegion(facts.serviceRegion);
    setFaqs(facts.faqs);
    setSavedKey(snapshot(next.seo.title, next.seo.description, next.seo.ogImage || next.seo.twitterImage, facts));
  };

  const load = () => {
    setIsLoading(true);
    setLoadError(null);
    void getPortfolioByOwner()
      .then((result) => {
        setLookup(result);
        if (result.status === "ready") apply(result.portfolio);
        else setPortfolio(null);
      })
      .catch((error: unknown) => {
        setLoadError(userFacingWriteError(error, "Your portfolio could not be loaded."));
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const upload = (file: File) => {
    if (!portfolio) return;
    setImageError(null);
    setImageStatus({ phase: "preparing", percent: null });
    void uploadPortfolioImage(portfolio.id, file, "social", (status) => setImageStatus(status))
      .then((uploaded) => {
        setImage(uploaded.downloadUrl);
        setJustSaved(false);
      })
      .catch((error: unknown) => {
        setImageStatus(null);
        setImageError(error instanceof Error ? error.message : "Couldn't upload this image. Try again.");
      });
  };

  const save = () => {
    if (!portfolio) return;
    if (image.trim() && !image.trim().toLowerCase().startsWith("https://")) {
      setImageError("Use an https image address.");
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    void updatePortfolio(
      portfolio.id,
      contentWithSeo(portfolio, {
        title,
        description,
        image,
        discoverability: normalizeDiscoverability({ identity, serviceRegion, faqs }),
      })
    )
      .then((saved) => {
        apply(saved);
        setJustSaved(true);
      })
      .catch((error: unknown) => {
        setSaveError(error instanceof Error ? error.message : "Your portfolio could not be updated.");
      })
      .finally(() => setIsSaving(false));
  };

  const offersSeo = portfolio ? templateOffersSeo(portfolio.selectedTemplate) : false;
  const offersFacts = portfolio ? templateOffersDiscoverability(portfolio.selectedTemplate) : false;
  const dirty = portfolio
    ? snapshot(title, description, image, { identity, serviceRegion, faqs }) !== savedKey
    : false;
  const previewTitle = portfolioPageTitle({
    seoTitle: title,
    brandName: portfolio?.profile.brandName,
    headline: portfolio?.profile.headline,
  });
  const previewDescription = portfolioPageDescription({
    seoDescription: description,
    contactDescription: portfolio?.contact.description,
    headline: portfolio?.profile.headline,
    brandName: portfolio?.profile.brandName,
  });
  const previewUrl = portfolio ? portfolioCanonicalUrl(portfolio.id) : null;
  const imageBusy = imageStatus?.phase === "preparing" || imageStatus?.phase === "optimizing" || imageStatus?.phase === "uploading";

  return (
    <div id="portfolio-seo" className="min-h-screen overflow-x-hidden bg-[#F3FAF9] font-sans text-[#243838]">
      <header className="border-b border-[#D5E6E5] bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-5 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">{brand.name}</p>
              <p className="mt-1 text-sm font-semibold">Search and sharing</p>
            </div>
            <button type="button" onClick={() => void signOutUser()} className="shrink-0 text-sm font-bold text-[#3E7574]">
              Sign out
            </button>
          </div>
          <nav aria-label="Portfolio" className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <button type="button" className="font-bold text-[#3E7574]" onClick={() => onOpenPath(PORTFOLIO_WORKSPACE_PATH)}>Overview</button>
            <button type="button" className="font-bold text-[#3E7574]" onClick={() => onOpenPath(PORTFOLIO_EDITOR_PATH)}>Edit</button>
            <button type="button" className="font-bold text-[#3E7574]" onClick={() => onOpenPath(PORTFOLIO_DESIGN_PATH)}>Design</button>
            <button type="button" className="font-bold text-[#3E7574]" onClick={() => onOpenPath(PORTFOLIO_REVIEW_PATH)}>Review</button>
            <button type="button" className="font-bold text-[#3E7574]" onClick={() => onOpenPath(PORTFOLIO_PUBLISH_PATH)}>Publish</button>
            <span className="font-bold text-[#243838] underline decoration-[#6DAEAD] decoration-2 underline-offset-8">SEO</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        {isLoading ? (
          <p className="text-sm font-medium text-[#5C7372]">Loading your portfolio…</p>
        ) : loadError ? (
          <Status title="Your portfolio could not be loaded." body={loadError}>
            <Button id="portfolio-seo-retry" onClick={load}>Try again</Button>
          </Status>
        ) : lookup?.status === "missing" ? (
          <Status title="Create your portfolio first." body="Choose a template first. This page does not create a portfolio.">
            <Button id="portfolio-seo-create" onClick={() => onOpenPath(TEMPLATE_DISCOVERY_PATH)}>Find a template</Button>
          </Status>
        ) : lookup?.status === "legacy" && lookup.reason === "unselected" ? (
          <Status title="Choose a template before editing search details." body="Your existing portfolio stays in place until you choose one.">
            <Button id="portfolio-seo-browse" onClick={() => onOpenPath(TEMPLATE_DISCOVERY_PATH)}>Browse Templates</Button>
          </Status>
        ) : !portfolio || !offersSeo ? (
          <Status title="This template does not use search metadata." body="The portfolio was left unchanged." />
        ) : (
          <div className="max-w-xl">
            <h1 className="text-4xl font-bold tracking-[-0.045em] sm:text-5xl">Search and sharing</h1>
            <p className="mt-4 text-base leading-relaxed text-[#5C7372]">
              These details describe the published page. They do not change the template layout.
            </p>
            <label className="mt-10 block" htmlFor="portfolio-seo-title">
              <span className="text-sm font-semibold">Page title</span>
              <input
                id="portfolio-seo-title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setJustSaved(false);
                }}
                className="mt-2 w-full rounded-xl border border-[#D5E6E5] bg-white px-4 py-3 text-sm"
              />
            </label>
            <label className="mt-6 block" htmlFor="portfolio-seo-description">
              <span className="text-sm font-semibold">Meta description</span>
              <textarea
                id="portfolio-seo-description"
                value={description}
                rows={4}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setJustSaved(false);
                }}
                className="mt-2 w-full rounded-xl border border-[#D5E6E5] bg-white px-4 py-3 text-sm"
              />
            </label>
            <div className="mt-8">
              <ImageField
                id="portfolio-seo-image"
                label="Social sharing image"
                hint="A wide image for link previews. A portrait is not used automatically."
                value={image}
                error={imageError ?? undefined}
                status={imageStatus}
                shape="share"
                disabled={isSaving}
                onUpload={upload}
                onValueChange={(value) => {
                  setImage(value);
                  setJustSaved(false);
                  setImageError(null);
                }}
              />
            </div>
            {offersFacts && (
              <section className="mt-10 border-t border-[#D5E6E5] pt-8" aria-labelledby="portfolio-seo-facts">
                <h2 id="portfolio-seo-facts" className="text-lg font-bold tracking-[-0.03em]">AI Search & Discoverability</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#5C7372]">
                  Describe the work in your own words. These details are optional. Filling them in does not rank the portfolio or mean an AI product has indexed it.
                </p>
                <ul className="mt-4 list-disc space-y-1 pl-5 text-sm leading-relaxed text-[#5C7372]">
                  <li>Describe your work clearly.</li>
                  <li>Name your specialization in the profile, not here again.</li>
                  <li>Answer questions real visitors may ask.</li>
                </ul>
                <label className="mt-8 block" htmlFor="portfolio-seo-identity">
                  <span className="text-sm font-semibold">How should this portfolio be described?</span>
                  <select
                    id="portfolio-seo-identity"
                    value={identity}
                    onChange={(event) => {
                      const value = event.target.value;
                      setIdentity(value === "person" || value === "organization" ? value : "");
                      setJustSaved(false);
                    }}
                    className="mt-2 w-full rounded-xl border border-[#D5E6E5] bg-white px-4 py-3 text-sm"
                  >
                    <option value="">Leave unspecified</option>
                    <option value="person">Individual</option>
                    <option value="organization">Organization</option>
                  </select>
                </label>
                <p className="mt-2 text-sm leading-relaxed text-[#5C7372]">Nothing is inferred. Leave this unspecified if neither fits.</p>
                <label className="mt-6 block" htmlFor="portfolio-seo-region">
                  <span className="text-sm font-semibold">Service area</span>
                  <input
                    id="portfolio-seo-region"
                    value={serviceRegion}
                    onChange={(event) => {
                      setServiceRegion(event.target.value);
                      setJustSaved(false);
                    }}
                    placeholder="Lagos, or Remote"
                    className="mt-2 w-full rounded-xl border border-[#D5E6E5] bg-white px-4 py-3 text-sm"
                  />
                </label>
                <p className="mt-2 text-sm leading-relaxed text-[#5C7372]">A city, region, or remote. Not a street address.</p>
                <div className="mt-8">
                  <h3 className="text-sm font-semibold">Questions</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5C7372]">
                    A question is shown only when it has an answer. Up to {FAQ_LIMIT}.
                  </p>
                  <div className="mt-4 space-y-4">
                    {faqs.map((faq, index) => (
                      <div key={index} className="rounded-2xl border border-[#D5E6E5] bg-white p-4">
                        <label className="block" htmlFor={`portfolio-seo-question-${index}`}>
                          <span className="text-sm font-semibold">Question</span>
                          <input
                            id={`portfolio-seo-question-${index}`}
                            value={faq.question}
                            onChange={(event) => {
                              setFaqs((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, question: event.target.value } : item));
                              setJustSaved(false);
                            }}
                            className="mt-2 w-full rounded-xl border border-[#D5E6E5] px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="mt-4 block" htmlFor={`portfolio-seo-answer-${index}`}>
                          <span className="text-sm font-semibold">Answer</span>
                          <textarea
                            id={`portfolio-seo-answer-${index}`}
                            value={faq.answer}
                            rows={3}
                            onChange={(event) => {
                              setFaqs((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, answer: event.target.value } : item));
                              setJustSaved(false);
                            }}
                            className="mt-2 w-full rounded-xl border border-[#D5E6E5] px-4 py-3 text-sm"
                          />
                        </label>
                        <button
                          type="button"
                          className="mt-3 text-sm font-bold text-[#3E7574]"
                          onClick={() => {
                            setFaqs((current) => current.filter((_, itemIndex) => itemIndex !== index));
                            setJustSaved(false);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  {faqs.length < FAQ_LIMIT && (
                    <button
                      type="button"
                      className="mt-4 text-sm font-bold text-[#3E7574]"
                      onClick={() => {
                        setFaqs((current) => [...current, { question: "", answer: "" }]);
                        setJustSaved(false);
                      }}
                    >
                      Add a question
                    </button>
                  )}
                </div>
                <div className="mt-8 rounded-2xl border border-[#D5E6E5] bg-white p-5">
                  <h3 className="text-sm font-semibold">Content preview</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5C7372]">
                    Public facts from this portfolio. This is not an AI answer, and it does not mean any product has indexed the page.
                  </p>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div>
                      <dt className="font-semibold">Name</dt>
                      <dd className="text-[#5C7372]">{portfolio?.profile.brandName || "Not added yet"}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Headline</dt>
                      <dd className="text-[#5C7372]">{portfolio?.profile.headline || "Not added yet"}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Summary</dt>
                      <dd className="text-[#5C7372]">{portfolio?.contact.description || "The contact description is the public summary. Edit it with the rest of the portfolio."}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Expertise</dt>
                      <dd className="text-[#5C7372]">{portfolio?.profile.capabilityTags.filter(Boolean).join(", ") || "Add areas of expertise in the portfolio editor."}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Services</dt>
                      <dd className="text-[#5C7372]">{portfolio?.contact.projectTypes.filter(Boolean).join(", ") || "Project types in the contact section are the public services."}</dd>
                    </div>
                  </dl>
                </div>
              </section>
            )}
            <section className="mt-10 border-t border-[#D5E6E5] pt-8" aria-labelledby="portfolio-seo-preview">
              <h2 id="portfolio-seo-preview" className="text-lg font-bold tracking-[-0.03em]">Search preview</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#5C7372]">
                An example of how a result may appear. Search engines choose the snippet they show.
              </p>
              <div className="mt-5 rounded-2xl border border-[#D5E6E5] bg-white p-5">
                <p className="break-words text-lg text-[#1a0dab]">{previewTitle}</p>
                {previewUrl && <p className="mt-1 break-all text-sm text-[#006621]">{previewUrl}</p>}
                {previewDescription && <p className="mt-2 break-words text-sm leading-relaxed text-[#4d5156]">{previewDescription}</p>}
              </div>
            </section>
            {dirty && <p className="mt-6 text-sm font-medium text-[#5C7372]">Save to update the public page.</p>}
            {justSaved && <p className="mt-6 text-sm font-semibold text-[#3E7574]">Saved</p>}
            {saveError && <p className="mt-6 text-sm font-medium text-[#B93838]">{saveError}</p>}
            <div className="mt-8">
              <Button id="portfolio-seo-save" isLoading={isSaving} disabled={imageBusy || !dirty} onClick={save}>
                Save
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function snapshot(
  title: string,
  description: string,
  image: string,
  facts: { identity: string; serviceRegion: string; faqs: { question: string; answer: string }[] }
): string {
  return JSON.stringify([title, description, image, facts]);
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
