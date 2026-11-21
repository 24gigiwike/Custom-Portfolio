import type {
  PortfolioContact,
  PortfolioData,
  SocialPlatform,
} from "../../wdk-premium-portfolio-1/types/portfolio.ts";

const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  x: "X",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
  email: "Email",
};

export type CreativeLink = {
  href: string;
  label: string;
  external: boolean;
};

export type CreativeProject = {
  id: string;
  title: string;
  category: string;
  client: string;
  year: string;
  summary: string;
  tech: string[];
  image: string;
  externalHref: string;
};

export type CreativeView = {
  name: string;
  role: string;
  statement: string;
  support: string;
  tags: string[];
  portrait: string;
  cta: CreativeLink | null;
  socials: CreativeLink[];
  projects: CreativeProject[];
  contactEmail: string;
  contactHeading: string;
  showForm: boolean;
  formEndpoint: string;
  projectTypes: string[];
};

function filled(value: string | undefined): string {
  return (value ?? "").trim();
}

function httpHref(value: string): string {
  return /^https?:\/\//i.test(value) ? value : "";
}

export function creativeView(data: PortfolioData): CreativeView {
  const name = filled(data.profile.brandName);
  const headline = filled(data.profile.headline);
  const contactHeading = filled(data.contact.heading);
  const description = filled(data.contact.description);
  const statement = contactHeading || headline;
  const role = headline && headline !== statement && headline.length <= 90 ? headline : "";
  const support = description && description !== statement ? description : "";
  const portrait = filled(data.profile.heroImage) || filled(data.profile.heroImageMobile);
  const tags = data.profile.capabilityTags.map((tag) => tag.trim()).filter(Boolean);
  const ctaLabel = filled(data.profile.ctaLabel);
  const ctaHref = filled(data.profile.ctaHref);

  const projects = data.projects.flatMap((project, index): CreativeProject[] => {
    const title = filled(project.title);
    const category = filled(project.category);
    const client = filled(project.client);
    const year = filled(project.year);
    const summary = filled(project.summary);
    const image = filled(project.image);
    const tech = project.tech.map((item) => item.trim()).filter(Boolean);
    if (!title && !category && !client && !year && !summary && !image && tech.length === 0) return [];
    return [{
      id: project.id || `project-${index + 1}`,
      title,
      category,
      client,
      year,
      summary,
      tech,
      image,
      externalHref: httpHref(filled(project.url)),
    }];
  });

  const socials = data.socialLinks.flatMap((link): CreativeLink[] => {
    const href = filled(link.url);
    if (!href) return [];
    return [{
      href,
      label: SOCIAL_LABELS[link.platform] ?? link.platform,
      external: httpHref(href) !== "" || href.startsWith("mailto:"),
    }];
  });

  const contactEmail = filled(data.contact.email) || filled(data.profile.email);
  const projectTypes = data.contact.projectTypes.map((type) => type.trim()).filter(Boolean);
  const formEndpoint = httpHref(filled(data.contact.formEndpoint));

  return {
    name,
    role,
    statement,
    support,
    tags,
    portrait,
    cta: ctaLabel && ctaHref ? { href: ctaHref, label: ctaLabel, external: httpHref(ctaHref) !== "" } : null,
    socials,
    projects,
    contactEmail,
    contactHeading,
    showForm: formEndpoint !== "",
    formEndpoint,
    projectTypes,
  };
}

export function creativeContactVisible(view: CreativeView): boolean {
  return Boolean(
    view.contactEmail
    || view.contactHeading
    || view.showForm
    || view.projectTypes.length
    || view.socials.length
  );
}

export function creativeAboutVisible(view: CreativeView): boolean {
  return Boolean(view.statement || view.support || view.tags.length || view.cta);
}
