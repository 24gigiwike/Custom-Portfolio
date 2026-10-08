import React from "react";
import { motion } from "motion/react";
import { AlertCircle } from "lucide-react";
import { Button } from "../ui/Button";

interface StepFrameProps {
  id: string;
  kicker: string;
  title: string;
  copy: string;
  children: React.ReactNode;
  onContinue: () => void;
  continueLabel?: string;
  onBack?: () => void;
  isSaving?: boolean;
  saveError?: string | null;
}

export const StepFrame: React.FC<StepFrameProps> = ({
  id,
  kicker,
  title,
  copy,
  children,
  onContinue,
  continueLabel = "Continue",
  onBack,
  isSaving = false,
  saveError,
}) => {
  return (
    <motion.form
      id={id}
      onSubmit={(event) => {
        event.preventDefault();
        onContinue();
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">{kicker}</p>
      <h1 className="mt-3 max-w-xl text-4xl font-bold leading-[1.05] tracking-[-0.045em] text-[#243838] sm:text-5xl">
        {title}
      </h1>
      <p className="mt-4 max-w-lg text-base font-medium leading-relaxed text-[#5C7372]">{copy}</p>
      <div className="mt-8">{children}</div>
      {saveError && (
        <p className="mt-5 flex items-start gap-2 text-sm font-medium text-[#B93838]">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{saveError}</span>
        </p>
      )}
      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack} disabled={isSaving} id={`${id}-back`}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" size="lg" isLoading={isSaving} id={`${id}-continue`} className="w-full sm:w-auto">
          {continueLabel}
        </Button>
      </div>
    </motion.form>
  );
};

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-2 text-sm font-medium text-[#B93838]" role="alert">{message}</p>;
}

export const fieldClass =
  "w-full rounded-xl border border-[#D5E6E5] bg-white px-4 py-3 text-base text-[#243838] outline-none transition focus:border-[#6DAEAD] focus-visible:ring-2 focus-visible:ring-[#6DAEAD] focus-visible:ring-offset-2";
