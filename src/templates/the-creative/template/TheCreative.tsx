import { useEffect, useState } from "react";
import type { PortfolioData } from "../../wdk-premium-portfolio-1/types/portfolio.ts";
import { ContactClose } from "../components/ContactClose.tsx";
import { HeroIntro, Statement } from "../components/HeroIntro.tsx";
import { MenuOverlay } from "../components/MenuOverlay.tsx";
import { ProjectStory } from "../components/ProjectStory.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { WorkGallery } from "../components/WorkGallery.tsx";
import { templateConfig } from "../data/template-config.ts";
import { creativeAboutVisible, creativeContactVisible, creativeView, type CreativeLink } from "../presentation/creativeView.ts";
import { creativeHomePath, creativeProjectId } from "./creativePaths.ts";
import { useCreativeSeo } from "./useCreativeSeo.ts";
import "../styles/the-creative.css";

export interface TheCreativeProps {
  data: PortfolioData;
  robots?: string;
}

function useProjectId() {
  const read = () => creativeProjectId(window.location.pathname);
  const [projectId, setProjectId] = useState(read);
  useEffect(() => {
    const sync = () => setProjectId(read());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  return projectId;
}

export function TheCreative({ data, robots = "noindex, nofollow" }: TheCreativeProps) {
  useCreativeSeo(data.seo, robots);
  const view = creativeView(data);
  const projectId = useProjectId();
  const [menuOpen, setMenuOpen] = useState(false);
  const project = projectId ? view.projects.find((item) => item.id === projectId) ?? null : null;
  const home = creativeHomePath();
  const links: CreativeLink[] = [{ href: home, label: "Home", external: false }];
  if (view.projects.length > 0) links.push({ href: "#work", label: "Work", external: false });
  if (creativeAboutVisible(view)) links.push({ href: "#about", label: "About", external: false });
  if (creativeContactVisible(view)) links.push({ href: "#contact", label: "Contact", external: false });
  const showBar = Boolean(view.name || links.length > 1);

  useEffect(() => {
    if (projectId) return;
    const hash = window.location.hash;
    if (!hash) return;
    document.querySelector(hash)?.scrollIntoView();
  }, [projectId]);

  return (
    <div data-template={templateConfig.id} className={menuOpen ? "creative-menu-open" : undefined}>
      {showBar ? <TopBar name={view.name} menuOpen={menuOpen} onMenu={() => setMenuOpen((open) => !open)} /> : null}
      {showBar && menuOpen ? (
        <MenuOverlay
          links={links}
          socials={view.socials}
          onClose={() => setMenuOpen(false)}
        />
      ) : null}
      <main>
        {projectId ? (
          <ProjectStory project={project} projects={view.projects} />
        ) : (
          <>
            <HeroIntro name={view.name} role={view.role} portrait={view.portrait} />
            <Statement statement={view.statement} support={view.support} tags={view.tags} cta={view.cta} />
            <WorkGallery projects={view.projects} />
            <ContactClose view={view} />
          </>
        )}
      </main>
    </div>
  );
}
