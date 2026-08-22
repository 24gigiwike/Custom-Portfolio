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
    <div
      id={`project-card-${project.id}`}
      className="group bg-white border border-[#E5E5E1] hover:border-[#6DAEAD]/50 rounded-[2px] p-4 sm:p-5 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col md:flex-row items-start md:items-center gap-4 sm:gap-6"
    >
      {/* Left: Reorder Indices & Move Buttons */}
      <div className="flex md:flex-col items-center justify-between md:justify-center gap-1.5 w-full md:w-auto text-[#708595] pb-2 md:pb-0 border-b md:border-b-0 md:border-r border-[#E5E5E1]/60 md:pr-4">
        <span className="font-mono text-xs text-[#849693] font-medium tracking-wider">
          0{index + 1}
        </span>
        <div className="flex md:flex-col items-center gap-1">
          <button
            type="button"
            aria-label="Move project up in list"
            disabled={index === 0}
            onClick={() => onMoveUp(index)}
            className="p-1 text-[#849693] hover:text-[#1A1A1B] hover:bg-[#F8F8F7] rounded-[2px] disabled:opacity-20 disabled:pointer-events-none transition-colors"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Move project down in list"
            disabled={index === totalProjects - 1}
            onClick={() => onMoveDown(index)}
            className="p-1 text-[#849693] hover:text-[#1A1A1B] hover:bg-[#F8F8F7] rounded-[2px] disabled:opacity-20 disabled:pointer-events-none transition-colors"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Thumbnail */}
      <div className="w-24 sm:w-28 h-20 sm:h-20 flex-shrink-0 bg-[#F8F8F7] border border-[#E5E5E1] rounded-[2px] overflow-hidden flex items-center justify-center">
        {project.coverImage ? (
          <img
            src={project.coverImage}
            alt={project.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-2 text-center text-[#849693]/70">
            <ImageIcon className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] font-support uppercase tracking-wider">No image</span>
          </div>
        )}
      </div>

      {/* Main Content Info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h3
            onClick={() => onEdit(project)}
            className="text-base font-medium text-[#1A1A1B] hover:text-[#6DAEAD] cursor-pointer transition-colors truncate tracking-[-0.01em]"
          >
            {project.title}
          </h3>

          {project.featured && (
            <span className="inline-flex items-center gap-1 font-support text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 bg-[#6DAEAD]/15 text-[#689AA1] border border-[#6DAEAD]/30 rounded-[2px] font-medium">
              <Star className="w-2.5 h-2.5 fill-current text-[#689AA1]" />
              Featured
            </span>
          )}
        </div>

        <p className="text-xs text-[#708595] font-light line-clamp-2 leading-relaxed mb-2.5">
          {project.shortDescription || "No short description provided."}
        </p>

        {/* Metadata Line */}
        <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-[11px] text-[#849693]">
          {project.role && (
            <span className="inline-flex items-center gap-1">
              <UserCheck className="w-3 h-3 text-[#708595]" />
              <span>{project.role}</span>
            </span>
          )}

          {project.client && (
            <span className="inline-flex items-center gap-1 font-light">
              <span className="text-[#708595] font-medium">Client:</span> {project.client}
            </span>
          )}

          {project.year && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[#708595]" />
              <span className="font-mono">{project.year}</span>
            </span>
          )}

          {project.projectUrl && (
            <a
              href={project.projectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#6DAEAD] hover:underline"
            >
              <span>Live Site</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-[#E5E5E1]/60">
        <button
          type="button"
          aria-label={project.featured ? "Unset featured project" : "Mark as featured project"}
          title={project.featured ? "Unset featured" : "Mark as featured"}
          onClick={() => onToggleFeatured(project)}
          className={`p-2 rounded-[2px] border transition-colors ${
            project.featured
              ? "bg-[#6DAEAD]/10 text-[#689AA1] border-[#6DAEAD]/30"
              : "bg-white text-[#849693] border-[#E5E5E1] hover:text-[#689AA1] hover:border-[#6DAEAD]"
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${project.featured ? "fill-current" : ""}`} />
        </button>

        <button
          type="button"
          aria-label="Edit project"
          onClick={() => onEdit(project)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1A1A1B] bg-[#F8F8F7] hover:bg-[#E5E5E1] border border-[#E5E5E1] rounded-[2px] transition-colors"
        >
          <Edit3 className="w-3 h-3 text-[#708595]" />
          <span>Edit</span>
        </button>

        <button
          type="button"
          aria-label="Delete project"
          onClick={() => onDelete(project)}
          className="p-2 text-[#849693] hover:text-[#B91C1C] hover:bg-[#FEF2F2] border border-transparent hover:border-[#FEE2E2] rounded-[2px] transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
