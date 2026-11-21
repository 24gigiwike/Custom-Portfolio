import React, { useState } from "react";
import { DOMAIN_CUSTOMER_LABELS, type DomainCustomerState } from "../../lib/domainProgress";
import { auth } from "../../lib/firebase";
import { getPortfolioByOwner } from "../../lib/userPortfolio";
import { Button } from "../ui/Button";

type DomainSettingsProps = {
  onOpenPath: (path: string) => void;
  state?: DomainCustomerState | null;
};

type Quote = {
  available: boolean;
  currency: string | null;
  customerAmount: string | null;
  period: number | null;
  checkoutReady?: boolean;
  registrarCurrency?: string | null;
  registrarAmount?: string | null;
  exchangeRate?: string | null;
};

const ORDER = [
  "awaiting-payment",
  "payment-verified",
  "registration-pending",
  "registration-processing",
  "registration-failed",
  "registered",
  "configuring-dns",
  "verifying-nameservers",
  "provisioning-ssl",
  "connected",
  "renewal-due",
  "expired",
  "provisioning-failed",
] as const satisfies readonly DomainCustomerState[];

const EMPTY_REGISTRANT = {
  firstName: "",
  lastName: "",
  email: "",
  address: "",
  city: "",
  state: "",
  postalCode: "",
  country: "NG",
  phoneCountryCode: "234",
  phone: "",
};

async function authorizedPost(path: string, body: unknown): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in before searching for a domain.");
  const token = await user.getIdToken();
  return fetch(path, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function DomainSettings({ onOpenPath, state = null }: DomainSettingsProps) {
  const [domainName, setDomainName] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [selected, setSelected] = useState("");
  const [registrant, setRegistrant] = useState(EMPTY_REGISTRANT);
  const [orderId, setOrderId] = useState("");
  const [progress, setProgress] = useState<DomainCustomerState | null>(state);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const search = async () => {
    setBusy(true);
    setMessage("");
    setQuote(null);
    try {
      const response = await authorizedPost("/api/domain-search", { domainName });
      const body = await response.json() as Quote & { error?: string };
      if (!response.ok) {
        setMessage(body.error ?? "Domain search is not available right now.");
        return;
      }
      setQuote(body);
      setSelected(body.available ? domainName.trim().toLowerCase() : "");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Domain search is not available right now.");
    } finally {
      setBusy(false);
    }
  };

  const createOrder = async () => {
    setBusy(true);
    setMessage("");
    try {
      const lookup = await getPortfolioByOwner();
      if (lookup.status !== "ready") {
        setMessage("Open your portfolio before ordering a domain.");
        return;
      }
      const response = await authorizedPost("/api/domain-order", {
        portfolioId: lookup.portfolio.id,
        domainName: selected,
        registrant,
      });
      const body = await response.json() as { orderId?: string; state?: DomainCustomerState; error?: string; currency?: string; customerAmount?: string };
      if (!response.ok || !body.orderId) {
        setMessage(body.error ?? "The domain order could not be saved.");
        return;
      }
      if (body.currency && body.customerAmount) {
        setQuote((current) => current ? { ...current, currency: body.currency ?? null, customerAmount: body.customerAmount ?? null, checkoutReady: body.currency === "NGN" } : current);
      }
      setOrderId(body.orderId);
      if (body.state) setProgress(body.state);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "The domain order could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await authorizedPost("/api/domain-checkout", { orderId });
      const body = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok || !body.checkoutUrl) {
        setMessage(body.error ?? "Domain payment is not available right now.");
        return;
      }
      window.location.assign(body.checkoutUrl);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Domain payment is not available right now.");
    } finally {
      setBusy(false);
    }
  };

  const naira = quote?.currency === "NGN" && Boolean(quote.customerAmount) && quote.checkoutReady !== false;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 bg-[#F3FAF9] px-6 py-10 text-[#243838]">
      <header>
        <p className="text-sm font-semibold text-[#3E7574]">Custom Portfolio</p>
        <h1 className="mt-2 text-3xl font-semibold">Domain settings</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5C7372]">
          Search for a domain, then pay through a separate domain payment. Publishing a portfolio does not register a domain, and returning from payment does not connect it.
        </p>
      </header>
      <form className="rounded-2xl bg-white p-6 shadow-sm" onSubmit={(event) => { event.preventDefault(); void search(); }}>
        <label className="block text-sm font-semibold" htmlFor="domain-name">Domain name</label>
        <input
          id="domain-name"
          value={domainName}
          onChange={(event) => setDomainName(event.target.value)}
          className="mt-2 w-full rounded-xl border border-[#D5E6E5] px-3 py-2"
          autoComplete="off"
          placeholder="name.com.ng"
        />
        <Button type="submit" className="mt-4" disabled={busy || domainName.trim() === ""}>
          Search availability
        </Button>
        {quote ? (
          <p className="mt-3 text-sm text-[#5C7372]">
            {quote.available
              ? `${selected} is available${quote.customerAmount ? ` for ${quote.currency} ${quote.customerAmount}` : ""}.`
              : "That domain is not available."}
            {quote.available && quote.registrarCurrency === "USD" && quote.registrarAmount
              ? ` Registrar price ${quote.registrarCurrency} ${quote.registrarAmount}${quote.exchangeRate ? ` at ${quote.exchangeRate} NGN per USD` : ""}.`
              : ""}
          </p>
        ) : null}
        {quote?.available && !naira ? (
          <p className="mt-2 text-sm text-[#5C7372]">Checkout stays closed because a current USD to NGN rate is not available. No naira amount was invented.</p>
        ) : null}
      </form>
      {selected ? (
        <form className="rounded-2xl bg-white p-6 shadow-sm" onSubmit={(event) => { event.preventDefault(); void createOrder(); }}>
          <h2 className="text-lg font-semibold">Registrant</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {([
              ["firstName", "First name"],
              ["lastName", "Last name"],
              ["email", "Email"],
              ["phone", "Phone"],
              ["address", "Address"],
              ["city", "City"],
              ["state", "State"],
              ["postalCode", "Postal code"],
            ] as const).map(([key, label]) => (
              <label key={key} className="block text-sm font-semibold">
                {label}
                <input
                  value={registrant[key]}
                  onChange={(event) => setRegistrant((current) => ({ ...current, [key]: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[#D5E6E5] px-3 py-2 font-normal"
                  autoComplete="off"
                />
              </label>
            ))}
          </div>
          <Button type="submit" className="mt-4" disabled={busy}>Save domain order</Button>
          <Button type="button" className="ml-3 mt-4" disabled={busy || !orderId || !naira} onClick={() => void pay()}>
            Pay for this domain
          </Button>
        </form>
      ) : null}
      {message ? <p className="text-sm text-[#5C7372]">{message}</p> : null}
      <section aria-live="polite" className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Connection progress</h2>
        <p className="mt-2 text-sm text-[#5C7372]">{progress ? DOMAIN_CUSTOMER_LABELS[progress] : "No domain order is in progress."}</p>
        <ul className="mt-4 space-y-2 text-sm">
          {ORDER.map((item) => (
            <li key={item} data-state={item} className={item === progress ? "font-semibold text-[#3E7574]" : "text-[#5C7372]"}>
              {DOMAIN_CUSTOMER_LABELS[item]}
            </li>
          ))}
        </ul>
      </section>
      <button type="button" className="self-start text-sm font-semibold text-[#3E7574]" onClick={() => onOpenPath("/portfolio/publish")}>
        Back to publishing
      </button>
    </main>
  );
}
