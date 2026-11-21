/**
 * Customer hostnames attach to the existing Vercel project.
 * Cloudflare stays grey-cloud DNS. No Worker and no reverse proxy are deployed.
 * A verified domain is not treated as an active certificate.
 */

export const VERCEL_API_ORIGIN = "https://api.vercel.com";

export type VercelDomainConfig = {
  token: string;
  projectId: string;
  teamId: string | null;
  writesEnabled: boolean;
};

export function readVercelDomainConfig(env: NodeJS.ProcessEnv): VercelDomainConfig | null {
  const token = env.VERCEL_TOKEN?.trim() ?? "";
  const projectId = env.VERCEL_PROJECT_ID?.trim() ?? "";
  const teamId = env.VERCEL_TEAM_ID?.trim() || null;
  if (!token || !projectId) return null;
  return { token, projectId, teamId, writesEnabled: env.VERCEL_DOMAIN_WRITES === "local-sandbox" };
}

/** DNS existence is not certificate readiness. */
export function readVercelCertificateStatus(body: unknown): string {
  if (!body || typeof body !== "object") return "missing";
  const row = body as { verified?: unknown; cert?: { status?: unknown }; certificate?: { status?: unknown } };
  if (typeof row.cert?.status === "string") return row.cert.status;
  if (typeof row.certificate?.status === "string") return row.certificate.status;
  if (row.verified === true) return "pending";
  return "missing";
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{ status: number; body: unknown }>;

export function createVercelDomainClient(config: VercelDomainConfig, fetchImpl: FetchLike) {
  const headers = { authorization: `Bearer ${config.token}`, "content-type": "application/json" };
  const team = config.teamId ? `?teamId=${encodeURIComponent(config.teamId)}` : "";
  const refuse = () => {
    if (!config.writesEnabled) throw new Error("Vercel domain writes are disabled.");
  };
  return {
    async ensureProjectDomain(hostname: string): Promise<void> {
      refuse();
      const response = await fetchImpl(`${VERCEL_API_ORIGIN}/v10/projects/${encodeURIComponent(config.projectId)}/domains${team}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: hostname }),
      });
      const duplicate = response.status === 409;
      if (response.status !== 200 && !duplicate) throw new Error("Vercel did not attach the domain.");
    },
    async certificateStatus(hostname: string): Promise<string> {
      const response = await fetchImpl(`${VERCEL_API_ORIGIN}/v9/projects/${encodeURIComponent(config.projectId)}/domains/${encodeURIComponent(hostname)}${team}`, {
        method: "GET",
        headers,
      });
      return readVercelCertificateStatus(response.body);
    },
  };
}

export type VercelDomainClient = ReturnType<typeof createVercelDomainClient>;
