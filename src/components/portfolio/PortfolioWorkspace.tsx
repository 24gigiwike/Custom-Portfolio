import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { isProfileComplete } from "../../lib/portfolio";
import { getPortfolioProjects } from "../../lib/projects";
import { Button } from "../ui/Button";
import {
  User as UserIcon,
  MapPin,
  Briefcase,
  ArrowRight,
  CheckCircle2,
  Clock,
  Edit3,
  Plus,
  Star,
} from "lucide-react";
import type { Portfolio } from "../../types/portfolio";
import type { Project } from "../../types/project";

interface PortfolioWorkspaceProps {
  portfolio: Portfolio;
  onOpenProfileEditor: () => void;
  onOpenProjects: () => void;
  onAddProject: () => void;
}

interface StageStep {
  id: string;
  name: string;
  desc: string;
  status: "active" | "upcoming";
}

const PORTFOLIO_STAGES: StageStep[] = [
  {
    id: "profile",
    name: "Profile",
    desc: "Identity, narrative, channels and presence",
    status: "active",
  },
  {
    id: "work",
    name: "Work",
    desc: "Curated case studies and featured projects",
    status: "active",
  },
  {
    id: "experience",
    name: "Experience",
    desc: "Career chronology and leadership milestones",
    status: "upcoming",
  },
  {
    id: "details",
    name: "Details",
    desc: "Capabilities, disciplines and testimonials",
    status: "upcoming",
  },
  {
    id: "publish",
    name: "Publish",
    desc: "Final review and public distribution",
    status: "upcoming",
  },
];

