import type { Firestore } from "firebase-admin/firestore";
import { hostnameMappings } from "./domainHostname";

/**
 * Server-managed domain records.
 * Registrant details stay off public portfolio documents.
 * Clients do not write these records. Firestore rules are unchanged;
 * the existing default deny already rejects unknown client writes.
 */

export const DOMAIN_ORDER_COLLECTION = "domainOrders";
export const DOMAIN_REGISTRATION_COLLECTION = "domainRegistrations";
export const DOMAIN_REGISTRANT_COLLECTION = "domainRegistrants";
export const DOMAIN_PROVISIONING_COLLECTION = "domainProvisioning";
export const DOMAIN_EVENT_COLLECTION = "domainLifecycleEvents";
export const DOMAIN_HOSTNAME_COLLECTION = "domainHostnames";
export const DOMAIN_PAYMENT_HOLD_COLLECTION = "domainPaymentHolds";

export type DomainRegistrant = {
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phoneCountryCode: string;
  phone: string;
};

export type DomainOrder = {
  orderId: string;
  paymentId: string;
  paymentPurpose: "domain-registration";
  paymentStatus: "pending" | "verified" | "failed";
  uid: string;
  portfolioId: string;
  domainName: string;
  currency: string;
  customerAmount: string;
  wholesaleAmount: string;
  registrarCurrency: string;
  registrarAmount: string;
  exchangeRate: string | null;
  exchangeRateTimestamp: string | null;
  exchangeRateSource: string | null;
  convertedAmount: string | null;
  quoteExpiresAt: string;
  markupBasisPoints: number;
  period: number;
  runtimeMode: "sandbox" | "live";
  createdAt: string;
  portfolioPublished: boolean;
  portfolioEntitled: boolean;
};

export type DomainRegistration = {
  orderId: string;
  uid: string;
  portfolioId: string;
  domainName: string;
  provider: "domainnameapi";
  providerDomainId: string | null;
  providerReference: string | null;
  status: "not-requested" | "requested" | "pending-provider" | "confirmed" | "failed";
  providerStatus: string | null;
  expirationDate: string | null;
  renewalPeriods: number[];
  autoRenew: false;
  idempotencyKey: string;
  attemptCount: number;
};

export type DomainProvisioning = {
  orderId: string;
  mode: "cloudflare-zone" | "cloudflare-saas" | null;
  zoneId: string | null;
  hostnameId: string | null;
  nameservers: string[];
  nameserverUpdate: "not-requested" | "accepted" | "rejected" | "not-proven";
  zoneStatus: string | null;
  hostnameStatus: string | null;
  certificateStatus: string | null;
  fallbackOrigin: string | null;
  apexSupported: boolean;
};

export type DomainEvent = {
  orderId: string;
  at: string;
  kind: string;
  code: string | null;
};

export type DomainRecordSet = {
  order: DomainOrder;
  registrant: DomainRegistrant;
  registration: DomainRegistration;
  provisioning: DomainProvisioning;
  events: DomainEvent[];
};

export type DomainActor = { role: "owner"; uid: string } | { role: "server" };

export class DomainAccessError extends Error {
  constructor() {
    super("Domain management is not available for this account.");
    this.name = "DomainAccessError";
  }
}

const DOMAIN_NAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export function normalizeDomainName(value: string): string | null {
  const name = value.trim().toLowerCase().replace(/\.$/, "");
  if (!DOMAIN_NAME.test(name)) return null;
  return name;
}

export function validateRegistrant(input: DomainRegistrant): boolean {
  const text = [input.firstName, input.lastName, input.address, input.city, input.state, input.postalCode];
  if (text.some((item) => item.trim().length < 1 || item.length > 120)) return false;
  if (!/^[^\s@]+@[^\s@]+$/.test(input.email) || input.email.length > 120) return false;
  if (!/^[A-Z]{2}$/.test(input.country)) return false;
  if (!/^\d{1,4}$/.test(input.phoneCountryCode)) return false;
  if (!/^\d{6,15}$/.test(input.phone)) return false;
  return true;
}

export function publicPortfolioProjection(portfolio: Record<string, unknown>, records: DomainRecordSet | null): Record<string, unknown> {
  const hidden = ["email", "address", "phone", "registrant", "authCode"];
  const copy = { ...portfolio };
  for (const key of hidden) delete copy[key];
  if (records) {
    copy.customDomain = records.registration.status === "confirmed" ? records.registration.domainName : null;
  }
  return copy;
}

