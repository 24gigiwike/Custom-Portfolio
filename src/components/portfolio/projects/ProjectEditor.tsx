import React, { useRef, useState } from "react";
import {
  ArrowLeft,
  Save,
  Check,
  Loader2,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { ProjectForm, type ProjectFormData } from "./ProjectForm";
import type { ProjectMediaHandle } from "./ProjectMedia";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { Button } from "../../ui/Button";
import type { Project } from "../../../types/project";
import type { Portfolio } from "../../../types/portfolio";
import {
  allocateProjectId,
  createProject,
  updateProject,
  deleteProject,
  generateProjectSlug,
} from "../../../lib/projects";
import { deleteStoredImages } from "../../../lib/storage";
import { alignImagePaths, collectStoredImagePaths } from "../../../lib/projectImagePaths";
import { userFacingWriteError } from "../../../lib/accountLoad";

interface ProjectEditorProps {
  portfolio: Portfolio;
  projectToEdit: Project | null;
  onBack: () => void;
  onSaved: (savedProject: Project) => void;
  onDeleted: (deletedProjectId: string) => void;
}

export const ProjectEditor: React.FC<ProjectEditorProps> = ({
  portfolio,
  projectToEdit,
  onBack,
  onSaved,
  onDeleted,
}) => {
  const isCreating = !projectToEdit;
  const [projectId] = useState(() => projectToEdit?.id || allocateProjectId(portfolio.id));
  const mediaRef = useRef<ProjectMediaHandle>(null);

  // Initialize form state
  const [formData, setFormData] = useState<ProjectFormData>(() => {
    if (projectToEdit) {
      const images = projectToEdit.images || [];
      return {
        title: projectToEdit.title,
        slug: projectToEdit.slug,
        shortDescription: projectToEdit.shortDescription,
        description: projectToEdit.description || "",
        coverImage: projectToEdit.coverImage || null,
        coverImagePath: projectToEdit.coverImagePath || null,
        images,
        imagePaths: alignImagePaths(images, projectToEdit.imagePaths),
        role: projectToEdit.role || "",
        client: projectToEdit.client || "",
        year: projectToEdit.year || "",
        services: projectToEdit.services || [],
        tools: projectToEdit.tools || [],
        projectUrl: projectToEdit.projectUrl || "",
        caseStudyUrl: projectToEdit.caseStudyUrl || "",
        featured: Boolean(projectToEdit.featured),
      };
    }
    return {
      title: "",
      slug: "",
      shortDescription: "",
      description: "",
      coverImage: null,
      coverImagePath: null,
      images: [],
      imagePaths: [],
      role: "",
      client: "",
      year: "",
      services: [],
      tools: [],
      projectUrl: "",
      caseStudyUrl: "",
      featured: false,
    };
  });

  const persistedPathsRef = useRef<Set<string>>(new Set(collectStoredImagePaths(formData)));

  const [initialData, setInitialData] = useState<ProjectFormData>(formData);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Auto-slug when creating new project and typing title
  const handleFormChange = (updatedFields: Partial<ProjectFormData>) => {
    let abandonedUploads: string[] = [];
    setFormData((prev) => {
      const next = { ...prev, ...updatedFields };

      // Auto generate slug if title is changed and user is creating or slug was empty/matched old title slug
      if (
        isCreating &&
        updatedFields.title !== undefined &&
        (!prev.slug || prev.slug === generateProjectSlug(prev.title))
      ) {
        next.slug = generateProjectSlug(updatedFields.title);
      }

      // Check change against initial
      const isDifferent = JSON.stringify(next) !== JSON.stringify(initialData);
      setHasUnsavedChanges(isDifferent);
      if (saveStatus === "saved") setSaveStatus("idle");

      const nextPaths = new Set(collectStoredImagePaths(next));
      abandonedUploads = collectStoredImagePaths(prev).filter(
        (path) => !nextPaths.has(path) && !persistedPathsRef.current.has(path)
      );

      return next;
    });
    if (abandonedUploads.length > 0) {
      void deleteStoredImages(abandonedUploads);
    }

    // Clear related field errors
    if (updatedFields.title) {
      setFieldErrors((prev) => ({ ...prev, title: "" }));
    }
    if (updatedFields.shortDescription) {
      setFieldErrors((prev) => ({ ...prev, shortDescription: "" }));
    }
  };

  // Validate form
  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) {
      errors.title = "Project title is required.";
    }
    if (!formData.shortDescription.trim()) {
      errors.shortDescription = "Short description is required.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validate()) {
      setErrorMessage("Please complete the required fields.");
      return;
    }

    setIsSaving(true);
    setSaveStatus("idle");
    setErrorMessage(null);

    try {
      if (isCreating) {
        const created = await createProject(portfolio.id, {
          title: formData.title,
          slug: formData.slug,
          shortDescription: formData.shortDescription,
          description: formData.description,
          coverImage: formData.coverImage,
          coverImagePath: formData.coverImagePath,
          images: formData.images,
          imagePaths: formData.imagePaths,
          role: formData.role,
          client: formData.client,
          year: formData.year,
          services: formData.services,
          tools: formData.tools,
          projectUrl: formData.projectUrl,
          caseStudyUrl: formData.caseStudyUrl,
          featured: formData.featured,
        }, projectId);

        const obsolete = [...persistedPathsRef.current].filter(
          (path) => !collectStoredImagePaths(formData).includes(path)
        );
        persistedPathsRef.current = new Set(collectStoredImagePaths(formData));
        setInitialData(formData);
        setHasUnsavedChanges(false);
        setSaveStatus("saved");
        await deleteStoredImages(obsolete);
        setTimeout(() => {
          onSaved(created);
        }, 600);
      } else {
        await updateProject(portfolio.id, projectToEdit.id, {
          title: formData.title,
          slug: formData.slug,
          shortDescription: formData.shortDescription,
          description: formData.description,
          coverImage: formData.coverImage,
          coverImagePath: formData.coverImagePath,
          images: formData.images,
          imagePaths: formData.imagePaths,
          role: formData.role,
          client: formData.client,
          year: formData.year,
          services: formData.services,
          tools: formData.tools,
          projectUrl: formData.projectUrl,
          caseStudyUrl: formData.caseStudyUrl,
          featured: formData.featured,
        });

        const updatedProject: Project = {
          ...projectToEdit,
          title: formData.title.trim(),
          slug: formData.slug.trim(),
          shortDescription: formData.shortDescription.trim(),
          description: formData.description.trim(),
          coverImage: formData.coverImage,
          coverImagePath: formData.coverImagePath,
          images: formData.images,
          imagePaths: formData.imagePaths,
          role: formData.role.trim(),
          client: formData.client.trim(),
          year: formData.year.trim(),
          services: formData.services,
          tools: formData.tools,
          projectUrl: formData.projectUrl.trim(),
          caseStudyUrl: formData.caseStudyUrl.trim(),
          featured: formData.featured,
        };

        const obsolete = [...persistedPathsRef.current].filter(
          (path) => !collectStoredImagePaths(formData).includes(path)
        );
        persistedPathsRef.current = new Set(collectStoredImagePaths(formData));
        setInitialData(formData);
        setHasUnsavedChanges(false);
        setSaveStatus("saved");
        await deleteStoredImages(obsolete);
        setTimeout(() => {
          onSaved(updatedProject);
        }, 600);
      }
    } catch (err) {
      console.error("Save Project Error:", err);
      setSaveStatus("error");
      setErrorMessage(userFacingWriteError(err, "We couldn't save this project. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!projectToEdit) return;
    setIsDeleting(true);
    try {
      await deleteProject(portfolio.id, projectToEdit.id);
      setShowDeleteModal(false);
      onDeleted(projectToEdit.id);
    } catch (err) {
      console.error("Failed to delete project:", err);
      setErrorMessage(userFacingWriteError(err, "We couldn't delete this project. Please try again."));
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle back with unsaved check
  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm("You have unsaved changes. Discard and leave?");
      if (!confirmLeave) return;
    }
    mediaRef.current?.cancelPendingUploads();
    const abandoned = collectStoredImagePaths(formData).filter(
      (path) => !persistedPathsRef.current.has(path)
    );
    void deleteStoredImages(abandoned);
    onBack();
  };

  return (
    <div
      id="project-editor-view"
      className="flex min-h-screen flex-col bg-[#F3FAF9] font-sans text-[#243838] selection:bg-[#6DAEAD]/25"
    >
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#D5E6E5]/80 bg-white/75 px-4 py-3.5 backdrop-blur-xl sm:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="editor-back-to-projects-btn"
            onClick={handleBackClick}
            className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-bold text-[#3E7574] transition-colors hover:bg-[#E7F4F3] hover:text-[#243838]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Work</span>
          </button>

          <span className="text-xs text-[#B7D4D2]">/</span>

          <span className="max-w-[200px] truncate text-sm font-bold text-[#243838] sm:max-w-xs">
            {formData.title || (isCreating ? "New Project" : "Edit Project")}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <div className="hidden items-center text-xs sm:flex">
            {isSaving && (
              <span className="flex items-center gap-1.5 font-semibold text-[#3E7574]">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#6DAEAD]" />
                <span>Saving...</span>
              </span>
            )}
            {!isSaving && saveStatus === "saved" && (
              <span className="flex items-center gap-1 font-semibold text-[#2F7D62]">
                <Check className="h-3.5 w-3.5" />
                <span>Saved</span>
              </span>
            )}
            {!isSaving && saveStatus === "idle" && hasUnsavedChanges && (
              <span className="font-semibold text-[#5C7372]">Unsaved changes</span>
            )}
            {!isSaving && saveStatus === "idle" && !hasUnsavedChanges && !isCreating && (
              <span className="font-semibold text-[#8AADAC]">Up to date</span>
            )}
          </div>

          {!isCreating && (
            <button
              type="button"
              id="editor-delete-project-btn"
              onClick={() => setShowDeleteModal(true)}
              className="rounded-xl p-2 text-[#6E8887] transition-colors hover:bg-[#FFF6F6] hover:text-[#B93838]"
              title="Delete project"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <Button
            id="save-project-submit-btn"
            variant="primary"
            size="sm"
            isLoading={isSaving}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save project</span>
          </Button>
        </div>
      </header>

      {/* Main Form Content */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-8 sm:py-12">
        <div className="mb-8">
          <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">
            {isCreating ? "New project" : "Project editor"}
          </span>
          <h1 className="text-4xl font-bold tracking-[-0.045em] text-[#243838] sm:text-5xl">
            {isCreating ? "Add project" : "Edit project"}
          </h1>
          <p className="mt-2 text-sm font-medium text-[#5C7372]">
            Structure your project overview, narrative, assets, and metadata.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-[#F3C7C7] bg-[#FFF6F6] p-4 text-sm font-medium text-[#B93838]">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Components */}
        <ProjectForm
          ref={mediaRef}
          portfolioId={portfolio.id}
          projectId={projectId}
          formData={formData}
          errors={fieldErrors}
          onChange={handleFormChange}
        />
      </main>

      {/* Delete Confirmation Modal */}
      <DeleteProjectDialog
        isOpen={showDeleteModal}
        projectTitle={formData.title}
        isDeleting={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
};
