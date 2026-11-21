import type { CreativeLink } from "../presentation/creativeView.ts";
import { creativeHomePath, creativeNavigate, creativeProjectId } from "../template/creativePaths.ts";

export function MenuOverlay({
  links,
  socials,
  onClose,
}: {
  links: CreativeLink[];
  socials: CreativeLink[];
  onClose: () => void;
}) {
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date());
  return (
    <div className="creative-menu" role="dialog" aria-label="Menu">
      <div className="creative-menu-col">
        <p className="creative-kicker">Navigation</p>
        <nav>
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(event) => {
                if (link.external || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
                  onClose();
                  return;
                }
                event.preventDefault();
                onClose();
                if (link.href.startsWith("#")) {
                  if (creativeProjectId(window.location.pathname)) {
                    creativeNavigate(creativeHomePath(), link.href);
                    return;
                  }
                  document.querySelector(link.href)?.scrollIntoView({ behavior: "smooth" });
                  return;
                }
                creativeNavigate(link.href);
              }}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="creative-menu-col">
        <p className="creative-kicker">Socials</p>
        {socials.length > 0 ? (
          <nav>
            {socials.map((link) => (
              <a key={`${link.label}-${link.href}`} href={link.href} {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}>
                {link.label}
              </a>
            ))}
          </nav>
        ) : null}
        <p className="creative-menu-time">{time}</p>
      </div>
    </div>
  );
}
