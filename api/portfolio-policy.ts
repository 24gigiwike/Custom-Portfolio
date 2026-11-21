import { handlePortfolioPolicy } from "../src/server/portfolioCreateHandler.js";

type HeaderValue = string | string[] | undefined;

type NodeRequest = {
  method?: string;
  headers: Record<string, HeaderValue>;
};

type NodeResponse = {
  status: (code: number) => NodeResponse;
  setHeader: (name: string, value: string) => void;
  end: (body: string) => void;
};

/**
 * Tells the signed-in user whether their account is legacy or restricted.
 * The classification comes from Firebase Auth. The response does not include it.
 */
export default async function handler(req: NodeRequest, res: NodeResponse): Promise<void> {
  await handlePortfolioPolicy({ method: req.method, headers: req.headers }, res);
}
