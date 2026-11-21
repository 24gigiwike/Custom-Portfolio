import type { ReactNode } from "react";
import { brand } from "../../config/branding";
import {
  PRIVACY_POLICY_PATH,
  REFUND_POLICY_PATH,
  REFUND_POLICY_UPDATED,
  TERMS_PATH,
} from "../../lib/legalPaths";
import { ProductLegalFooter } from "./ProductLegalFooter";

function LinkButton({
  onOpenPath,
  path,
  children,
}: {
  onOpenPath: (path: string) => void;
  path: string;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenPath(path)}
      className="font-semibold text-[#3E7574] underline decoration-[#D5E6E5] underline-offset-2"
    >
      {children}
    </button>
  );
}

function Page({
  kicker,
  title,
  children,
  onOpenPath,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
  onOpenPath: (path: string) => void;
}) {
  return (
    <div className="min-h-screen bg-[#F3FAF9] font-sans text-[#243838]">
      <header className="border-b border-[#D5E6E5] bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-baseline justify-between px-5 py-5 sm:px-8">
          <p className="text-lg font-bold tracking-[-0.04em] text-[#3E7574]">{brand.name}</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6E8887]">{brand.endorsement}</p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">{kicker}</p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.045em] sm:text-5xl">{title}</h1>
        <div className="mt-8 max-w-2xl space-y-8 text-sm leading-relaxed text-[#5C7372]">{children}</div>
      </main>
      <ProductLegalFooter onOpenPath={onOpenPath} />
    </div>
  );
}

export function LegalDocumentPage({
  path,
  onOpenPath,
}: {
  path: string;
  onOpenPath: (path: string) => void;
}) {
  if (path === REFUND_POLICY_PATH) {
    return (
      <Page kicker="Publishing" title="Refund Policy" onOpenPath={onOpenPath}>
        <p>Last updated {REFUND_POLICY_UPDATED}.</p>
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-[-0.03em] text-[#243838]">Annual publishing</h2>
          <p>
            Custom Portfolio publishing costs ₦10,000 for 12 months on one portfolio. The charge is a one-time payment.
            Custom Portfolio does not deduct renewal payments automatically. When a term is due, you renew it yourself.
          </p>
          <p>Please read the plan, the price, and this policy before you continue to payment.</p>
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-[-0.03em] text-[#243838]">Publishing payments</h2>
          <p>
            Publishing payments are generally non-refundable. That includes a payment made early, before the current
            term has ended. Time you do not use is also generally non-refundable.
          </p>
          <p>
            Changing your mind, deciding not to publish, or leaving a portfolio unpublished does not ordinarily qualify
            for a refund.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-[-0.03em] text-[#243838]">When a payment is reversed</h2>
          <p>
            This policy does not override mandatory consumer rights or other remedies required by Nigerian law.
            A duplicate charge, a payment taken in error, a reversal by the payment provider, or a confirmed fraudulent
            transaction is handled from the payment record, not from a request alone.
          </p>
          <p>
            Asking for a refund does not cancel the payment and does not remove publishing access. Access changes only
            after the payment provider confirms that the money was refunded or reversed.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-[-0.03em] text-[#243838]">Contact</h2>
          <p>
            For questions about a publishing payment, duplicate charges or payment issues, contact our support team on WhatsApp.
          </p>
          <p>
            <a
              href="https://wa.me/2347060706416"
              className="font-semibold text-[#3E7574] underline decoration-[#D5E6E5] underline-offset-2"
            >
              Contact support on WhatsApp
            </a>
          </p>
        </section>
      </Page>
    );
  }

  if (path === TERMS_PATH) {
    return (
      <Page kicker="Legal" title="Terms & Conditions" onOpenPath={onOpenPath}>
        <p>
          Custom Portfolio publishing is a one-time plan of ₦10,000 for 12 months on the portfolio you select.
          Renewal is manual, and there are no automatic deductions. The{" "}
          <LinkButton onOpenPath={onOpenPath} path={REFUND_POLICY_PATH}>Refund Policy</LinkButton>{" "}
          explains when a publishing payment can be returned.
        </p>
        <p>
          These terms do not remove rights that Nigerian law requires. This page does not add contract terms beyond
          the publishing plan shown before payment.
        </p>
      </Page>
    );
  }

  return (
    <Page kicker="Legal" title="Privacy Policy" onOpenPath={onOpenPath}>
      <p>
        Custom Portfolio has not published a separate privacy policy in this application. This page does not add
        collection, retention, or processing terms.
      </p>
      <p>
        Publishing payments are explained in the{" "}
        <LinkButton onOpenPath={onOpenPath} path={REFUND_POLICY_PATH}>Refund Policy</LinkButton>.
      </p>
    </Page>
  );
}
