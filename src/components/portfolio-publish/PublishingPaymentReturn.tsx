import { useState } from "react";
import { brand } from "../../config/branding";
import { paymentReturnPurpose, readCheckoutReference } from "../../lib/publishingReturn";
import { PORTFOLIO_DOMAIN_PATH } from "../portfolio-domain/domainSettingsPath";
import { PORTFOLIO_WORKSPACE_PATH } from "../portfolio-workspace/portfolioWorkspacePath";
import { ProductLegalFooter } from "../legal/ProductLegalFooter";
import { Button } from "../ui/Button";
import { PORTFOLIO_PUBLISH_PATH } from "./portfolioPublishPath";
import type { PublishingPaymentReturnOutcome } from "./publishingReturnPath";

type PublishingPaymentReturnProps = {
  outcome: PublishingPaymentReturnOutcome;
  session: "checking" | "signed-in" | "signed-out";
  onOpenPath: (path: string) => void;
};

export function PublishingPaymentReturn({ outcome, session, onOpenPath }: PublishingPaymentReturnProps) {
  const [reference] = useState(() => readCheckoutReference(window.location.search));
  const purpose = paymentReturnPurpose(window.location.search);
  const success = outcome === "success";
  const domain = purpose === "domain";

  return (
    <div
      id={success ? "publishing-payment-success" : "publishing-payment-cancelled"}
      className="flex min-h-screen flex-col overflow-x-hidden bg-[#F3FAF9] font-sans text-[#243838]"
    >
      <header className="border-b border-[#D5E6E5] bg-white">
        <div className="mx-auto w-full max-w-3xl px-5 py-5 sm:px-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">{brand.name}</p>
          <p className="mt-1 text-sm font-semibold">{domain ? "Domain" : "Publishing"}</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8 sm:py-16">
        <article className="max-w-xl rounded-2xl border border-[#D5E6E5] bg-white p-6 shadow-[0_12px_32px_rgba(109,174,173,0.08)] sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">
            {success ? "Payment verification" : "Checkout cancelled"}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.045em] sm:text-4xl">
            {success ? "Returned from checkout" : "Payment was not completed"}
          </h1>
          {success && domain ? (
            <div className="mt-4 space-y-3 text-base leading-relaxed text-[#5C7372]">
              <p>You have returned from domain checkout.</p>
              <p>Payment confirmation is pending.</p>
              <p>Registration starts only after the payment is verified on our server.</p>
              <p>This page does not register your domain.</p>
            </div>
          ) : success ? (
            <div className="mt-4 space-y-3 text-base leading-relaxed text-[#5C7372]">
              <p>You have returned from Bachs checkout.</p>
              <p>Your payment is being verified.</p>
              <p>Publishing access activates only after the payment is verified on our server.</p>
              <p>This page does not publish your portfolio.</p>
            </div>
          ) : domain ? (
            <div className="mt-4 space-y-3 text-base leading-relaxed text-[#5C7372]">
              <p>The domain checkout was cancelled.</p>
              <p>Registration has not started.</p>
              <p>Your portfolio and saved work remain intact.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3 text-base leading-relaxed text-[#5C7372]">
              <p>Checkout was cancelled or not completed.</p>
              <p>Your portfolio and saved work remain intact.</p>
              <p>You can return and try the payment again when you are ready.</p>
            </div>
          )}

          {reference ? (
            <p className="mt-6 text-sm leading-relaxed text-[#5C7372]" data-checkout-reference={reference}>
              Checkout reference <span className="font-semibold text-[#243838]">{reference}</span>. This reference does not confirm payment.
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {session === "checking" ? (
              <p className="text-sm font-medium text-[#5C7372]">Checking your session…</p>
            ) : session === "signed-in" ? (
              success ? (
                <>
                  <Button id="publishing-return-portfolio" className="w-full sm:w-auto" onClick={() => onOpenPath(PORTFOLIO_WORKSPACE_PATH)}>
                    Back to my portfolio
                  </Button>
                  <Button id="publishing-return-publish" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenPath(domain ? PORTFOLIO_DOMAIN_PATH : PORTFOLIO_PUBLISH_PATH)}>
                    {domain ? "Open domain settings" : "Open Publish"}
                  </Button>
                </>
              ) : (
                <>
                  <Button id="publishing-return-pay" className="w-full sm:w-auto" onClick={() => onOpenPath(domain ? PORTFOLIO_DOMAIN_PATH : PORTFOLIO_PUBLISH_PATH)}>
                    {domain ? "Back to domain settings" : "Return to payment"}
                  </Button>
                  <Button id="publishing-return-portfolio" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenPath(PORTFOLIO_WORKSPACE_PATH)}>
                    Back to my portfolio
                  </Button>
                </>
              )
            ) : (
              <Button id="publishing-return-sign-in" className="w-full sm:w-auto" onClick={() => onOpenPath("/auth")}>
                {success ? "Sign in to your portfolio" : "Sign in to try again"}
              </Button>
            )}
          </div>
        </article>
      </main>
      <ProductLegalFooter onOpenPath={onOpenPath} />
    </div>
  );
}
