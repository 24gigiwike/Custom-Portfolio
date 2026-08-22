import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  ArrowLeft,
  Briefcase,
  Layers,
  Sparkles,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { ProjectCard } from "./ProjectCard";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { Button } from "../../ui/Button";
import type { Project } from "../../../types/project";
import type { Portfolio } from "../../../types/portfolio";
import {
  getPortfolioProjects,
  deleteProject,
  reorderProjects,
  setFeaturedProject,
} from "../../../lib/projects";

interface ProjectListProps {
  portfolio: Portfolio;
  onBackToWorkspace: () => void;
  onAddProject: () => void;
  onEditProject: (project: Project) => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({
  portfolio,
  onBackToWorkspace,
  onAddProject,
  onEditProject,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete modal state
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch projects
  const loadProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getPortfolioProjects(portfolio.id);
      setProjects(data);
    } catch (err) {
      console.error("Failed to load projects:", err);
      setError("We couldn't load your projects right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [portfolio.id]);

  // Handle reorder move
  const handleMove = async (currentIndex: number, targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= projects.length) return;
    const reordered = [...projects];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    // Update local state immediately for instant feedback
    setProjects(reordered);

    // Persist new ordering to Firestore
    try {
      await reorderProjects(
        portfolio.id,
        reordered.map((p) => p.id)
      );
    } catch (err) {
      console.error("Failed to persist project order:", err);
      setError("Unable to save project order. Refreshing list...");
      loadProjects();
    }
  };

  // Handle toggle featured
  const handleToggleFeatured = async (project: Project) => {
    const nextFeaturedId = project.featured ? null : project.id;

    // Optimistic local update
    setProjects((prev) =>
      prev.map((p) => ({
        ...p,
        featured: p.id === nextFeaturedId,
      }))
    );

    try {
      await setFeaturedProject(portfolio.id, nextFeaturedId);
    } catch (err) {
      console.error("Failed to update featured project:", err);
      setError("Failed to update featured project. Refreshing...");
      loadProjects();
    }
  };

  // Handle delete confirmation
  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      await deleteProject(portfolio.id, projectToDelete.id);
      setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id));
      setProjectToDelete(null);
    } catch (err) {
      console.error("Failed to delete project:", err);
      setError("We couldn't delete this project. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const featuredCount = projects.filter((p) => p.featured).length;

  return (
    <div
      id="projects-management-view"
      className="min-h-screen bg-[#FBFBFB] text-[#1A1A1B] flex flex-col font-sans selection:bg-[#6DAEAD]/20"
    >
      {/* Foundation Line Accent */}
      <div className="h-1 w-full bg-[#6DAEAD]" />

      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-[#FBFBFB]/95 backdrop-blur-md border-b border-[#E5E5E1] px-4 sm:px-8 py-3.5 flex items-center justify-between transition-all">
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="back-to-workspace-btn"
            onClick={onBackToWorkspace}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#708595] hover:text-[#1A1A1B] px-2.5 py-1.5 rounded-[2px] border border-transparent hover:border-[#E5E5E1] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Workspace</span>
          </button>

          <span className="text-[#E5E5E1] text-xs">/</span>

          <div className="flex items-center gap-2">
            <span className="font-support text-[11px] uppercase tracking-[0.14em] text-[#708595] font-medium">
              Work
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            id="add-project-header-button"
            variant="primary"
            size="sm"
            onClick={onAddProject}
            className="inline-flex items-center gap-1.5 text-xs bg-[#1A1A1B] text-white hover:bg-[#6DAEAD] transition-colors rounded-[2px]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add project</span>
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Editorial Sub-Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#E5E5E1]/70">
          <div>
            <span className="font-support text-[11px] uppercase tracking-[0.18em] text-[#708595] block mb-1.5">
              Portfolio Content
            </span>
            <h1 className="text-2xl sm:text-3xl font-normal text-[#1A1A1B] tracking-[-0.03em] font-serif">
              Work & Projects
            </h1>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#849693]">
            <span className="font-mono">
              {projects.length} {projects.length === 1 ? "project" : "projects"}
            </span>
            {featuredCount > 0 && (
              <>
                <span>•</span>
                <span className="text-[#689AA1] font-medium">1 featured</span>
              </>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-[#FEF2F2] border border-[#FEE2E2] rounded-[2px] text-xs text-[#B91C1C] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#6DAEAD] mb-3" />
            <p className="text-xs text-[#708595] font-light">Loading your work...</p>
          </div>
        ) : projects.length === 0 ? (
          /* Empty State */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="py-16 sm:py-24 px-6 bg-white border border-[#E5E5E1] rounded-[2px] text-center max-w-xl mx-auto shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-[#F8F8F7] border border-[#E5E5E1] flex items-center justify-center text-[#708595] mb-5">
              <Briefcase className="w-5 h-5" />
            </div>

            <h2 className="text-xl sm:text-2xl font-normal text-[#1A1A1B] tracking-[-0.02em] font-serif mb-2">
              Show your work.
            </h2>

            <p className="text-sm text-[#708595] font-light leading-relaxed max-w-sm mx-auto mb-8">
              Add the projects, experiences and work you're proud of.
            </p>

            <Button
              id="empty-state-add-project-btn"
              variant="primary"
              size="md"
              onClick={onAddProject}
              className="inline-flex items-center gap-2 bg-[#1A1A1B] text-white hover:bg-[#6DAEAD] transition-colors rounded-[2px]"
            >
              <Plus className="w-4 h-4" />
              <span>Add project</span>
            </Button>
          </motion.div>
        ) : (
          /* Project List */
          <div className="space-y-3">
            {projects.map((proj, idx) => (
              <ProjectCard
                key={proj.id}
                project={proj}
                index={idx}
                totalProjects={projects.length}
                onEdit={onEditProject}
                onDelete={setProjectToDelete}
                onMoveUp={(i) => handleMove(i, i - 1)}
                onMoveDown={(i) => handleMove(i, i + 1)}
                onToggleFeatured={handleToggleFeatured}
              />
            ))}

            {/* Bottom Add Project Row */}
            <div className="pt-6 flex justify-center">
              <button
                type="button"
                id="bottom-add-project-btn"
                onClick={onAddProject}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-[#708595] hover:text-[#1A1A1B] bg-white border border-dashed border-[#E5E5E1] hover:border-[#6DAEAD] rounded-[2px] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add another project</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      <DeleteProjectDialog
        isOpen={Boolean(projectToDelete)}
        projectTitle={projectToDelete?.title || ""}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setProjectToDelete(null)}
      />
    </div>
  );
};
