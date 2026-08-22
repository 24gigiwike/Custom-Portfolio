import React from "react";
import { ProjectOverview } from "./ProjectOverview";
import { ProjectDetails } from "./ProjectDetails";
import { ProjectServicesTools } from "./ProjectServicesTools";
import { ProjectMedia } from "./ProjectMedia";
import { ProjectLinks } from "./ProjectLinks";
import { ProjectPresentation } from "./ProjectPresentation";
import type { CreateProjectInput, UpdateProjectInput } from "../../../types/project";

export interface ProjectFormData {
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  coverImage: string | null;
  images: string[];
  role: string;
  client: string;
  year: string;
  services: string[];
  tools: string[];
  projectUrl: string;
  caseStudyUrl: string;
  featured: boolean;
}

interface ProjectFormProps {
  portfolioId: string;
  projectId: string;
  formData: ProjectFormData;
  errors: Record<string, string>;
  onChange: (updated: Partial<ProjectFormData>) => void;
}

export const ProjectForm: React.FC<ProjectFormProps> = ({
  portfolioId,
  projectId,
  formData,
  errors,
  onChange,
}) => {
  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      {/* 01: Identity & Narrative */}
      <ProjectOverview
        title={formData.title}
        slug={formData.slug}
        shortDescription={formData.shortDescription}
        description={formData.description}
        errors={errors}
        onTitleChange={(title) => onChange({ title })}
        onSlugChange={(slug) => onChange({ slug })}
        onShortDescriptionChange={(shortDescription) => onChange({ shortDescription })}
        onDescriptionChange={(description) => onChange({ description })}
      />

      {/* 02: Details */}
      <ProjectDetails
        role={formData.role}
        client={formData.client}
        year={formData.year}
        onRoleChange={(role) => onChange({ role })}
        onClientChange={(client) => onChange({ client })}
        onYearChange={(year) => onChange({ year })}
      />

      {/* 03: Services & Tools */}
      <ProjectServicesTools
        services={formData.services}
        tools={formData.tools}
        onServicesChange={(services) => onChange({ services })}
        onToolsChange={(tools) => onChange({ tools })}
      />

      {/* 04: Media */}
      <ProjectMedia
        portfolioId={portfolioId}
        projectId={projectId}
        coverImage={formData.coverImage}
        images={formData.images}
        onCoverImageChange={(coverImage) => onChange({ coverImage })}
        onImagesChange={(images) => onChange({ images })}
      />

      {/* 05: Links */}
      <ProjectLinks
        projectUrl={formData.projectUrl}
        caseStudyUrl={formData.caseStudyUrl}
        onProjectUrlChange={(projectUrl) => onChange({ projectUrl })}
        onCaseStudyUrlChange={(caseStudyUrl) => onChange({ caseStudyUrl })}
      />

      {/* 06: Presentation */}
      <ProjectPresentation
        featured={formData.featured}
        onFeaturedChange={(featured) => onChange({ featured })}
      />
    </div>
  );
};
