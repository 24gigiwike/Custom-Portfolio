import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = join(import.meta.dirname, "../..");
const configPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
if (!configPath) throw new Error("tsconfig.json was not found");
const parsed = ts.parseJsonConfigFileContent(
  ts.readConfigFile(configPath, ts.sys.readFile).config,
  ts.sys,
  root
);
const options = { ...parsed.options, noEmit: false };
const out = mkdtempSync(join(tmpdir(), "portfolio-seo-function-"));

function resolveLocal(specifier: string, fromFile: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const base = join(dirname(fromFile), specifier);
  const noExt = base.replace(/\.(js|json)$/, "");
  for (const candidate of [base, `${noExt}.ts`, `${noExt}.tsx`, `${noExt}.json`]) {
    if (ts.sys.fileExists(candidate)) return candidate;
  }
  return null;
}

const files: string[] = [];
const seen = new Set<string>();
const queue = [join(root, "api/site.ts")];
while (queue.length > 0) {
  const file = queue.pop();
  if (!file || seen.has(file)) continue;
  seen.add(file);
  files.push(file);
  if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
  for (const imported of ts.preProcessFile(readFileSync(file, "utf8"), true, true).importedFiles) {
    const resolved = resolveLocal(imported.fileName, file);
    if (resolved) queue.push(resolved);
  }
}

function emittedName(file: string): string {
  const rel = relative(root, file);
  if (rel.endsWith(".tsx")) return `${rel.slice(0, -4)}.js`;
  if (rel.endsWith(".ts")) return `${rel.slice(0, -3)}.js`;
  return rel;
}

const firebaseEnvNames = [
  "VERCEL_ENV",
  "FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;
const savedFirebaseEnv = Object.fromEntries(firebaseEnvNames.map((name) => [name, process.env[name]]));
for (const name of firebaseEnvNames) delete process.env[name];
process.env.VERCEL_ENV = "production";
const originalFetch = globalThis.fetch;
let requestedFirestoreUrl = "";
globalThis.fetch = (async (input: RequestInfo | URL) => {
  requestedFirestoreUrl = String(input);
  return new Response("{}", { status: 404 });
}) as typeof fetch;

try {
  for (const file of files) {
    const dest = join(out, emittedName(file));
    mkdirSync(dirname(dest), { recursive: true });
    if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      const result = ts.transpileModule(readFileSync(file, "utf8"), { fileName: file, compilerOptions: options });
      writeFileSync(dest, result.outputText);
    } else {
      writeFileSync(dest, readFileSync(file));
    }
  }
  writeFileSync(join(out, "package.json"), JSON.stringify({ type: "module" }));
  writeFileSync(join(out, "index.html"), readFileSync(join(root, "index.html")));

  const site = readFileSync(join(out, "api/site.js"), "utf8");
  assert.match(site, /from "\.\.\/src\/lib\/portfolioSeo\.js"/);
  assert.match(site, /from "\.\.\/src\/server\/seoResponse\.js"/);
  assert.equal(site.includes('from "../src/lib/portfolioSeo"'), false);

  const handler = (await import(pathToFileURL(join(out, "api/site.js")).href)).default as (
    req: { url?: string; headers: Record<string, string> },
    res: { status: (code: number) => unknown; setHeader: (name: string, value: string) => void; end: (body: string) => void }
  ) => Promise<void>;

  const call = async (url: string, host: string) => {
    let status = 0;
    let body = "";
    const res = {
      status(code: number) {
        status = code;
        return res;
      },
      setHeader() {
        return undefined;
      },
      end(value: string) {
        body = value;
      },
    };
    await handler({ url, headers: { "x-forwarded-host": host } }, res);
    return { status, body };
  };

  const robots = await call("/api/site?kind=robots", "customportfolio.broadbrand.com.ng");
  assert.equal(robots.status, 200);
  assert.match(robots.body, /Sitemap: https:\/\/customportfolio\.broadbrand\.com\.ng\/sitemap\.xml/);

  const preview = await call("/api/site?kind=robots", "preview-deployment.vercel.app");
  assert.match(preview.body, /Disallow: \//);
  assert.equal(preview.body.includes("Sitemap:"), false);

  const home = await call("/api/site?kind=home", "customportfolio.broadbrand.com.ng");
  assert.equal(home.status, 200);
  assert.match(home.body, /<title>Custom Portfolio<\/title>/);
  assert.match(home.body, /index, follow/);

  const missing = await call("/api/site?kind=portfolio&publicId=does-not-exist", "customportfolio.broadbrand.com.ng");
  assert.equal(missing.status, 404);
  assert.match(missing.body, /<title>Portfolio<\/title>/);
  assert.match(missing.body, /noindex, nofollow/);
  assert.equal(missing.body.includes("custom-portfolio-2026"), false);
  assert.equal(missing.body.includes("VITE_FIREBASE"), false);
  const requested = new URL(requestedFirestoreUrl);
  assert.equal(requested.pathname.includes("/projects/custom-portfolio-2026/"), true);
  assert.equal(requested.pathname.includes("custom-by-broadbrand"), false);
} finally {
  globalThis.fetch = originalFetch;
  for (const name of firebaseEnvNames) {
    const value = savedFirebaseEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  rmSync(out, { recursive: true, force: true });
}

console.log("vercel function module checks passed");