export const PortfolioWorkspace: React.FC<PortfolioWorkspaceProps> = ({
  portfolio,
  onOpenProfileEditor,
  onOpenProjects,
  onAddProject,
}) => {
  const profileComplete = isProfileComplete(portfolio);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadStats() {
      try {
        const data = await getPortfolioProjects(portfolio.id);
        if (isMounted) {
          setProjects(data);
        }
      } catch {
        // silent fallback
      } finally {
        if (isMounted) {
          setLoadingProjects(false);
        }
      }
    }
    loadStats();
    return () => {
      isMounted = false;
    };
  }, [portfolio.id]);

  const hasProjects = projects.length > 0;
  const featuredProject = projects.find((p) => p.featured) || projects[0];
  const readyStagesCount = (profileComplete ? 1 : 0) + (hasProjects ? 1 : 0);

  return (
    <div id="portfolio-workspace-screen" className="text-[#243838]">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-1 gap-4 lg:grid-cols-12"
      >
        <section className="flex flex-col justify-between rounded-[28px] bg-[#6DAEAD] p-6 text-white sm:p-8 lg:col-span-7">
          <div className="flex items-start justify-between gap-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/75">
              {portfolio.published ? "Live presence" : "Draft presence"}
            </p>
            <span className="rounded-lg bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em]">
              {portfolio.stylePreset}
            </span>
          </div>

          <div className="flex items-end gap-5 py-8">
            {portfolio.profileImage ? (
              <img
                src={portfolio.profileImage}
                alt={portfolio.title}
                referrerPolicy="no-referrer"
                className="h-20 w-20 rounded-2xl object-cover ring-2 ring-white/40 sm:h-24 sm:w-24"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 sm:h-24 sm:w-24">
                <UserIcon className="h-8 w-8" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-[-0.045em] sm:text-5xl">
                {portfolio.title}
              </h1>
              <p className="mt-2 text-base font-medium text-white/85 sm:text-lg">
                {portfolio.headline}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap gap-3 text-sm font-semibold text-white/90">
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="h-4 w-4" />
                {portfolio.profession}
              </span>
              {portfolio.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {portfolio.location}
                </span>
              )}
            </div>
            <Button
              id="continue-building-button"
              variant="secondary"
              size="lg"
              onClick={hasProjects ? onOpenProjects : onAddProject}
              rightIcon={<ArrowRight className="ml-1 h-4 w-4" />}
              className="bg-white text-[#2F6463] hover:bg-[#F4FBFA]"
            >
              {hasProjects ? "Manage projects" : "Add first project"}
            </Button>
          </div>
        </section>

        <section className="grid gap-4 lg:col-span-5">
          <button
            type="button"
            onClick={onOpenProfileEditor}
            className="rounded-[28px] border border-[#D5E6E5] bg-white p-6 text-left transition-shadow hover:shadow-[0_12px_32px_rgba(109,174,173,0.12)]"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3E7574]">
                Profile
              </p>
              <Edit3 className="h-4 w-4 text-[#6DAEAD]" />
            </div>
            <p className="mt-4 text-2xl font-bold tracking-[-0.04em]">
              {profileComplete ? "Ready to read" : "Needs a pass"}
            </p>
            <p className="mt-2 line-clamp-3 text-sm font-medium leading-relaxed text-[#5C7372]">
              {portfolio.bio}
            </p>
            <div className="mt-5 flex items-center justify-between text-xs font-semibold text-[#5C7372]">
              <span>{portfolio.availability || "Available for work"}</span>
              <span>{portfolio.email}</span>
            </div>
          </button>

          <div className="rounded-[28px] bg-[#E7F4F3] p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3E7574]">
              Style direction
            </p>
            <p className="mt-3 text-3xl font-bold tracking-[-0.04em] text-[#243838]">
              {portfolio.stylePreset}
            </p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-[#5C7372]">
              Light presentation with the Custom Portfolio teal. This direction was chosen when the portfolio was created.
            </p>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[#3E7574]">
              {portfolio.published ? "Published" : "Still a draft"}
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-[#D5E6E5] bg-white lg:col-span-8">
          <div className="flex items-center justify-between px-6 pt-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3E7574]">
                Work
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-[-0.04em]">
                {hasProjects
                  ? `${projects.length} ${projects.length === 1 ? "project" : "projects"}`
                  : "Show your work."}
              </h2>
            </div>
            <button
              type="button"
              onClick={onOpenProjects}
              className="text-sm font-bold text-[#3E7574] hover:text-[#243838]"
            >
              Open collection
            </button>
          </div>

          {featuredProject && featuredProject.coverImage ? (
            <button
              type="button"
              onClick={onOpenProjects}
              className="mt-5 block w-full text-left"
            >
              <img
                src={featuredProject.coverImage}
                alt={featuredProject.title}
                referrerPolicy="no-referrer"
                className="h-56 w-full object-cover sm:h-72"
              />
              <div className="flex items-center justify-between px-6 py-5">
                <div>
                  <p className="text-lg font-bold tracking-[-0.03em]">{featuredProject.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm font-medium text-[#5C7372]">
                    {featuredProject.shortDescription}
                  </p>
                </div>
                {featuredProject.featured && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-[#E7F4F3] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#3E7574]">
                    <Star className="h-3 w-3 fill-current" />
                    Featured
                  </span>
                )}
              </div>
            </button>
          ) : (
            <div className="px-6 py-8">
              <p className="max-w-md text-sm font-medium leading-relaxed text-[#5C7372]">
                {hasProjects
                  ? featuredProject
                    ? featuredProject.title
                    : "Projects are saved in collection order."
                  : "Add the projects, experiences and work you're proud of."}
              </p>
              <button
                type="button"
                onClick={onAddProject}
                className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#3E7574]"
              >
                <Plus className="h-4 w-4" />
                Add project
              </button>
            </div>
          )}
        </section>

        <section className="rounded-[28px] border border-[#D5E6E5] bg-white p-6 lg:col-span-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3E7574]">
              Portfolio path
            </p>
            <span className="text-xs font-bold text-[#6E8887]">
              {loadingProjects ? "…" : `${readyStagesCount} of 5`}
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {PORTFOLIO_STAGES.map((stage, idx) => {
              const isActive = stage.status === "active";
              const isProfileStage = stage.id === "profile";
              const isWorkStage = stage.id === "work";
              const handleClick = () => {
                if (isProfileStage) onOpenProfileEditor();
                if (isWorkStage) onOpenProjects();
              };
              return (
                <div
                  key={stage.id}
                  id={`stage-card-${stage.id}`}
                  onClick={isActive ? handleClick : undefined}
                  role={isActive ? "button" : undefined}
                  tabIndex={isActive ? 0 : undefined}
                  onKeyDown={
                    isActive
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleClick();
                          }
                        }
                      : undefined
                  }
                  className={`rounded-2xl px-3 py-3 ${
                    isActive
                      ? "cursor-pointer bg-[#F4FBFA] hover:bg-[#E7F4F3]"
                      : "opacity-70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[#243838]">
                        0{idx + 1} {stage.name}
                      </p>
                      <p className="text-xs font-medium text-[#5C7372]">{stage.desc}</p>
                    </div>
                    {isProfileStage &&
                      (profileComplete ? (
                        <CheckCircle2 className="h-4 w-4 text-[#2F7D62]" />
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5C7372]">
                          Open
                        </span>
                      ))}
                    {isWorkStage && (
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#3E7574]">
                        {hasProjects ? projects.length : 0}
                      </span>
                    )}
                    {!isProfileStage && !isWorkStage && (
                      <Clock className="h-4 w-4 text-[#8AADAC]" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </motion.div>
    </div>
  );
};
