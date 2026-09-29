import React from "react";
import { Check, AlertCircle, Loader2 } from "lucide-react";

export type SaveState = "idle" | "unsaved" | "saving" | "saved" | "error";

interface SaveStatusProps {
  status: SaveState;
  errorMessage?: string | null;
}

export const SaveStatus: React.FC<SaveStatusProps> = ({ status, errorMessage }) => {
  if (status === "idle") {
    return null;
  }

  if (status === "unsaved") {
    return (
      <span
        id="save-status-unsaved"
        className="inline-flex items-center gap-1.5 font-support text-[11px] uppercase tracking-[0.12em] text-[#5C7372] bg-[#E7F4F3] px-2.5 py-1 rounded-2xl border border-[#D5E6E5]"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#5C7372]" />
        Unsaved changes
      </span>
    );
  }

  if (status === "saving") {
    return (
      <span
        id="save-status-saving"
        className="inline-flex items-center gap-1.5 font-support text-[11px] uppercase tracking-[0.12em] text-[#6DAEAD] bg-[#E7F4F3] px-2.5 py-1 rounded-2xl border border-[#6DAEAD]/30"
      >
        <Loader2 className="w-3 h-3 animate-spin text-[#6DAEAD]" />
        Saving changes
      </span>
    );
  }

  if (status === "saved") {
    return (
      <span
        id="save-status-saved"
        className="inline-flex items-center gap-1.5 font-support text-[11px] uppercase tracking-[0.12em] text-[#388E6D] bg-[#F0FDF4] px-2.5 py-1 rounded-2xl border border-[#DCFCE7]"
      >
        <Check className="w-3 h-3 text-[#388E6D]" />
        Saved
      </span>
    );
  }

  if (status === "error") {
    return (
      <span
        id="save-status-error"
        className="inline-flex items-center gap-1.5 font-support text-[11px] uppercase tracking-[0.12em] text-[#B93838] bg-[#FFF6F6] px-2.5 py-1 rounded-2xl border border-[#F3C7C7]"
        title={errorMessage || "We couldn't save your changes."}
      >
        <AlertCircle className="w-3 h-3 text-[#B93838]" />
        Failed to save
      </span>
    );
  }

  return null;
};
