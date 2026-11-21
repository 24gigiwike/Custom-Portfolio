import { REFUND_POLICY_PATH } from "../../lib/legalPaths";

export function PublishingRefundNotice({ onOpenPath }: { onOpenPath: (path: string) => void }) {
  return (
    <p className="max-w-xl text-sm leading-relaxed text-[#5C7372]">
      Publishing payments are generally non-refundable. Please review our{" "}
      <button
        type="button"
        onClick={() => onOpenPath(REFUND_POLICY_PATH)}
        className="font-semibold text-[#3E7574] underline decoration-[#D5E6E5] underline-offset-2"
      >
        Refund Policy
      </button>{" "}
      before completing your purchase.
    </p>
  );
}
