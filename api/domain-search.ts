import { handleDomainSearch } from "../src/server/domainOrderHandler.js";
import { firebaseProjectId, verifyFirebaseIdToken } from "../src/server/firebaseIdToken.js";

type HeaderValue = string | string[] | undefined;

type NodeRequest = {
  method?: string;
  headers: Record<string, HeaderValue>;
  body?: unknown;
};

type NodeResponse = {
  status: (code: number) => NodeResponse;
  setHeader: (name: string, value: string) => void;
  end: (body: string) => void;
};

export default async function handler(req: NodeRequest, res: NodeResponse): Promise<void> {
  await handleDomainSearch(req, res, {
    env: process.env,
    verify: async (token, projectId) => {
      if (firebaseProjectId(process.env) !== projectId) throw new Error("project");
      return verifyFirebaseIdToken(token, projectId);
    },
  });
}
