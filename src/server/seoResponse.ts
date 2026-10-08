import firebaseConfig from "../../firebase-applet-config.json" with { type: "json" };
import { readPublicPortfolio } from "../lib/publicPortfolio.js";
import {
  applyHead,
  renderHomeHead,
  applyPublicBody,
  renderHeadTags,
  renderPortfolioFacts,
  renderUnavailableHead,
  resolvePublicPortfolioSeo,
  type SiteEnvironment,
} from "../lib/portfolioSeo.js";

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

export async function publicPortfolioHtml(
  publicId: string,
  shell: string,
  environment: SiteEnvironment
): Promise<{ status: number; html: string }> {
  const unavailable = { status: 404, html: applyHead(shell, renderUnavailableHead()) };
  try {
    const response = await firestoreGet(`publicPortfolios/${encodeURIComponent(publicId)}`);
    if (response.status === 404 || response.status === 403) return unavailable;
    if (!response.ok) return { status: 502, html: unavailable.html };
    const body = (await response.json()) as { fields?: Record<string, unknown> };
    const portfolio = readPublicPortfolio(publicId, documentFields(body));
    if (!portfolio) return unavailable;
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

export function homeHtml(shell: string, environment: SiteEnvironment): string {
  return applyHead(shell, renderHomeHead(environment));
}

export async function loadSitemapEntries(): Promise<{ publicId: string; updatedAt?: string }[]> {
  const entries: { publicId: string; updatedAt?: string }[] = [];
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
      const updatedAt = typeof fields.updatedAt === "string" ? fields.updatedAt : undefined;
      if (publicId) entries.push({ publicId, updatedAt });
    }
    if (!body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }
  return entries;
}
