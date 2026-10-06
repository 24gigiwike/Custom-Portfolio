import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { brand } from "../../config/branding";
import { Button } from "../ui/Button";
import { FieldError, fieldClass } from "../onboarding/StepFrame";
import { allocateProjectId } from "../../lib/projects";
import { uploadPortfolioPortrait } from "../../lib/storage";
import { getPortfolioByOwner, updatePortfolio, type OwnedPortfolioLookup } from "../../lib/userPortfolio";
import type { UserPortfolio } from "../../types/userPortfolio";
import {
  contentFromDraft,
  draftFromPortfolio,
  draftsMatch,
  validateEditorDraft,
  type EditorDraft,
  type EditorFieldErrors,
} from "./editorDraft";

type PortfolioEditorProps = {
  onPreview: () => void;
  onWorkspace: () => void;
};

export function PortfolioEditor({ onPreview, onWorkspace }: PortfolioEditorProps) {
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
    const errors = validateEditorDraft(draft);
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
        body="This editor opens after you create a draft from the template preview. Nothing is created from this page."
      >
        <Button id="portfolio-editor-create" onClick={onPreview}>
          Go to template preview
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

  const portrait = draft.heroImage || draft.heroImageMobile;
  const hasUnsavedChanges = !draftsMatch(draft, savedDraft);
  const leaveEditor = (go: () => void) => {
    if (hasUnsavedChanges && !window.confirm("You have unsaved changes. Leave without saving?")) {
      return;
    }
    go();
  };

  return (
    <div id="portfolio-editor" className="min-h-screen bg-[#F3FAF9] font-sans text-[#243838]">
      <header className="border-b border-[#D5E6E5] bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">{brand.name}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em]">Edit your portfolio</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {justSaved && <p className="text-sm font-semibold text-[#3E7574]">Saved</p>}
            <Button
              id="portfolio-editor-workspace"
              variant="ghost"
              disabled={portraitProgress !== null}
              onClick={() => leaveEditor(onWorkspace)}
            >
              Workspace
            </Button>
            <Button
              id="portfolio-editor-preview"
              variant="outline"
              disabled={portraitProgress !== null}
              onClick={() => leaveEditor(onPreview)}
            >
              Preview
            </Button>
            <Button id="portfolio-editor-save" isLoading={isSaving} disabled={portraitProgress !== null} onClick={() => void save()}>
              Save
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        {hasUnsavedChanges && (
          <p className="mb-8 text-sm font-medium text-[#5C7372]">Save to update the preview.</p>
        )}
        {saveError && <p className="mb-8 text-sm font-medium text-[#B93838]">{saveError}</p>}

        <section aria-labelledby="basic-information">
          <h2 id="basic-information" className="text-lg font-bold tracking-[-0.03em]">
            Basic information
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#5C7372]">
            This is the name and portrait on your portfolio. It stays separate from your account.
          </p>

          <div className="mt-8 space-y-6">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Name</span>
              <input
                id="portfolio-name"
                className={fieldClass}
                value={draft.brandName}
                onChange={(event) => updateDraft({ ...draft, brandName: event.target.value })}
                autoComplete="off"
              />
              <FieldError message={fieldErrors?.brandName} />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Headline</span>
              <input
                id="portfolio-headline"
                className={fieldClass}
                value={draft.headline}
                onChange={(event) => updateDraft({ ...draft, headline: event.target.value })}
                autoComplete="off"
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
                      void replacePortrait(file);
                    }}
                  />
                </label>
              </div>
              <FieldError message={portraitError ?? undefined} />
            </div>
          </div>
        </section>

        <section className="mt-14" aria-labelledby="projects-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="projects-heading" className="text-lg font-bold tracking-[-0.03em]">
                Projects
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#5C7372]">
                Add the work you want this portfolio to show.
              </p>
            </div>
            <Button
              id="portfolio-add-project"
              variant="outline"
              leftIcon={<Plus size={16} />}
              onClick={() =>
                updateDraft({
                  ...draft,
                  projects: [
                    ...draft.projects,
                    {
                      id: allocateProjectId(portfolio.id),
                      title: "",
                      category: "",
                      url: "",
                      techText: "",
                    },
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
            <div className="mt-8 space-y-10">
              {draft.projects.map((project, index) => {
                const projectErrors = fieldErrors?.projects[project.id];
                return (
                  <div key={project.id} className="border-t border-[#D5E6E5] pt-8">
                    <div className="mb-5 flex items-center justify-between gap-4">
                      <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#3E7574]">
                        Project {index + 1}
                      </h3>
                      <button
                        type="button"
                        className="text-sm font-semibold text-[#5C7372] underline-offset-4 hover:underline"
                        onClick={() =>
                          updateDraft({
                            ...draft,
                            projects: draft.projects.filter((item) => item.id !== project.id),
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                    <div className="space-y-5">
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold">Project title</span>
                        <input
                          className={fieldClass}
                          value={project.title}
                          onChange={(event) =>
                            updateDraft({
                              ...draft,
                              projects: draft.projects.map((item) =>
                                item.id === project.id ? { ...item, title: event.target.value } : item
                              ),
                            })
                          }
                        />
                        <FieldError message={projectErrors?.title} />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold">Category</span>
                        <input
                          className={fieldClass}
                          value={project.category}
                          onChange={(event) =>
                            updateDraft({
                              ...draft,
                              projects: draft.projects.map((item) =>
                                item.id === project.id ? { ...item, category: event.target.value } : item
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold">Project URL</span>
                        <input
                          className={fieldClass}
                          value={project.url}
                          inputMode="url"
                          onChange={(event) =>
                            updateDraft({
                              ...draft,
                              projects: draft.projects.map((item) =>
                                item.id === project.id ? { ...item, url: event.target.value } : item
                              ),
                            })
                          }
                        />
                        <FieldError message={projectErrors?.url} />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold">Technologies</span>
                        <textarea
                          className={`${fieldClass} min-h-28 resize-y`}
                          value={project.techText}
                          placeholder={"React\nTypeScript\nFirebase"}
                          onChange={(event) =>
                            updateDraft({
                              ...draft,
                              projects: draft.projects.map((item) =>
                                item.id === project.id ? { ...item, techText: event.target.value } : item
                              ),
                            })
                          }
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
    <div className="flex min-h-screen items-center justify-center bg-[#F3FAF9] px-6 font-sans text-[#243838]">
      <div className="w-full max-w-lg">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">{brand.name}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.045em]">{title}</h1>
        {body && <p className="mt-4 text-base leading-relaxed text-[#5C7372]">{body}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </div>
  );
}
