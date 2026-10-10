import type { ServerResponse } from "node:http";
import { loadEnv, type Plugin } from "vite";

const PROOF_PATH = "/dev/imagekit-proof";

const proofHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>ImageKit upload proof</title>
  <style>
    body { font-family: Georgia, serif; margin: 2rem auto; max-width: 40rem; color: #163331; }
    button, input { font: inherit; }
    section { margin: 1.5rem 0; }
    progress { width: 100%; height: 0.75rem; }
    img { max-width: 100%; margin-top: 1rem; }
  </style>
</head>
<body>
  <main>
    <h1>ImageKit upload proof</h1>
    <p id="session">Checking your session…</p>
    <section>
      <label>Small JPEG <input id="small" type="file" accept="image/jpeg,.jpg,.jpeg"></label>
      <button id="run-small" type="button">Upload small JPEG</button>
    </section>
    <section>
      <label>Larger photograph <input id="large" type="file" accept="image/jpeg,.jpg,.jpeg"></label>
      <button id="run-large" type="button">Upload larger photograph</button>
    </section>
    <p id="status" aria-live="polite"></p>
    <progress id="progress" max="100" value="0"></progress>
    <button id="cancel" type="button" disabled>Cancel upload</button>
    <img id="preview" alt="">
  </main>
  <script type="module" src="/src/dev/imageKitProofPage.ts"></script>
</body>
</html>`;

const RETIRED_ROUTE = JSON.stringify({ error: "This upload route is no longer available." });

/**
 * Reads ImageKit settings for the Vite dev server.
 * Vite only copies VITE_ names into import.meta.env. An empty prefix also
 * reads server-only names from .env.local and from the process environment,
 * which is where Cursor Cloud secrets are injected. Values already set on
 * the process win over the file. Nothing is written back to the process
 * environment and nothing is logged.
 */
export function imageKitDevServerEnv(mode: string, envDir: string): NodeJS.ProcessEnv {
  const loaded = loadEnv(mode, envDir, "");
  return {
    IMAGEKIT_PRIVATE_KEY: loaded.IMAGEKIT_PRIVATE_KEY,
    IMAGEKIT_PUBLIC_KEY: loaded.IMAGEKIT_PUBLIC_KEY,
    IMAGEKIT_URL_ENDPOINT: loaded.IMAGEKIT_URL_ENDPOINT,
  };
}

function nodeResponse(res: ServerResponse) {
  return {
    status(code: number) {
      res.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      res.setHeader(name, value);
    },
    end(body: string) {
      res.end(body);
    },
  };
}

/** Serves the upload proof and the server upload route during `vite` dev only. Production builds do not emit this page. */
export function imageKitDevPlugin(): Plugin {
  return {
    name: "imagekit-dev-proof",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split("?")[0];
        if (pathname === PROOF_PATH && (req.method === "GET" || !req.method)) {
          res.statusCode = 200;
          res.setHeader("content-type", "text/html; charset=utf-8");
          res.setHeader("x-robots-tag", "noindex, nofollow");
          res.setHeader("cache-control", "no-store");
          res.end(proofHtml);
          return;
        }
        if (pathname === "/api/imagekit-auth") {
          res.statusCode = 410;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.setHeader("cache-control", "no-store");
          res.setHeader("x-robots-tag", "noindex");
          res.end(RETIRED_ROUTE);
          return;
        }
        if (pathname !== "/api/imagekit-upload") {
          next();
          return;
        }
        const upload = await server.ssrLoadModule("/src/server/imageKitServerUpload.ts") as typeof import("./imageKitServerUpload");
        const body = await upload.readBoundedRequestBody(req, upload.IMAGEKIT_MAX_BODY_BYTES);
        await upload.handleImageKitServerUpload(
          {
            method: req.method,
            headers: req.headers,
            body: body === "too-large" ? undefined : body,
            bodyTooLarge: body === "too-large",
          },
          nodeResponse(res),
          {
            env: imageKitDevServerEnv(server.config.mode, server.config.envDir || server.config.root),
            developmentProof: true,
          },
        );
      });
    },
  };
}
