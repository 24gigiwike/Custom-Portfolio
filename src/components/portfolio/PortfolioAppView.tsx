import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "../../lib/authContext";
import { getUserPortfolio } from "../../lib/portfolio";
import { PortfolioEmptyState } from "./PortfolioEmptyState";
import { PortfolioSetup } from "./PortfolioSetup";
import { PortfolioWorkspace } from "./PortfolioWorkspace";
import { ProfileEditor } from "./ProfileEditor/ProfileEditor";
import { ProjectList } from "./projects/ProjectList";
import { ProjectEditor } from "./projects/ProjectEditor";
import { brand } from "../../config/branding";
import { WorkspaceChrome, type WorkspaceNavKey } from "../ui/WorkspaceChrome";
import { Button } from "../ui/Button";
import { Plus } from "lucide-react";
import type { Portfolio } from "../../types/portfolio";
import type { Project } from "../../types/project";

type AppSubView = "workspace" | "profile-editor" | "projects-list" | "project-editor";

export const PortfolioAppView: React.FC = () => {
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSettingUp, setIsSettingUp] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<AppSubView>("workspace");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadUserPortfolio() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const existing = await getUserPortfolio(user.uid);
        if (isMounted) {
          setPortfolio(existing);
        }
      } catch (err) {
        console.error("Failed to load portfolio:", err);
        if (isMounted) {
          setLoadError("Unable to load your portfolio. Please refresh to try again.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadUserPortfolio();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Loading Screen (Preserves Custom Portfolio visual calmness)
  if (isLoading) {
    return (
      <div
        id="portfolio-loading-screen"
        className="relative flex min-h-screen w-full flex-col items-center justify-between bg-[#F3FAF9] px-6 py-10 text-[#243838] sm:px-12 sm:py-12"
      >

        <header className="flex w-full max-w-5xl items-baseline justify-between pt-2">
          <div className="text-[20px] font-bold tracking-[-0.04em] text-[#3E7574]">
            {brand.name}
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6E8887]">
            {brand.endorsement}
          </div>
        </header>

        <div className="my-auto flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#D5E6E5] border-t-[#6DAEAD]" />
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#5C7372]">
            Loading workspace...
          </span>
        </div>

        <footer className="w-full max-w-5xl border-t border-[#D5E6E5] pt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E8887]">
          BroadBrand
        </footer>
      </div>
    );
  }

  // If user is actively in the setup flow
  if (isSettingUp) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="setup-flow"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full min-h-screen"
        >
          <PortfolioSetup
            onSuccess={(createdPortfolio) => {
              setPortfolio(createdPortfolio);
              setIsSettingUp(false);
              setCurrentView("workspace");
            }}
            onCancel={() => setIsSettingUp(false)}
          />
        </motion.div>
      </AnimatePresence>
    );
  }

  const openProjectEditor = (project: Project | null) => {
    setSelectedProject(project);
    setCurrentView("project-editor");
  };

  const navigateWorkspace = (key: WorkspaceNavKey) => {
    if (key === "overview") setCurrentView("workspace");
    if (key === "work") setCurrentView("projects-list");
    if (key === "profile") setCurrentView("profile-editor");
  };

  // If portfolio exists, render current view
  if (portfolio) {
    if (currentView === "project-editor") {
      return (
        <AnimatePresence mode="wait">
          <motion.div
            key="project-editor-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full min-h-screen"
          >
            <ProjectEditor
              portfolio={portfolio}
              projectToEdit={selectedProject}
              onBack={() => setCurrentView("projects-list")}
              onSaved={() => {
                setCurrentView("projects-list");
              }}
              onDeleted={() => {
                setCurrentView("projects-list");
              }}
            />
          </motion.div>
        </AnimatePresence>
      );
    }

    const activeNav: WorkspaceNavKey =
      currentView === "profile-editor"
        ? "profile"
        : currentView === "projects-list"
          ? "work"
          : "overview";

    return (
      <WorkspaceChrome
        active={activeNav}
        portfolioTitle={portfolio.title}
        published={portfolio.published}
        onNavigate={navigateWorkspace}
        trailing={
          currentView === "projects-list" ? (
            <Button
              id="add-project-header-button"
              variant="primary"
              size="sm"
              onClick={() => openProjectEditor(null)}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              Add project
            </Button>
          ) : undefined
        }
      >
        <AnimatePresence mode="wait">
          {currentView === "profile-editor" ? (
            <motion.div
              key="profile-editor-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <ProfileEditor
                portfolio={portfolio}
                onBackToWorkspace={() => setCurrentView("workspace")}
                onSaveSuccess={(updatedPortfolio) => {
                  setPortfolio(updatedPortfolio);
                }}
              />
            </motion.div>
          ) : currentView === "projects-list" ? (
            <motion.div
              key="projects-list-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <ProjectList
                portfolio={portfolio}
                onBackToWorkspace={() => setCurrentView("workspace")}
                onAddProject={() => openProjectEditor(null)}
                onEditProject={(project) => openProjectEditor(project)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="workspace-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <PortfolioWorkspace
                portfolio={portfolio}
                onOpenProfileEditor={() => setCurrentView("profile-editor")}
                onOpenProjects={() => setCurrentView("projects-list")}
                onAddProject={() => openProjectEditor(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </WorkspaceChrome>
    );
  }

  // If no portfolio exists, show empty state
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="empty-state-view"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full min-h-screen"
      >
        <PortfolioEmptyState onCreateClick={() => setIsSettingUp(true)} />
      </motion.div>
    </AnimatePresence>
  );
};

