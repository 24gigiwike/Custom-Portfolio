import { commaSeparated } from '../presentation/commaList.ts'
import type { Project } from '../types/portfolio.ts'

export function ProjectCard({ project }: { project: Project }) {
    const tech = commaSeparated(project.tech)
    const title = project.title.trim()
    const category = project.category.trim()
    const showMeta = Boolean(title || category || tech)
    return (
        <section className="project-card">
            <div className="project-window">
                <div className="window-preview">
                    <iframe src={project.url} loading="lazy" />
                </div>
                <div className="window-footer">
                    {showMeta ? (
                    <div className="project-meta">
                        <span className="project-number">{project.id}</span>
                        {title ? <h2>{project.title}</h2> : null}
                        {category ? <p>{project.category}</p> : null}
                        {tech ? <p className="project-tech">{tech}</p> : null}
                    </div>
                    ) : null}
                    <a href={project.url} target="_blank" className="project-link">
                        Explore Website
                        <span>↗</span>
                    </a>
                </div>
            </div>
        </section>
    )
}
