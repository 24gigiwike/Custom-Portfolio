import type { MouseEvent } from "react";
import { creativeProjectImage } from "../assets/defaultImages.ts";
import type { CreativeProject } from "../presentation/creativeView.ts";
import { creativeHomePath, creativeNavigate, creativeProjectPath } from "../template/creativePaths.ts";

export function ProjectStory({
  project,
  projects,
}: {
  project: CreativeProject | null;
  projects: CreativeProject[];
}) {
  const home = creativeHomePath();
  if (!project) {
    return (
      <article className="creative-story">
        <a className="creative-back" href={home} onClick={(event) => follow(event, home)}>Index</a>
        <h1>This project is not in the portfolio.</h1>
      </article>
    );
  }
  const index = projects.findIndex((item) => item.id === project.id);
  const next = projects.length > 1 ? projects[(index + 1) % projects.length] : null;
  const nextPath = next ? creativeProjectPath(next.id) : "";
  const meta = [
    project.category ? { label: "Discipline", value: project.category } : null,
    project.client ? { label: "Client", value: project.client } : null,
    project.year ? { label: "Year", value: project.year } : null,
    project.tech.length > 0 ? { label: "Tools", value: project.tech.join(", ") } : null,
  ].filter((item): item is { label: string; value: string } => item !== null);

  return (
    <article className="creative-story">
      <a className="creative-back" href={home} onClick={(event) => follow(event, home)}>Index</a>
      <h1>{project.title || project.category || "Untitled"}</h1>
      {meta.length > 0 ? (
        <dl className="creative-meta-row">
          {meta.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <figure className="creative-story-hero">
        <img src={creativeProjectImage(project.image, Math.max(index, 0))} alt={project.title || "Project"} />
      </figure>
      {project.summary ? <p className="creative-story-copy">{project.summary}</p> : null}
      {project.externalHref ? (
        <a className="creative-circle creative-circle-live" href={project.externalHref} target="_blank" rel="noreferrer">
          Visit
        </a>
      ) : null}
      {next && nextPath ? (
        <a className="creative-next" href={nextPath} onClick={(event) => follow(event, nextPath)}>
          <span>Next</span>
          <strong>{next.title || next.category || "Untitled"}</strong>
        </a>
      ) : null}
    </article>
  );
}

function follow(event: MouseEvent<HTMLAnchorElement>, path: string) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  creativeNavigate(path);
}
