import type { PortfolioDiscoverability } from "../../../types/discoverability";

/**
 * Optional public facts. The section is absent until the owner supplies a region or a complete question.
 */
export function ProfessionalFacts({ facts }: { facts?: PortfolioDiscoverability }) {
  const region = facts?.serviceRegion.trim() ?? "";
  const faqs = facts?.faqs.filter((faq) => faq.question.trim() && faq.answer.trim()) ?? [];
  if (!region && faqs.length === 0) return null;
  const title = faqs.length > 0 ? "Questions" : "Service area";

  return (
    <section className="portfolio-facts" aria-labelledby="portfolio-facts-title">
      <h2 id="portfolio-facts-title">{title}</h2>
      {region ? <p className="portfolio-facts-region">{region}</p> : null}
      {faqs.length > 0 ? (
        <div>
          {faqs.map((faq) => (
            <article key={faq.question}>
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
