/**
 * Sanitized portfolio-creation diagnostics.
 * Events carry a correlation id only. Tokens, account ids, and portfolio content are not accepted.
 */

export const PORTFOLIO_CREATE_TRACE_PATH = "/api/portfolio-create-trace";
export const PORTFOLIO_CREATE_TRACE_HEADER = "x-portfolio-trace";
export const PORTFOLIO_CREATE_ENDPOINT = "/api/portfolio-create";

const TRACE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TEMPLATE_ID = /^[a-z0-9-]{1,64}$/;
const SHORT_CODE = /^[a-z0-9_.:/-]{1,80}$/i;

export const PORTFOLIO_CREATE_TRACE_STAGES = [
  "button",
  "existing-portfolio",
  "uid-missing",
  "ownership-query-failed",
  "plan",
  "token-requested",
  "token-obtained",
  "token-failed",
  "fetch-started",
  "response",
  "displayed-failure",
  "server-unauthenticated",
  "server-unavailable",
  "server-invalid",
  "server-rejected",
  "server-created",
  "server-existing",
  "server-failed",
] as const;

export type PortfolioCreateTraceStage = (typeof PORTFOLIO_CREATE_TRACE_STAGES)[number];
export type PortfolioCreateTraceSource = "client" | "server";

export type PortfolioCreateTraceEvent = {
  correlationId: string;
  stage: PortfolioCreateTraceStage;
  templateId?: string;
  authReady?: boolean;
  userPresent?: boolean;
  tokenObtained?: boolean;
  endpoint?: typeof PORTFOLIO_CREATE_ENDPOINT;
  status?: number | null;
  failureStage?: string;
  errorName?: string;
  errorCode?: string;
  action?: "" | "create" | "open" | "adopt" | "reject";
  owned?: boolean;
  lookup?: "" | "missing" | "legacy" | "ready";
};

const ACTIONS = new Set<NonNullable<PortfolioCreateTraceEvent["action"]>>(["", "create", "open", "adopt", "reject"]);
const LOOKUPS = new Set<NonNullable<PortfolioCreateTraceEvent["lookup"]>>(["", "missing", "legacy", "ready"]);

let activeCorrelationId = "";

export function beginPortfolioCreateTrace(): string {
  const id = crypto.randomUUID();
  activeCorrelationId = TRACE_ID.test(id) ? id : "";
  return activeCorrelationId;
}

export function endPortfolioCreateTrace(): void {
  activeCorrelationId = "";
}

export function activePortfolioCreateTraceId(): string {
  return TRACE_ID.test(activeCorrelationId) ? activeCorrelationId : "";
}

function optionalShort(value: unknown): string | undefined {
  return typeof value === "string" && SHORT_CODE.test(value) ? value : undefined;
}

/** Keep only the diagnostic fields that are safe to store in logs. */
export function sanitizePortfolioCreateTrace(input: unknown): PortfolioCreateTraceEvent | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  if (typeof raw.correlationId !== "string" || !TRACE_ID.test(raw.correlationId)) return null;
  if (typeof raw.stage !== "string" || !PORTFOLIO_CREATE_TRACE_STAGES.includes(raw.stage as PortfolioCreateTraceStage)) return null;

  const event: PortfolioCreateTraceEvent = {
    correlationId: raw.correlationId,
    stage: raw.stage as PortfolioCreateTraceStage,
  };
  if (typeof raw.templateId === "string" && TEMPLATE_ID.test(raw.templateId)) event.templateId = raw.templateId;
  if (typeof raw.authReady === "boolean") event.authReady = raw.authReady;
  if (typeof raw.userPresent === "boolean") event.userPresent = raw.userPresent;
  if (typeof raw.tokenObtained === "boolean") event.tokenObtained = raw.tokenObtained;
  if (raw.endpoint === PORTFOLIO_CREATE_ENDPOINT) event.endpoint = PORTFOLIO_CREATE_ENDPOINT;
  if (typeof raw.status === "number" && Number.isInteger(raw.status) && raw.status >= 0 && raw.status <= 599) event.status = raw.status;
  if (raw.status === null) event.status = null;
  const failureStage = optionalShort(raw.failureStage);
  const errorName = optionalShort(raw.errorName);
  const errorCode = optionalShort(raw.errorCode);
  if (failureStage) event.failureStage = failureStage;
  if (errorName) event.errorName = errorName;
  if (errorCode) event.errorCode = errorCode;
  if (typeof raw.action === "string" && ACTIONS.has(raw.action as PortfolioCreateTraceEvent["action"])) {
    event.action = raw.action as PortfolioCreateTraceEvent["action"];
  }
  if (typeof raw.owned === "boolean") event.owned = raw.owned;
  if (typeof raw.lookup === "string" && LOOKUPS.has(raw.lookup as PortfolioCreateTraceEvent["lookup"])) {
    event.lookup = raw.lookup as PortfolioCreateTraceEvent["lookup"];
  }
  return event;
}

export function portfolioCreateTraceLine(event: PortfolioCreateTraceEvent, source: PortfolioCreateTraceSource): string {
  return `portfolio-create-trace ${JSON.stringify({ ...event, source })}`;
}

export function emitPortfolioCreateTrace(event: PortfolioCreateTraceEvent, source: PortfolioCreateTraceSource): void {
  const safe = sanitizePortfolioCreateTrace(event);
  if (!safe) return;
  console.info(portfolioCreateTraceLine(safe, source));
}

/** Send one client event to the same-origin diagnostic route. Failures stay silent. */
export function recordPortfolioCreateTrace(event: PortfolioCreateTraceEvent): void {
  const safe = sanitizePortfolioCreateTrace(event);
  if (!safe || typeof fetch !== "function") return;
  void fetch(PORTFOLIO_CREATE_TRACE_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(safe),
    keepalive: true,
  }).catch(() => {});
}

export function portfolioCreateErrorParts(error: unknown): { errorName: string; errorCode: string } {
  const errorName = error instanceof Error && SHORT_CODE.test(error.name) ? error.name : "Error";
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  return { errorName, errorCode: SHORT_CODE.test(code) ? code : "" };
}
