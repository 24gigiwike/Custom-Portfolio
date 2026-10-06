import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { brand } from "../../config/branding";
import { portfolioTemplateInfo } from "../../lib/portfolioTemplate";
import { contentAreaLabel } from "../../lib/templateCatalog";
import { allocateProjectId } from "../../lib/projects";
import { uploadPortfolioPortrait } from "../../lib/storage";
import { getPortfolioByOwner, updatePortfolio, type OwnedPortfolioLookup } from "../../lib/userPortfolio";
import type { UserPortfolio } from "../../types/userPortfolio";
import { Button } from "../ui/Button";
import { FieldError, fieldClass } from "../onboarding/StepFrame";
import {
  contentFromDraft,
  createSocialLinkDraft,
  draftFromPortfolio,
  draftsMatch,
  editorAreasForTemplate,
  isSocialPlatform,
  SOCIAL_PLATFORM_OPTIONS,
  validateEditorDraft,
  type EditorArea,
  type EditorContactDraft,
  type EditorDraft,
  type EditorFieldErrors,
  type EditorProjectDraft,
  type EditorSocialDraft,
} from "./editorDraft";

type PortfolioEditorProps = {
  onPreview: (path: string) => void;
  onWorkspace: () => void;
  onDiscover: () => void;
};

export function PortfolioEditor({ onPreview, onWorkspace, onDiscover }: PortfolioEditorProps) {
  const [lookup, setLookup] = useState<OwnedPortfolioLookup | null>(null);
  const [portfolio, setPortfolio] = useState<UserPortfolio | null>(null);
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [savedDraft, setSavedDraft] = useState<EditorDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<EditorFieldErrors | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [portraitError, setPortraitError] = useState<string | null>(null);
  const [portraitProgress, setPortraitProgress] = useState<number | null>(null);

  const load = () => {
    setIsLoading(true);
    setLoadError(null);
    void getPortfolioByOwner()
      .then((result) => {
        setLookup(result);
        if (result.status === "ready") {
          const nextDraft = draftFromPortfolio(result.portfolio);
          setPortfolio(result.portfolio);
          setDraft(nextDraft);
          setSavedDraft(nextDraft);
        } else {
          setPortfolio(null);
          setDraft(null);
          setSavedDraft(null);
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

  const updateDraft = (next: EditorDraft) => {
    setDraft(next);
    setJustSaved(false);
    setSaveError(null);
    setFieldErrors(null);
  };

  const replacePortrait = async (file: File | undefined) => {
    if (!file || !portfolio) return;
    setPortraitError(null);
    setPortraitProgress(0);
    try {
      const uploaded = await uploadPortfolioPortrait(portfolio.id, file, setPortraitProgress);
      setDraft((current) =>
        current
          ? {
              ...current,
              heroImage: uploaded.downloadUrl,
              heroImageMobile: uploaded.downloadUrl,
            }
          : current
      );
      setJustSaved(false);
      setSaveError(null);
      setFieldErrors(null);
    } catch (error: unknown) {
      setPortraitError(error instanceof Error ? error.message : "Couldn't upload this portrait. Try again.");
    } finally {
      setPortraitProgress(null);
    }
  };

  const save = async () => {
    if (!portfolio || !draft || portraitProgress !== null) return;
    const errors = validateEditorDraft(draft, portfolio.selectedTemplate);
    setFieldErrors(errors);
    if (errors) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      const saved = await updatePortfolio(portfolio.id, contentFromDraft(portfolio, draft));
      const nextDraft = draftFromPortfolio(saved);
      setPortfolio(saved);
      setDraft(nextDraft);
      setSavedDraft(nextDraft);
      setJustSaved(true);
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : "Your changes could not be saved. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <Status title="Loading your portfolio…" />;
  }

  if (loadError) {
    return (
      <Status title="Your portfolio could not be loaded." body={loadError}>
        <Button id="portfolio-editor-retry-load" onClick={load}>
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
        <Button id="portfolio-editor-create" onClick={onDiscover}>
          Find a template
        </Button>
      </Status>
    );
  }

  if (lookup?.status === "legacy") {
    return (
      <Status
        title="Your workspace portfolio was left unchanged."
        body="This editor is for the new template portfolio. Your existing workspace was not edited."
      />
    );
  }

  if (!portfolio || !draft || !savedDraft) {
    return <Status title="Your portfolio could not be loaded." />;
  }

  const editorAreas = editorAreasForTemplate(portfolio.selectedTemplate);
  const previewPath = portfolioTemplateInfo(portfolio.selectedTemplate).previewPath;
  const hasUnsavedChanges = !draftsMatch(draft, savedDraft);
  const canEdit = editorAreas !== null && editorAreas.length > 0;
  const leaveEditor = (go: () => void) => {
    if (hasUnsavedChanges && !window.confirm("You have unsaved changes. Leave without saving?")) {
      return;
    }
    go();
  };
  const show = (area: EditorArea) => editorAreas?.includes(area) ?? false;

  return (
    <div id="portfolio-editor" className="min-h-screen overflow-x-hidden bg-[#F3FAF9] font-sans text-[#243838]">
      <header className="sticky top-0 z-20 border-b border-[#D5E6E5] bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 py-5 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">{brand.name}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em]">Edit your portfolio</h1>
            </div>
            {justSaved && <p className="shrink-0 pt-6 text-sm font-semibold text-[#3E7574]">Saved</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-end">
            <Button
              id="portfolio-editor-workspace"
              variant="ghost"
              className="w-full sm:w-auto"
              disabled={portraitProgress !== null}
              onClick={() => leaveEditor(onWorkspace)}
            >
              Workspace
            </Button>
            <Button
              id="portfolio-editor-preview"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={portraitProgress !== null || !previewPath}
              onClick={() => {
                if (!previewPath) return;
                leaveEditor(() => onPreview(previewPath));
              }}
            >
              Preview
            </Button>
            <Button
              id="portfolio-editor-save"
              className="col-span-2 w-full sm:col-span-1 sm:w-auto"
              isLoading={isSaving}
              disabled={portraitProgress !== null || !canEdit}
              onClick={() => void save()}
            >
              Save
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-start">
        <nav aria-label="Portfolio content" className="flex flex-wrap gap-x-5 gap-y-3 lg:sticky lg:top-40 lg:flex-col lg:gap-4">
          {editorAreas?.map((area) => (
            <button
              key={area}
              type="button"
              className="text-left text-sm font-bold text-[#3E7574]"
              onClick={() => document.getElementById(`editor-${area}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              {contentAreaLabel(area)}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          <p className="max-w-xl text-sm leading-relaxed text-[#5C7372]">
            Edit the content this template presents. The template keeps control of how it looks.
          </p>
          {hasUnsavedChanges && <p className="mt-4 text-sm font-medium text-[#5C7372]">Save to update the preview.</p>}
          {saveError && <p className="mt-4 break-words text-sm font-medium text-[#B93838]">{saveError}</p>}

          {!canEdit && (
            <section className="mt-10 max-w-xl">
              <h2 className="text-lg font-bold tracking-[-0.03em]">This template cannot be edited here yet.</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#5C7372]">
                The selected template is not registered for content editing, so these fields were left unchanged.
              </p>
            </section>
          )}

          {show("profile") && (
            <ProfileSection
              draft={draft}
              fieldErrors={fieldErrors}
              portraitError={portraitError}
              portraitProgress={portraitProgress}
              onChange={updateDraft}
              onPortrait={(file) => void replacePortrait(file)}
            />
          )}

          {show("socialLinks") && (
            <SocialSection draft={draft} fieldErrors={fieldErrors} onChange={updateDraft} />
          )}

          {show("projects") && (
            <ProjectsSection
              portfolioId={portfolio.id}
              draft={draft}
              fieldErrors={fieldErrors}
              onChange={updateDraft}
            />
          )}

          {show("contact") && <ContactSection draft={draft} fieldErrors={fieldErrors} onChange={updateDraft} />}
        </div>
      </main>
    </div>
  );
}

function ProfileSection({
  draft,
  fieldErrors,
  portraitError,
  portraitProgress,
  onChange,
  onPortrait,
}: {
  draft: EditorDraft;
  fieldErrors: EditorFieldErrors | null;
  portraitError: string | null;
  portraitProgress: number | null;
  onChange: (next: EditorDraft) => void;
  onPortrait: (file: File | undefined) => void;
}) {
  const portrait = draft.heroImage || draft.heroImageMobile;
  return (
    <section id="editor-profile" className="scroll-mt-64 mt-12" aria-labelledby="profile-heading">
      <h2 id="profile-heading" className="text-lg font-bold tracking-[-0.03em]">
        Profile
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#5C7372]">
        The name, portrait, and introduction on your portfolio. This stays separate from your account.
      </p>

      <div className="mt-8 max-w-xl space-y-6">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Name</span>
          <input
            id="portfolio-name"
            className={fieldClass}
            value={draft.brandName}
            onChange={(event) => onChange({ ...draft, brandName: event.target.value })}
            autoComplete="off"
          />
          <FieldError message={fieldErrors?.brandName} />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Headline</span>
          <textarea
            id="portfolio-headline"
            className={`${fieldClass} min-h-24 resize-y`}
            value={draft.headline}
            onChange={(event) => onChange({ ...draft, headline: event.target.value })}
          />
          <FieldError message={fieldErrors?.headline} />
        </label>

        <div>
          <span className="mb-2 block text-sm font-semibold">Portrait</span>
          <div className="flex flex-wrap items-center gap-4">
            {portrait ? (
              <img src={portrait} alt="" className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <div className="h-20 w-20 rounded-full bg-[#E7F3F2]" />
            )}
            <label className="inline-flex h-11 cursor-pointer items-center rounded-xl border border-[#D5E6E5] bg-white px-5 text-sm font-bold tracking-[-0.02em]">
              {portraitProgress !== null ? `Uploading ${portraitProgress}%` : portrait ? "Replace portrait" : "Add portrait"}
              <input
                id="portfolio-portrait"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                disabled={portraitProgress !== null}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  onPortrait(file);
                }}
              />
            </label>
          </div>
          <FieldError message={portraitError ?? undefined} />
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Logo</span>
          <input
            id="portfolio-logo"
            className={fieldClass}
            value={draft.logo}
            inputMode="url"
            autoComplete="off"
            placeholder="https://"
            onChange={(event) => onChange({ ...draft, logo: event.target.value })}
          />
          <p className="mt-2 text-sm leading-relaxed text-[#5C7372]">The mark shown beside your name. Leave this empty to skip it.</p>
          <FieldError message={fieldErrors?.logo} />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Capabilities</span>
          <textarea
            id="portfolio-capabilities"
            className={`${fieldClass} min-h-28 resize-y`}
            value={draft.capabilityTagsText}
            placeholder={"Brand\nProduct\nWeb"}
            onChange={(event) => onChange({ ...draft, capabilityTagsText: event.target.value })}
          />
          <p className="mt-2 text-sm leading-relaxed text-[#5C7372]">One capability per line.</p>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Button label</span>
          <input
            id="portfolio-cta-label"
            className={fieldClass}
            value={draft.ctaLabel}
            autoComplete="off"
            onChange={(event) => onChange({ ...draft, ctaLabel: event.target.value })}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Button link</span>
          <input
            id="portfolio-cta-href"
            className={fieldClass}
            value={draft.ctaHref}
            inputMode="url"
            autoComplete="off"
            placeholder="#contact"
            onChange={(event) => onChange({ ...draft, ctaHref: event.target.value })}
          />
          <p className="mt-2 text-sm leading-relaxed text-[#5C7372]">A page address, an email, or #contact.</p>
          <FieldError message={fieldErrors?.ctaHref} />
        </label>
      </div>
    </section>
  );
}

function SocialSection({
  draft,
  fieldErrors,
  onChange,
}: {
  draft: EditorDraft;
  fieldErrors: EditorFieldErrors | null;
  onChange: (next: EditorDraft) => void;
}) {
  const updateLink = (id: string, patch: Partial<EditorSocialDraft>) => {
    onChange({
      ...draft,
      socialLinks: draft.socialLinks.map((link) => (link.id === id ? { ...link, ...patch } : link)),
    });
  };

  return (
    <section id="editor-socialLinks" className="scroll-mt-64 mt-16" aria-labelledby="social-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 id="social-heading" className="text-lg font-bold tracking-[-0.03em]">
            Social links
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#5C7372]">
            Links shown with your name. Leave this empty if you prefer not to show any.
          </p>
        </div>
        <Button
          id="portfolio-add-social"
          variant="outline"
          className="w-full sm:w-auto"
          leftIcon={<Plus size={16} />}
          onClick={() => onChange({ ...draft, socialLinks: [...draft.socialLinks, createSocialLinkDraft()] })}
        >
          Add link
        </Button>
      </div>

      {draft.socialLinks.length === 0 ? (
        <p className="mt-8 text-sm font-medium text-[#5C7372]">No social links yet.</p>
      ) : (
        <div className="mt-8 max-w-xl space-y-8">
          {draft.socialLinks.map((link) => (
            <div key={link.id} className="min-w-0 border-t border-[#D5E6E5] pt-6">
              <div className="grid gap-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
                <label className="block min-w-0">
                  <span className="mb-2 block text-sm font-semibold">Platform</span>
                  <select
                    id={`portfolio-social-platform-${link.id}`}
                    className={fieldClass}
                    value={link.platform}
                    onChange={(event) => {
                      if (!isSocialPlatform(event.target.value)) return;
                      updateLink(link.id, { platform: event.target.value });
                    }}
                  >
                    {SOCIAL_PLATFORM_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block min-w-0">
                  <span className="mb-2 block text-sm font-semibold">Link</span>
                  <input
                    id={`portfolio-social-url-${link.id}`}
                    className={fieldClass}
                    value={link.url}
                    inputMode="url"
                    autoComplete="off"
                    placeholder={link.platform === "email" ? "name@studio.com" : "https://"}
                    onChange={(event) => updateLink(link.id, { url: event.target.value })}
                  />
                  <FieldError message={fieldErrors?.socialLinks[link.id]?.url} />
                </label>
              </div>
              <button
                type="button"
                className="mt-4 text-sm font-semibold text-[#5C7372] underline-offset-4 hover:underline"
                onClick={() => onChange({ ...draft, socialLinks: draft.socialLinks.filter((item) => item.id !== link.id) })}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectsSection({
  portfolioId,
  draft,
  fieldErrors,
  onChange,
}: {
  portfolioId: string;
  draft: EditorDraft;
  fieldErrors: EditorFieldErrors | null;
  onChange: (next: EditorDraft) => void;
}) {
  const updateProject = (id: string, patch: Partial<EditorProjectDraft>) => {
    onChange({
      ...draft,
      projects: draft.projects.map((project) => (project.id === id ? { ...project, ...patch } : project)),
    });
  };

  return (
    <section id="editor-projects" className="scroll-mt-64 mt-16" aria-labelledby="projects-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 id="projects-heading" className="text-lg font-bold tracking-[-0.03em]">
            Projects
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#5C7372]">Add the work you want this portfolio to show.</p>
        </div>
        <Button
          id="portfolio-add-project"
          variant="outline"
          className="w-full sm:w-auto"
          leftIcon={<Plus size={16} />}
          onClick={() =>
            onChange({
              ...draft,
              projects: [
                ...draft.projects,
                { id: allocateProjectId(portfolioId), title: "", category: "", url: "", techText: "" },
              ],
            })
          }
        >
          Add project
        </Button>
      </div>

      {draft.projects.length === 0 ? (
        <p className="mt-8 text-sm font-medium text-[#5C7372]">No projects yet.</p>
      ) : (
        <div className="mt-8 max-w-xl space-y-10">
          {draft.projects.map((project, index) => {
            const projectErrors = fieldErrors?.projects[project.id];
            return (
              <div key={project.id} className="min-w-0 border-t border-[#D5E6E5] pt-8">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#3E7574]">Project {index + 1}</h3>
                  <button
                    type="button"
                    className="text-sm font-semibold text-[#5C7372] underline-offset-4 hover:underline"
                    onClick={() => onChange({ ...draft, projects: draft.projects.filter((item) => item.id !== project.id) })}
                  >
                    Remove
                  </button>
                </div>
                <div className="space-y-5">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">Project title</span>
                    <input
                      id={`portfolio-project-title-${project.id}`}
                      className={fieldClass}
                      value={project.title}
                      onChange={(event) => updateProject(project.id, { title: event.target.value })}
                    />
                    <FieldError message={projectErrors?.title} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">Category</span>
                    <input
                      id={`portfolio-project-category-${project.id}`}
                      className={fieldClass}
                      value={project.category}
                      onChange={(event) => updateProject(project.id, { category: event.target.value })}
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="mb-2 block text-sm font-semibold">Project URL</span>
                    <input
                      id={`portfolio-project-url-${project.id}`}
                      className={fieldClass}
                      value={project.url}
                      inputMode="url"
                      onChange={(event) => updateProject(project.id, { url: event.target.value })}
                    />
                    <FieldError message={projectErrors?.url} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">Technologies</span>
                    <textarea
                      id={`portfolio-project-tech-${project.id}`}
                      className={`${fieldClass} min-h-28 resize-y`}
                      value={project.techText}
                      placeholder={"React\nTypeScript\nFirebase"}
                      onChange={(event) => updateProject(project.id, { techText: event.target.value })}
                    />
                    <p className="mt-2 text-sm text-[#5C7372]">One technology per line.</p>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ContactSection({
  draft,
  fieldErrors,
  onChange,
}: {
  draft: EditorDraft;
  fieldErrors: EditorFieldErrors | null;
  onChange: (next: EditorDraft) => void;
}) {
  const updateContact = (patch: Partial<EditorContactDraft>) => {
    onChange({ ...draft, contact: { ...draft.contact, ...patch } });
  };

  return (
    <section id="editor-contact" className="scroll-mt-64 mt-16" aria-labelledby="contact-heading">
      <h2 id="contact-heading" className="text-lg font-bold tracking-[-0.03em]">
        Contact
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#5C7372]">
        The public invitation at the end of the portfolio. It stays separate from your account email.
      </p>

      <div className="mt-8 max-w-xl space-y-6">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Eyebrow</span>
          <input
            id="portfolio-contact-eyebrow"
            className={fieldClass}
            value={draft.contact.eyebrow}
            autoComplete="off"
            onChange={(event) => updateContact({ eyebrow: event.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Heading</span>
          <textarea
            id="portfolio-contact-heading"
            className={`${fieldClass} min-h-24 resize-y`}
            value={draft.contact.heading}
            onChange={(event) => updateContact({ heading: event.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Description</span>
          <textarea
            id="portfolio-contact-description"
            className={`${fieldClass} min-h-28 resize-y`}
            value={draft.contact.description}
            onChange={(event) => updateContact({ description: event.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Project types</span>
          <textarea
            id="portfolio-contact-types"
            className={`${fieldClass} min-h-28 resize-y`}
            value={draft.contact.projectTypesText}
            placeholder={"Identity\nWebsite"}
            onChange={(event) => updateContact({ projectTypesText: event.target.value })}
          />
          <p className="mt-2 text-sm leading-relaxed text-[#5C7372]">One type per line. These appear in the contact form.</p>
        </label>
        <label className="block min-w-0">
          <span className="mb-2 block text-sm font-semibold">Form address</span>
          <input
            id="portfolio-contact-endpoint"
            className={fieldClass}
            value={draft.contact.formEndpoint}
            inputMode="url"
            autoComplete="off"
            placeholder="https://"
            onChange={(event) => updateContact({ formEndpoint: event.target.value })}
          />
          <p className="mt-2 text-sm leading-relaxed text-[#5C7372]">Where the form should send. Leave this empty until you have one.</p>
          <FieldError message={fieldErrors?.formEndpoint} />
        </label>
      </div>
    </section>
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
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.045em]">{title}</h1>
        {body && <p className="mt-4 text-base leading-relaxed text-[#5C7372]">{body}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </div>
  );
}
