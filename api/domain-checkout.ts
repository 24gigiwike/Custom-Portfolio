import { domainPurchaseOptions, handleDomainCheckout } from "../src/server/domainCheckoutHandler.js";
import { verifyFirebaseIdToken } from "../src/server/firebaseIdToken.js";

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
  const options = await domainPurchaseOptions(process.env, (token, projectId) => verifyFirebaseIdToken(token, projectId));
  await handleDomainCheckout(req, res, options.checkout);
}
