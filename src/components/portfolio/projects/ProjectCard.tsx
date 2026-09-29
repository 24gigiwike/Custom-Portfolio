import React from "react";
import {
  Image as ImageIcon,
  Star,
  ArrowUp,
  ArrowDown,
  Edit3,
  Trash2,
  ExternalLink,
  Calendar,
  UserCheck,
} from "lucide-react";
import type { Project } from "../../../types/project";

interface ProjectCardProps {
  project: Project;
  index: number;
  totalProjects: number;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onToggleFeatured: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  index,
  totalProjects,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onToggleFeatured,
}) => {
  return (
    <article
      id={`project-card-${project.id}`}
      className="group flex flex-col overflow-hidden rounded-[28px] border border-[#D5E6E5] bg-white shadow-[0_10px_30px_rgba(109,174,173,0.06)]"
    >
      <button
        type="button"
        onClick={() => onEdit(project)}
        className="relative block aspect-[16/10] w-full overflow-hidden bg-[#E7F4F3] text-left"
      >
        {project.coverImage ? (
          <img
            src={project.coverImage}
            alt={project.title}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-[#6E8887]">
            <ImageIcon className="mb-2 h-6 w-6" />
            <span className="text-[11px] font-bold uppercase tracking-[0.14em]">No image</span>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-lg bg-white/85 px-2 py-1 text-[11px] font-bold text-[#3E7574] backdrop-blur-sm">
          0{index + 1}
        </span>
        {project.featured && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-lg bg-[#6DAEAD] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white">
            <Star className="h-3 w-3 fill-current" />
            Featured
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col p-5">
        <h3
          onClick={() => onEdit(project)}
          className="cursor-pointer text-xl font-bold tracking-[-0.03em] text-[#243838] hover:text-[#3E7574]"
        >
          {project.title}
        </h3>
        <p className="mt-2 line-clamp-3 text-sm font-medium leading-relaxed text-[#5C7372]">
          {project.shortDescription || "No short description provided."}
        </p>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-[#6E8887]">
          {project.role && (
            <span className="inline-flex items-center gap-1">
              <UserCheck className="h-3.5 w-3.5 text-[#6DAEAD]" />
              {project.role}
            </span>
          )}
          {project.client && <span>Client: {project.client}</span>}
          {project.year && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-[#6DAEAD]" />
              {project.year}
            </span>
          )}
          {project.projectUrl && (
            <a
              href={project.projectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#3E7574] hover:underline"
            >
              Live site
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-[#E7F4F3] pt-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Move project up in list"
              disabled={index === 0}
              onClick={() => onMoveUp(index)}
              className="rounded-lg p-2 text-[#5C7372] hover:bg-[#E7F4F3] disabled:pointer-events-none disabled:opacity-30"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Move project down in list"
              disabled={index === totalProjects - 1}
              onClick={() => onMoveDown(index)}
              className="rounded-lg p-2 text-[#5C7372] hover:bg-[#E7F4F3] disabled:pointer-events-none disabled:opacity-30"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={project.featured ? "Unset featured project" : "Mark as featured project"}
              title={project.featured ? "Unset featured" : "Mark as featured"}
              onClick={() => onToggleFeatured(project)}
              className={`rounded-lg p-2 ${
                project.featured
                  ? "bg-[#E7F4F3] text-[#3E7574]"
                  : "text-[#6E8887] hover:bg-[#F4FBFA]"
              }`}
            >
              <Star className={`h-4 w-4 ${project.featured ? "fill-current" : ""}`} />
            </button>
            <button
              type="button"
              aria-label="Edit project"
              onClick={() => onEdit(project)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#E7F4F3] px-3 py-2 text-xs font-bold text-[#2F6463]"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              aria-label="Delete project"
              onClick={() => onDelete(project)}
              className="rounded-lg p-2 text-[#6E8887] hover:bg-[#FFF6F6] hover:text-[#B93838]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
