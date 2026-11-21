import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { advanceDomainOrder, openDomainOrder } from "./domainLifecycle";
import { firestoreDomainStore, type DomainRegistrant } from "./domainRecords";
import { quoteDomainPrice } from "./domainPricing";

const emulator = process.env.FIRESTORE_EMULATOR_HOST ?? "";
if (emulator !== "127.0.0.1:8080") {
  throw new Error("Refusing to run domain store checks outside the local Firestore emulator.");
}

const priced = quoteDomainPrice({ price: 11.4, currency: "USD", period: 1, premium: false, markupBasisPoints: 0 });
if (!priced) throw new Error("quote");
const registrant: DomainRegistrant = {
  firstName: "Ada",
  lastName: "Okoye",
  email: "ada@example.com",
  address: "12 Broad Street",
  city: "Lagos",
  state: "Lagos",
  postalCode: "100001",
  country: "NG",
  phoneCountryCode: "234",
  phone: "8012345678",
};
const opened = openDomainOrder({
  orderId: "orderemu1",
  paymentId: "payemu1",
  paymentPurpose: "domain-registration",
  paymentReference: "domain:orderemu1:payemu1",
  paymentStatus: "verified",
  uid: "owner-emu",
  portfolioId: "portfolio1234",
  domainName: "ada.com.ng",
  quote: priced,
  registrant,
  runtimeMode: "sandbox",
  at: "2026-11-21T00:00:00.000Z",
});
if ("ok" in opened) throw new Error(opened.reason);

const app = initializeApp({ projectId: "demo-custom-portfolio" }, "domain-store-emulator");
const db = getFirestore(app);
const store = firestoreDomainStore(db);
await store.save(opened, { role: "server" });
const reread = firestoreDomainStore(db);
const loaded = await reread.read("orderemu1", { role: "server" });
assert.equal(loaded?.order.domainName, "ada.com.ng");
assert.equal(loaded?.registrant.email, "ada@example.com");
assert.equal(loaded?.registration.autoRenew, false);
await assert.rejects(store.save(opened, { role: "owner", uid: "owner-emu" }));

let registrations = 0;
const saved = await advanceDomainOrder({
  records: opened,
  api: {
    async search() {
      return { domainName: "ada.com.ng", tld: "com.ng", status: "AVAILABLE", isPremium: false, isDocumentRequired: false, price: 11.4, currency: "USD", period: 1 };
    },
    async listTlds() { return []; },
    async register() {
      registrations += 1;
      return { accepted: true, domainId: "domain-emu", status: "Active", expirationDate: "2027-11-21T00:00:00.000Z", code: null };
    },
    async readDomain() {
      return { domainName: "ada.com.ng", status: "Active", expirationDate: "2027-11-21T00:00:00.000Z", remainingDay: 365, nameservers: [], renewalMode: "AutoExpire" };
    },
    async replaceNameServers() { return { ok: true as const }; },
  },
  cloudflare: {
    async findZone() { return null; },
    async ensureZone(domainName: string) {
      return { id: "zone-emu", name: domainName, status: "active", nameServers: ["ns1.cloudflare.com", "ns2.cloudflare.com"] };
    },
    async ensureZoneRecords() { return undefined; },
    async readZoneCertificate() { return "active"; },
    async ensureCustomHostname(hostname: string) {
      return { id: "host-emu", hostname, status: "pending", certificateStatus: "pending_validation" };
    },
    async readCustomHostname() { return null; },
  },
  preferSaas: false,
  apexProxying: false,
  fallbackOrigin: "portfolios.example.net",
  renewalPeriods: [1],
  at: "2026-11-21T00:05:00.000Z",
  store,
});
await advanceDomainOrder({
  records: saved,
  api: {
    async search() { throw new Error("search after confirmation"); },
    async listTlds() { return []; },
    async register() { registrations += 1; return { accepted: false, domainId: null, status: "", expirationDate: null, code: "duplicate" }; },
    async readDomain() { return { ok: false, code: "not-called", retryable: false }; },
    async replaceNameServers() { return { ok: true as const }; },
  },
  cloudflare: {
    async findZone() { return null; },
    async ensureZone(domainName: string) {
      return { id: "zone-emu", name: domainName, status: "active", nameServers: ["ns1.cloudflare.com", "ns2.cloudflare.com"] };
    },
    async ensureZoneRecords() { return undefined; },
    async readZoneCertificate() { return "active"; },
    async ensureCustomHostname(hostname: string) {
      return { id: "host-emu", hostname, status: "pending", certificateStatus: "pending_validation" };
    },
    async readCustomHostname() { return null; },
  },
  preferSaas: false,
  apexProxying: false,
  fallbackOrigin: "portfolios.example.net",
  renewalPeriods: [1],
  at: "2026-11-21T00:06:00.000Z",
  store,
});
assert.equal(registrations, 1);
const persisted = await reread.read("orderemu1", { role: "owner", uid: "owner-emu" });
assert.equal(persisted?.registration.providerDomainId, "domain-emu");
assert.equal(persisted?.registrant.email, "ada@example.com");

const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
const testEnv = await initializeTestEnvironment({
  projectId: "demo-custom-portfolio",
  firestore: { rules, host: "127.0.0.1", port: 8080 },
});
await testEnv.withSecurityRulesDisabled(async (context) => {
  const admin = context.firestore();
  await setDoc(doc(admin, "domainOrders", "order-rules"), { uid: "owner-rules", domainName: "ada.ng" });
  await setDoc(doc(admin, "domainRegistrations", "order-rules"), { uid: "owner-rules", status: "confirmed" });
  await setDoc(doc(admin, "domainProvisioning", "order-rules"), { uid: "owner-rules", mode: "cloudflare-zone" });
  await setDoc(doc(admin, "domainLifecycleEvents", "order-rules"), { uid: "owner-rules", events: [] });
  await setDoc(doc(admin, "domainRegistrants", "order-rules"), { email: "ada@example.com" });
  await setDoc(doc(admin, "domainHostnames", "ada.ng"), { portfolioId: "portfolio1234", uid: "owner-rules" });
});
const owner = testEnv.authenticatedContext("owner-rules").firestore();
const other = testEnv.authenticatedContext("other-rules").firestore();
await assertSucceeds(getDoc(doc(owner, "domainOrders", "order-rules")));
await assertFails(getDoc(doc(other, "domainOrders", "order-rules")));
await assertFails(setDoc(doc(owner, "domainOrders", "order-rules"), { uid: "owner-rules", paymentStatus: "verified" }));
await assertFails(getDoc(doc(owner, "domainRegistrants", "order-rules")));
await assertFails(getDoc(doc(owner, "domainHostnames", "ada.ng")));
await assertSucceeds(getDoc(doc(owner, "domainRegistrations", "order-rules")));
await testEnv.cleanup();

console.log("domain store emulator checks passed");
