import React, { useEffect, useState } from "react";
import { FieldError, fieldClass } from "../onboarding/StepFrame";
import type { ImageUploadStatus } from "../../lib/storage";

type ImageFieldProps = {
  id: string;
  label: string;
  hint: string;
  value: string;
  error?: string;
  status: ImageUploadStatus | null;
  disabled?: boolean;
  shape: "portrait" | "logo" | "share";
  onUpload: (file: File) => void;
  onValueChange: (value: string) => void;
};

export function imageStatusLabel(status: ImageUploadStatus | null): string | null {
  if (!status) return null;
  if (status.phase === "preparing") return "Preparing image…";
  if (status.phase === "optimizing") return "Optimizing…";
  if (status.phase === "uploading") {
    return status.percent === null ? "Uploading…" : `Uploading ${status.percent}%…`;
  }
  if (status.phase === "ready") return "Ready";
  return null;
}

export function ImageField({
  id,
  label,
  hint,
  value,
  error,
  status,
  disabled = false,
  shape,
  onUpload,
  onValueChange,
}: ImageFieldProps) {
  const [mode, setMode] = useState<"upload" | "link">(value && !value.startsWith("https://firebasestorage.googleapis.com") && !value.includes("/portfolio-assets/") ? "link" : "upload");
  const busy = status?.phase === "preparing" || status?.phase === "optimizing" || status?.phase === "uploading";
  const statusText = imageStatusLabel(status);

  return (
    <div className="min-w-0">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <div className="flex flex-col gap-2 sm:flex-row">
        <ModeButton id={`${id}-upload-mode`} pressed={mode === "upload"} disabled={disabled || busy} onClick={() => setMode("upload")}>
          Upload from device
        </ModeButton>
        <ModeButton id={`${id}-link-mode`} pressed={mode === "link"} disabled={disabled || busy} onClick={() => setMode("link")}>
          Use image link
        </ModeButton>
      </div>

      <div className="mt-4 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
        <ImagePreview src={value} shape={shape} />
        <div className="min-w-0 flex-1">
          {mode === "upload" ? (
            <label className="inline-flex h-11 max-w-full cursor-pointer items-center rounded-xl border border-[#D5E6E5] bg-white px-5 text-sm font-bold tracking-[-0.02em]">
              {busy ? statusText : value ? "Replace image" : "Choose image"}
              <input
                id={id}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                disabled={disabled || busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) onUpload(file);
                }}
              />
            </label>
          ) : (
            <label className="block min-w-0">
              <span className="mb-2 block text-sm font-semibold">Image URL</span>
              <input
                id={`${id}-url`}
                className={fieldClass}
                value={value}
                inputMode="url"
                autoComplete="off"
                placeholder="https://"
                disabled={disabled || busy}
                onChange={(event) => onValueChange(event.target.value)}
              />
            </label>
          )}
          {statusText && <p className="mt-2 text-sm font-medium text-[#3E7574]" aria-live="polite">{statusText}</p>}
          <p className="mt-2 break-words text-sm leading-relaxed text-[#5C7372]">{hint}</p>
          <FieldError message={error} />
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  id,
  pressed,
  disabled,
  onClick,
  children,
}: {
  id: string;
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      id={id}
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`h-11 w-full rounded-xl px-4 text-sm font-bold tracking-[-0.02em] sm:w-auto ${
        pressed ? "bg-[#243838] text-white" : "border border-[#D5E6E5] bg-white text-[#243838]"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {children}
    </button>
  );
}

function ImagePreview({ src, shape }: { src: string; shape: "portrait" | "logo" | "share" }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [src]);

  const frame = shape === "portrait" ? "h-20 w-20 rounded-full" : shape === "share" ? "h-20 w-36 rounded-lg" : "h-16 w-28";
  if (!src) return <div className={`${frame} shrink-0 bg-[#E7F3F2]`} />;
  if (broken) {
    return (
      <div className={`${frame} flex shrink-0 items-center justify-center bg-[#E7F3F2] px-2 text-center text-[11px] font-medium leading-tight text-[#5C7372]`}>
        Image unavailable
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className={`${frame} shrink-0 bg-[#E7F3F2] ${shape === "logo" ? "object-contain" : "object-cover"}`}
      onError={() => setBroken(true)}
    />
  );
}
