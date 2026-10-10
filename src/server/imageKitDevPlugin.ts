import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

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

function readBody(req: IncomingMessage): Promise<string | Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let oversized = false;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 4096) oversized = true;
      else chunks.push(Buffer.from(chunk));
    });
    req.on("end", () => resolve(oversized ? new Uint8Array(size) : Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
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

/** Serves the upload proof and its auth route during `vite` dev only. Production builds do not emit this page. */
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
        if (pathname !== "/api/imagekit-auth") {
          next();
          return;
        }
        const auth = await server.ssrLoadModule("/src/server/imageKitUploadAuth.ts") as typeof import("./imageKitUploadAuth");
        const body = await readBody(req);
        await auth.handleImageKitAuth(
          { method: req.method, headers: req.headers, body },
          nodeResponse(res),
        );
      });
    },
  };
}
