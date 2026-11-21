import type { CreativeLink, CreativeView } from "../presentation/creativeView.ts";
import { creativeContactVisible } from "../presentation/creativeView.ts";

export function ContactClose({ view }: { view: CreativeView }) {
  if (!creativeContactVisible(view)) return null;
  const heading = view.contactHeading || "Let’s work together";
  const mail = view.contactEmail
    ? view.contactEmail.startsWith("mailto:") ? view.contactEmail : `mailto:${view.contactEmail}`
    : "";
  return (
    <footer className="creative-close" id="contact">
      <div className="creative-close-main">
        <h2>{heading}</h2>
        {mail ? <a className="creative-mail" href={mail}>{view.contactEmail.replace(/^mailto:/i, "")}</a> : null}
        {view.projectTypes.length > 0 ? (
          <ul className="creative-types">
            {view.projectTypes.map((type) => <li key={type}>{type}</li>)}
          </ul>
        ) : null}
      </div>
      {view.showForm ? <ContactForm endpoint={view.formEndpoint} types={view.projectTypes} /> : null}
      {view.socials.length > 0 ? <SocialRow socials={view.socials} /> : null}
    </footer>
  );
}

function SocialRow({ socials }: { socials: CreativeLink[] }) {
  return (
    <nav className="creative-socials" aria-label="Social links">
      {socials.map((link) => (
        <a key={`${link.label}-${link.href}`} href={link.href} {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}>
          {link.label}
        </a>
      ))}
    </nav>
  );
}

function ContactForm({ endpoint, types }: { endpoint: string; types: string[] }) {
  return (
    <form className="creative-form" action={endpoint} method="post">
      <label>
        Name
        <input name="name" autoComplete="name" />
      </label>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" />
      </label>
      {types.length > 0 ? (
        <label>
          Project
          <select name="service" defaultValue={types[0]}>
            {types.map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
      ) : null}
      <label>
        Note
        <textarea name="message" />
      </label>
      <button type="submit">Send</button>
    </form>
  );
}
