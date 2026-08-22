import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Save,
  Check,
  Loader2,
  AlertCircle,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { ProjectForm, type ProjectFormData } from "./ProjectForm";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { Button } from "../../ui/Button";
import type { Project } from "../../../types/project";
import type { Portfolio } from "../../../types/portfolio";
import {
  createProject,
  updateProject,
  deleteProject,
  generateProjectSlug,
} from "../../../lib/projects";

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

  // Initialize form state
  const [formData, setFormData] = useState<ProjectFormData>(() => {
    if (projectToEdit) {
      return {
        title: projectToEdit.title,
        slug: projectToEdit.slug,
        shortDescription: projectToEdit.shortDescription,
        description: projectToEdit.description || "",
        coverImage: projectToEdit.coverImage || null,
        images: projectToEdit.images || [],
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
      images: [],
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

      return next;
    });

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
          images: formData.images,
          role: formData.role,
          client: formData.client,
          year: formData.year,
          services: formData.services,
          tools: formData.tools,
          projectUrl: formData.projectUrl,
          caseStudyUrl: formData.caseStudyUrl,
          featured: formData.featured,
        });

        setInitialData(formData);
        setHasUnsavedChanges(false);
        setSaveStatus("saved");
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
          images: formData.images,
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
          images: formData.images,
          role: formData.role.trim(),
          client: formData.client.trim(),
          year: formData.year.trim(),
          services: formData.services,
          tools: formData.tools,
          projectUrl: formData.projectUrl.trim(),
          caseStudyUrl: formData.caseStudyUrl.trim(),
          featured: formData.featured,
        };

        setInitialData(formData);
        setHasUnsavedChanges(false);
        setSaveStatus("saved");
        setTimeout(() => {
          onSaved(updatedProject);
        }, 600);
      }
    } catch (err) {
      console.error("Save Project Error:", err);
      setSaveStatus("error");
      setErrorMessage("We couldn't save this project. Please try again.");
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
      setErrorMessage("We couldn't delete this project. Please try again.");
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
    onBack();
  };

  return (
    <div
      id="project-editor-view"
      className="min-h-screen bg-[#FBFBFB] text-[#1A1A1B] flex flex-col font-sans selection:bg-[#6DAEAD]/20"
    >
      {/* Foundation Line Accent */}
      <div className="h-1 w-full bg-[#6DAEAD]" />

      {/* Sticky Header Bar */}
      <header className="sticky top-0 z-30 bg-[#FBFBFB]/95 backdrop-blur-md border-b border-[#E5E5E1] px-4 sm:px-8 py-3.5 flex items-center justify-between transition-all">
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="editor-back-to-projects-btn"
            onClick={handleBackClick}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#708595] hover:text-[#1A1A1B] px-2.5 py-1.5 rounded-[2px] border border-transparent hover:border-[#E5E5E1] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Work</span>
          </button>

          <span className="text-[#E5E5E1] text-xs">/</span>

          <span className="text-xs font-medium text-[#1A1A1B] truncate max-w-[200px] sm:max-w-xs">
            {formData.title || (isCreating ? "New Project" : "Edit Project")}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <div className="hidden sm:flex items-center text-xs font-mono">
            {isSaving && (
              <span className="text-[#708595] flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6DAEAD]" />
                <span>Saving...</span>
              </span>
            )}
            {!isSaving && saveStatus === "saved" && (
              <span className="text-[#6DAEAD] flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Saved</span>
              </span>
            )}
            {!isSaving && saveStatus === "idle" && hasUnsavedChanges && (
              <span className="text-[#849693]">Unsaved changes</span>
            )}
            {!isSaving && saveStatus === "idle" && !hasUnsavedChanges && !isCreating && (
              <span className="text-[#849693]/70">Up to date</span>
            )}
          </div>

          {!isCreating && (
            <button
              type="button"
              id="editor-delete-project-btn"
              onClick={() => setShowDeleteModal(true)}
              className="p-2 text-[#849693] hover:text-[#B91C1C] hover:bg-[#FEF2F2] rounded-[2px] border border-transparent hover:border-[#FEE2E2] transition-colors"
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
            className="inline-flex items-center gap-1.5 text-xs bg-[#1A1A1B] text-white hover:bg-[#6DAEAD] transition-colors rounded-[2px]"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save project</span>
          </Button>
        </div>
      </header>

      {/* Main Form Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Editorial Sub-Header */}
        <div className="mb-8 pb-6 border-b border-[#E5E5E1]/70">
          <span className="font-support text-[11px] uppercase tracking-[0.18em] text-[#708595] block mb-1.5">
            {isCreating ? "New Project Entry" : "Project Editor"}
          </span>
          <h1 className="text-2xl sm:text-3xl font-normal text-[#1A1A1B] tracking-[-0.03em] font-serif">
            {isCreating ? "Add Project" : "Edit Project Details"}
          </h1>
          <p className="text-xs text-[#708595] font-light mt-1.5">
            Structure your project overview, narrative, assets, and metadata.
          </p>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-[#FEF2F2] border border-[#FEE2E2] rounded-[2px] text-xs text-[#B91C1C] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Components */}
        <ProjectForm
          portfolioId={portfolio.id}
          projectId={projectToEdit?.id || "draft"}
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
