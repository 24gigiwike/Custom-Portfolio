import { useLayoutEffect, useRef } from "react";
import { creativeProjectImage } from "../assets/defaultImages.ts";
import type { CreativeProject } from "../presentation/creativeView.ts";
import { creativeNavigate, creativeProjectPath } from "../template/creativePaths.ts";

const DRIVEN_QUERY = "(min-width: 801px)";
const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

export function WorkGallery({ projects }: { projects: CreativeProject[] }) {
  const pinRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const pin = pinRef.current;
    const sticky = stickyRef.current;
    const track = trackRef.current;
    if (!pin || !sticky || !track || projects.length === 0) return;

    const desktop = window.matchMedia(DRIVEN_QUERY);
    const reduce = window.matchMedia(REDUCE_QUERY);
    let frame = 0;
    let travelPx = 0;

    const render = () => {
      if (pin.dataset.driven !== "true") return;
      const view = window.innerHeight;
      const run = pin.offsetHeight - view;
      const progress = run <= 0 ? 0 : Math.min(1, Math.max(0, -pin.getBoundingClientRect().top / run));
      track.style.transform = `translate3d(${(-travelPx * progress).toFixed(2)}px, 0, 0)`;
    };

    const measure = () => {
      track.style.transform = "translate3d(0px, 0, 0)";
      const driven = desktop.matches && !reduce.matches;
      pin.dataset.driven = driven ? "true" : "false";
      const travel = Math.max(0, track.scrollWidth - track.clientWidth);
      travelPx = travel;
      if (!driven || travel <= 8) {
        pin.dataset.driven = "false";
        pin.style.height = "";
        sticky.style.height = "";
        track.style.transform = "";
        return;
      }
      const view = window.innerHeight;
      const nextPin = `${view + travel}px`;
      const nextSticky = `${view}px`;
      if (pin.style.height !== nextPin) pin.style.height = nextPin;
      if (sticky.style.height !== nextSticky) sticky.style.height = nextSticky;
      render();
    };

    const onScroll = () => {
      if (pin.dataset.driven !== "true") return;
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        render();
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", onScroll, { passive: true });
    desktop.addEventListener("change", measure);
    reduce.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", onScroll);
      desktop.removeEventListener("change", measure);
      reduce.removeEventListener("change", measure);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [projects.length]);

  if (projects.length === 0) return null;

  return (
    <section className="creative-work" id="work" aria-label="Recent work">
      <div className="creative-work-pin" ref={pinRef}>
        <div className="creative-work-sticky" ref={stickyRef}>
          <div className="creative-work-label">
            <p className="creative-kicker">Recent work</p>
            <p className="creative-count">{String(projects.length).padStart(2, "0")}</p>
          </div>
          <div className="creative-gallery" ref={trackRef}>
            {projects.map((project, index) => {
              const href = creativeProjectPath(project.id);
              const meta = [project.category, project.year].filter(Boolean).join(" — ");
              return (
                <a
                  key={project.id}
                  className="creative-shot"
                  href={href}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                    event.preventDefault();
                    creativeNavigate(href);
                  }}
                >
                  <img src={creativeProjectImage(project.image, index)} alt={project.title || project.category || "Project"} />
                  <span className="creative-shot-copy">
                    <strong>{project.title || project.category || "Untitled"}</strong>
                    {meta ? <em>{meta}</em> : null}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
