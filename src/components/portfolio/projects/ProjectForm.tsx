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
    <div className="mx-auto grid max-w-5xl gap-6 pb-16 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-7">
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
      </div>

      <div className="space-y-6 lg:col-span-5 lg:sticky lg:top-24 lg:self-start">
      <ProjectMedia
        portfolioId={portfolioId}
        projectId={projectId}
        coverImage={formData.coverImage}
        images={formData.images}
        onCoverImageChange={(coverImage) => onChange({ coverImage })}
        onImagesChange={(images) => onChange({ images })}
      />
      </div>

      <div className="space-y-6 lg:col-span-12">
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
    </div>
  );
};
