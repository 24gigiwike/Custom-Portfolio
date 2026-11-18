import { Bachs } from "@bachs/sdk";
import { firebaseRuntime } from "../lib/firebaseEnvironment";

/** Sandbox product for every non-production runtime. Production uses its own configured id. */
export const BACHS_SANDBOX_PRODUCT_ID = "prod_d8c0e88a960141ac884b";

const GENERIC_MESSAGE = "Publishing payment is not available right now.";

export class BachsRuntimeError extends Error {
  readonly name = "BachsRuntimeError";

  constructor() {
    super(GENERIC_MESSAGE);
  }
}

function recognizedKey(key: string): "sandbox" | "live" | null {
  if (/\s/.test(key)) return null;
  if (key.startsWith("sk_sandbox_") && key.length > "sk_sandbox_".length) return "sandbox";
  if (key.startsWith("sk_live_") && key.length > "sk_live_".length) return "live";
  return null;
}

/**
 * Preview and local development accept only a sandbox key.
 * Production accepts only a live key. The thrown message names neither.
 */
export function assertBachsApiKeyForRuntime(env: NodeJS.ProcessEnv): void {
  const kind = recognizedKey(env.BACHS_API_KEY?.trim() ?? "");
  const production = firebaseRuntime(env) === "production";
  if (production ? kind !== "live" : kind !== "sandbox") throw new BachsRuntimeError();
}

/**
 * Non-production is pinned to the sandbox product.
 * Production must name a different product. The sandbox id is never implied.
 */
export function assertBachsProductForRuntime(env: NodeJS.ProcessEnv): string {
  const productId = env.BACHS_PUBLISHING_PRODUCT_ID?.trim() ?? "";
  if (!/^prod_[A-Za-z0-9]+$/.test(productId)) throw new BachsRuntimeError();
  const production = firebaseRuntime(env) === "production";
  if (production) {
    if (productId === BACHS_SANDBOX_PRODUCT_ID) throw new BachsRuntimeError();
    return productId;
  }
  if (productId !== BACHS_SANDBOX_PRODUCT_ID) throw new BachsRuntimeError();
  return productId;
}

/** Constructs the SDK only after the key matches the runtime. */
export function publishingBachsClient(env: NodeJS.ProcessEnv): Bachs {
  assertBachsApiKeyForRuntime(env);
  try {
    return new Bachs({ apiKey: env.BACHS_API_KEY!.trim(), logLevel: "off", timeoutMs: 8_000 });
  } catch {
    throw new BachsRuntimeError();
  }
}
