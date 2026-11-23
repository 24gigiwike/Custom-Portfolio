import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handlePortfolioCreateTrace } from "../server/portfolioCreateTrace";
import {
  PORTFOLIO_CREATE_TRACE_HEADER,
  beginPortfolioCreateTrace,
  endPortfolioCreateTrace,
  portfolioCreateTraceLine,
  sanitizePortfolioCreateTrace,
} from "./portfolioCreateTrace";

const correlationId = "11111111-1111-4111-8111-111111111111";
const safe = sanitizePortfolioCreateTrace({
  correlationId,
  stage: "fetch-started",
  templateId: "wdk-premium-portfolio-1",
  authReady: true,
  userPresent: true,
  tokenObtained: true,
  endpoint: "/api/portfolio-create",
  authorization: "Bearer secret-token",
  token: "secret-token",
  email: "person@example.com",
  uid: "firebase-uid",
  portfolioId: "portfolio-id",
  password: "secret",
});
assert.ok(safe);
assert.equal(safe.correlationId, correlationId);
assert.equal(safe.tokenObtained, true);
assert.equal("authorization" in safe, false);
assert.equal("token" in safe, false);
assert.equal("email" in safe, false);
assert.equal("uid" in safe, false);
assert.equal("portfolioId" in safe, false);
assert.equal(sanitizePortfolioCreateTrace({ correlationId: "not-a-uuid", stage: "button" }), null);
assert.equal(sanitizePortfolioCreateTrace({ correlationId, stage: "not-a-stage" }), null);
const droppedEmail = sanitizePortfolioCreateTrace({
  correlationId,
  stage: "button",
  templateId: "person@example.com",
});
assert.ok(droppedEmail);
assert.equal(droppedEmail.templateId, undefined);

const clientLine = portfolioCreateTraceLine(safe, "client");
const serverLine = portfolioCreateTraceLine({ ...safe, stage: "server-created", status: 200 }, "server");
assert.match(clientLine, new RegExp(correlationId));
assert.match(serverLine, new RegExp(correlationId));
assert.match(clientLine, /"source":"client"/);
assert.match(serverLine, /"source":"server"/);
assert.equal(clientLine.includes("secret"), false);

const logs: string[] = [];
const original = console.info;
console.info = (...args: unknown[]) => {
  logs.push(args.map((item) => String(item)).join(" "));
};
const response = { statusCode: 0, body: "", status(code: number) { this.statusCode = code; return this; }, setHeader() {}, end(body?: string) { this.body = body ?? ""; } };
await handlePortfolioCreateTrace({
  method: "POST",
  body: { ...safe, authorization: "Bearer secret-token", portfolioId: "private-portfolio" },
}, response);
console.info = original;
assert.equal(response.statusCode, 204);
assert.equal(response.body, "");
assert.equal(logs.length, 1);
assert.match(logs[0], new RegExp(correlationId));
assert.match(logs[0], /"source":"client"/);
assert.equal(logs[0].includes("secret"), false);
assert.equal(logs[0].includes("private-portfolio"), false);

const begun = beginPortfolioCreateTrace();
assert.match(begun, /^[0-9a-f-]{36}$/i);
endPortfolioCreateTrace();

const traceApi = readFileSync(new URL("../../api/portfolio-create-trace.ts", import.meta.url), "utf8");
const handler = readFileSync(new URL("../server/portfolioCreateHandler.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("./portfolioCreateRequest.ts", import.meta.url), "utf8");
assert.equal(PORTFOLIO_CREATE_TRACE_HEADER, "x-portfolio-trace");
assert.equal(traceApi.includes("firebase-admin"), false);
assert.equal(traceApi.includes("127.0.0.1"), false);
assert.match(handler, /PORTFOLIO_CREATE_TRACE_HEADER/);
assert.match(client, /PORTFOLIO_CREATE_TRACE_HEADER/);
assert.equal(client.includes("127.0.0.1"), false);
assert.equal(handler.includes("Bearer secret"), false);

console.log("portfolio create trace checks passed");
