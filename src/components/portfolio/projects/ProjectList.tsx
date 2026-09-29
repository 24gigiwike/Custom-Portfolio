import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Plus,
  ArrowLeft,
  Briefcase,
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
    <div id="projects-management-view" className="text-[#243838]">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button
            type="button"
            id="back-to-workspace-btn"
            onClick={onBackToWorkspace}
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-[#3E7574] hover:text-[#243838]"
          >
            <ArrowLeft className="h-4 w-4" />
            Overview
          </button>
          <h1 className="text-4xl font-bold tracking-[-0.045em] sm:text-5xl">Work</h1>
        </div>
        <div className="flex items-center gap-3 text-sm font-semibold text-[#5C7372]">
          <span>
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </span>
          {featuredCount > 0 && <span className="text-[#3E7574]">1 featured</span>}
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-[#F3C7C7] bg-[#FFF6F6] p-4 text-sm font-medium text-[#B93838]">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Loader2 className="mb-3 h-6 w-6 animate-spin text-[#6DAEAD]" />
          <p className="text-sm font-semibold text-[#5C7372]">Loading your work...</p>
        </div>
      ) : projects.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-[28px] bg-[#6DAEAD] px-6 py-16 text-center text-white sm:py-20"
        >
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <Briefcase className="h-5 w-5" />
          </div>
          <h2 className="text-3xl font-bold tracking-[-0.04em]">Show your work.</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm font-medium leading-relaxed text-white/85">
            Add the projects, experiences and work you're proud of.
          </p>
          <Button
            id="empty-state-add-project-btn"
            variant="secondary"
            size="md"
            onClick={onAddProject}
            className="mt-8 bg-white text-[#2F6463] hover:bg-[#F4FBFA]"
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Add project
          </Button>
        </motion.div>
      ) : (
        <div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          </div>
          <div className="flex justify-center pt-6">
            <button
              type="button"
              id="bottom-add-project-btn"
              onClick={onAddProject}
              className="inline-flex items-center gap-2 rounded-xl border border-dashed border-[#B7D4D2] bg-white px-5 py-3 text-sm font-bold text-[#3E7574] hover:border-[#6DAEAD]"
            >
              <Plus className="h-4 w-4" />
              Add another project
            </button>
          </div>
        </div>
      )}

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
