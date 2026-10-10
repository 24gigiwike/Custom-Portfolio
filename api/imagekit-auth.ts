type RetiredResponse = {
  status: (code: number) => RetiredResponse;
  setHeader: (name: string, value: string) => void;
  end: (body: string) => void;
};

/**
 * The V1 browser-upload signature route is retired.
 * It does not read credentials and it does not sign uploads.
 */
export default async function handler(_req: unknown, res: RetiredResponse): Promise<void> {
  res.status(410);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-robots-tag", "noindex");
  res.setHeader("allow", "POST");
  res.end(JSON.stringify({ error: "This upload route is no longer available." }));
}