export function memoryDomainStore() {
  const records = new Map<string, DomainRecordSet>();
  const byDomain = new Map<string, string>();
  return {
    records,
    read(orderId: string, actor: DomainActor): DomainRecordSet | null {
      const found = records.get(orderId) ?? null;
      if (!found) return null;
      if (actor.role === "owner" && actor.uid !== found.order.uid) throw new DomainAccessError();
      return found;
    },
    save(next: DomainRecordSet, actor: DomainActor): DomainRecordSet {
      if (actor.role !== "server") throw new DomainAccessError();
      const existingDomain = byDomain.get(next.order.domainName);
      if (existingDomain && existingDomain !== next.order.orderId) throw new DomainAccessError();
      const current = records.get(next.order.orderId);
      if (current && current.order.uid !== next.order.uid) throw new DomainAccessError();
      records.set(next.order.orderId, next);
      byDomain.set(next.order.domainName, next.order.orderId);
      return next;
    },
  };
}

export function firestoreDomainStore(db: Firestore) {
  const actorError = () => new DomainAccessError();
  return {
    async read(orderId: string, actor: DomainActor): Promise<DomainRecordSet | null> {
      const orderSnap = await db.collection(DOMAIN_ORDER_COLLECTION).doc(orderId).get();
      if (!orderSnap.exists) return null;
      const order = orderSnap.data() as DomainOrder;
      if (actor.role === "owner" && actor.uid !== order.uid) throw actorError();
      const [registrantSnap, registrationSnap, provisioningSnap, eventsSnap] = await Promise.all([
        db.collection(DOMAIN_REGISTRANT_COLLECTION).doc(orderId).get(),
        db.collection(DOMAIN_REGISTRATION_COLLECTION).doc(orderId).get(),
        db.collection(DOMAIN_PROVISIONING_COLLECTION).doc(orderId).get(),
        db.collection(DOMAIN_EVENT_COLLECTION).doc(orderId).get(),
      ]);
      if (!registrantSnap.exists || !registrationSnap.exists || !provisioningSnap.exists) return null;
      const events = eventsSnap.exists ? (eventsSnap.data()?.events as DomainEvent[] | undefined) ?? [] : [];
      return {
        order,
        registrant: registrantSnap.data() as DomainRegistrant,
        registration: registrationSnap.data() as DomainRegistration,
        provisioning: provisioningSnap.data() as DomainProvisioning,
        events,
      };
    },
    async save(next: DomainRecordSet, actor: DomainActor): Promise<DomainRecordSet> {
      if (actor.role !== "server") throw actorError();
      const current = await db.collection(DOMAIN_ORDER_COLLECTION).doc(next.order.orderId).get();
      if (current.exists && current.data()?.uid !== next.order.uid) throw actorError();
      const batch = db.batch();
      batch.set(db.collection(DOMAIN_ORDER_COLLECTION).doc(next.order.orderId), next.order);
      batch.set(db.collection(DOMAIN_REGISTRANT_COLLECTION).doc(next.order.orderId), next.registrant);
      batch.set(db.collection(DOMAIN_REGISTRATION_COLLECTION).doc(next.order.orderId), next.registration);
      batch.set(db.collection(DOMAIN_PROVISIONING_COLLECTION).doc(next.order.orderId), { ...next.provisioning, uid: next.order.uid });
      batch.set(db.collection(DOMAIN_EVENT_COLLECTION).doc(next.order.orderId), { uid: next.order.uid, events: next.events });
      const active = hostnameMappings([next]);
      for (const mapping of active) {
        batch.set(db.collection(DOMAIN_HOSTNAME_COLLECTION).doc(mapping.hostname), {
          ...mapping,
          uid: next.order.uid,
          published: next.order.portfolioPublished,
          entitled: next.order.portfolioEntitled,
        });
      }
      await batch.commit();
      return next;
    },
    async list(actor: DomainActor): Promise<DomainRecordSet[]> {
      if (actor.role !== "server") throw actorError();
      const orders = await db.collection(DOMAIN_ORDER_COLLECTION).get();
      const rows = await Promise.all(orders.docs.map((item) => this.read(item.id, actor)));
      return rows.filter((item): item is DomainRecordSet => item !== null);
    },
  };
}

export async function domainFirestore(env: NodeJS.ProcessEnv): Promise<Firestore | null> {
  if (env.VERCEL_ENV?.trim() === "production") {
    const { firebaseAdminFirestore } = await import("./firebaseAdmin");
    return firebaseAdminFirestore(env);
  }
  if (env.FIRESTORE_EMULATOR_HOST?.trim().startsWith("127.0.0.1:") && env.FIREBASE_PROJECT_ID?.trim() === "demo-custom-portfolio") {
    const { getApps, initializeApp } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    const name = "domain-emulator-reader";
    const existing = getApps().find((item) => item.name === name);
    const app = existing ?? initializeApp({ projectId: "demo-custom-portfolio" }, name);
    return getFirestore(app);
  }
  return null;
}

export async function loadVerifiedDomainRecords(env: NodeJS.ProcessEnv): Promise<DomainRecordSet[]> {
  const db = await domainFirestore(env);
  return db ? firestoreDomainStore(db).list({ role: "server" }) : [];
}
