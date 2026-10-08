import firebaseConfig from "../../firebase-applet-config.json" with { type: "json" };
import { readPublicPortfolio } from "../lib/publicPortfolio.js";
import {
  applyHead,
  portfolioCanonicalUrl,
  renderHomeHead,
  applyPublicBody,
  renderHeadTags,
  renderPortfolioFacts,
  renderUnavailableHead,
  resolvePublicPortfolioSeo,
  type SiteEnvironment,
} from "../lib/portfolioSeo.js";
import { parsePublicSlug, resolvePublicAddress, type SlugRegistryView } from "../lib/portfolioSlug.js";
import type { PublicPortfolio } from "../types/publicPortfolio.js";

const PAGE_SIZE = 300;
const MAX_PAGES = 20;

function firestoreDocuments(): string {
  const database = encodeURIComponent(firebaseConfig.firestoreDatabaseId || "(default)");
  return `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${database}/documents`;
}

function fromFirestore(value: unknown): unknown {
  if (!value || typeof value !== "object") return null;
  const field = value as Record<string, unknown>;
  if ("stringValue" in field) return field.stringValue;
  if ("booleanValue" in field) return field.booleanValue;
  if ("integerValue" in field) return field.integerValue;
  if ("doubleValue" in field) return field.doubleValue;
  if ("timestampValue" in field) return field.timestampValue;
  if ("nullValue" in field) return null;
  if ("mapValue" in field) {
    const fields = (field.mapValue as { fields?: Record<string, unknown> }).fields ?? {};
    const record: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(fields)) record[key] = fromFirestore(child);
    return record;
  }
  if ("arrayValue" in field) {
    const values = (field.arrayValue as { values?: unknown[] }).values ?? [];
    return values.map((item) => fromFirestore(item));
  }
  return null;
}

function documentFields(body: { fields?: Record<string, unknown> }): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body.fields ?? {})) record[key] = fromFirestore(value);
  return record;
}

async function firestoreGet(path: string): Promise<Response> {
  const url = new URL(`${firestoreDocuments()}/${path}`);
  url.searchParams.set("key", firebaseConfig.apiKey);
  return fetch(url);
}

async function readAddressedPortfolio(publicId: string): Promise<PublicPortfolio | "invalid" | "error" | null> {
  const response = await firestoreGet(`publicPortfolios/${encodeURIComponent(publicId)}`);
  if (response.status === 404 || response.status === 403) return null;
  if (!response.ok) return "error";
  const body = (await response.json()) as { fields?: Record<string, unknown> };
  const portfolio = readPublicPortfolio(publicId, documentFields(body));
  return portfolio ?? "invalid";
}

async function readSlugRecord(slug: string): Promise<SlugRegistryView | "error"> {
  const response = await firestoreGet(`portfolioSlugs/${encodeURIComponent(slug)}`);
  if (response.status === 404 || response.status === 403) return null;
  if (!response.ok) return "error";
  const fields = documentFields((await response.json()) as { fields?: Record<string, unknown> });
  const portfolioId = typeof fields.portfolioId === "string" ? fields.portfolioId : "";
  const role = fields.role === "alias" || fields.role === "active" ? fields.role : "";
  if (!portfolioId || !role || fields.slug !== slug) return null;
  return { portfolioId, role };
}

export type PublicHtmlResult = {
  status: number;
  html: string;
  location?: string;
};

export async function publicPortfolioHtml(
  publicId: string,
  shell: string,
  environment: SiteEnvironment
): Promise<PublicHtmlResult> {
  const unavailable = { status: 404, html: applyHead(shell, renderUnavailableHead()) };
  const requested = publicId.trim();
  try {
    const direct = await readAddressedPortfolio(requested);
    if (direct === "error") return { status: 502, html: unavailable.html };
    if (direct === "invalid") return unavailable;

    let slugRecord: SlugRegistryView = null;
    let bySlug: PublicPortfolio | null = null;
    if (!direct) {
      const parsed = parsePublicSlug(requested);
      if (parsed.ok && parsed.slug) {
        const record = await readSlugRecord(parsed.slug);
        if (record === "error") return { status: 502, html: unavailable.html };
        slugRecord = record;
        if (record) {
          const target = await readAddressedPortfolio(record.portfolioId);
          if (target === "error") return { status: 502, html: unavailable.html };
          if (target && target !== "invalid") bySlug = target;
        }
      }
    }

    const plan = resolvePublicAddress({
      requested,
      byId: direct,
      slugRecord,
      bySlug,
    });
    if (plan.action === "unavailable") return unavailable;
    if (plan.action === "redirect") {
      const location = portfolioCanonicalUrl(plan.segment);
      if (!location) return unavailable;
      return { status: 301, location, html: redirectHtml() };
    }
    const portfolio = direct && direct.publicId === plan.portfolioId ? direct : bySlug;
    if (!portfolio || portfolio.publicId !== plan.portfolioId) return unavailable;
    const resolved = resolvePublicPortfolioSeo(portfolio, environment);
    if (!resolved) return unavailable;
    return {
      status: 200,
      html: applyPublicBody(applyHead(shell, renderHeadTags(resolved)), renderPortfolioFacts(portfolio)),
    };
  } catch {
    return { status: 502, html: unavailable.html };
  }
}

function redirectHtml(): string {
  return "<!doctype html><html><head><meta charset=\"utf-8\"><title>Portfolio</title><meta name=\"robots\" content=\"noindex, nofollow\"></head><body></body></html>";
}

export function homeHtml(shell: string, environment: SiteEnvironment): string {
  return applyHead(shell, renderHomeHead(environment));
}

export async function loadSitemapEntries(): Promise<{ publicId: string; slug?: string; updatedAt?: string }[]> {
  const entries: { publicId: string; slug?: string; updatedAt?: string }[] = [];
  let pageToken = "";
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(`${firestoreDocuments()}/sitemapEntries`);
    url.searchParams.set("key", firebaseConfig.apiKey);
    url.searchParams.set("pageSize", String(PAGE_SIZE));
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url);
    if (!response.ok) throw new Error("Sitemap source unavailable");
    const body = (await response.json()) as {
      documents?: { fields?: Record<string, unknown> }[];
      nextPageToken?: string;
    };
    for (const document of body.documents ?? []) {
      const fields = documentFields(document);
      const publicId = typeof fields.publicId === "string" ? fields.publicId : "";
      const slug = typeof fields.slug === "string" ? fields.slug : undefined;
      const updatedAt = typeof fields.updatedAt === "string" ? fields.updatedAt : undefined;
      if (publicId) entries.push({ publicId, slug, updatedAt });
    }
    if (!body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }
  return entries;
}
