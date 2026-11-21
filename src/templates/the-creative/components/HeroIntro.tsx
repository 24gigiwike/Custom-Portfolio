import { CREATIVE_PORTRAIT } from "../assets/defaultImages.ts";
import type { CreativeLink } from "../presentation/creativeView.ts";

export function HeroIntro({
  name,
  role,
  portrait,
}: {
  name: string;
  role: string;
  portrait: string;
}) {
  if (!name && !role && !portrait) return null;
  const source = portrait || (name || role ? CREATIVE_PORTRAIT : "");
  return (
    <section className="creative-hero" id="top">
      {source ? <img src={source} alt={name ? `${name} portrait` : ""} /> : null}
      {role ? <p className="creative-role">{role}</p> : null}
      {name ? <h1 className="creative-name">{name}</h1> : null}
    </section>
  );
}

export function Statement({
  statement,
  support,
  tags,
  cta,
}: {
  statement: string;
  support: string;
  tags: string[];
  cta: CreativeLink | null;
}) {
  if (!statement && !support && tags.length === 0 && !cta) return null;
  return (
    <section className="creative-statement" id="about">
      <div>
        {statement ? <h2>{statement}</h2> : null}
        {tags.length > 0 ? (
          <p className="creative-tags">
            {tags.map((tag, index) => (
              <span key={tag}>
                {index > 0 ? <span className="creative-slash"> / </span> : null}
                {tag}
              </span>
            ))}
          </p>
        ) : null}
      </div>
      <div className="creative-statement-side">
        {support ? <p>{support}</p> : null}
        {cta ? (
          <a className="creative-circle" href={cta.href} {...(cta.external ? { target: "_blank", rel: "noreferrer" } : {})}>
            {cta.label}
          </a>
        ) : null}
      </div>
    </section>
  );
}
