import React, { useEffect, useRef, useState } from "react";
import { FieldError, fieldClass, StepFrame } from "./StepFrame";
import type { FoundationDraft } from "../../types";
import { imagePhaseLabel, ImageUploadCancelled } from "../../lib/imageAttempt";
import { beginAccountProfileImageUpload, type PortfolioImageUpload } from "../../lib/storage";

interface AboutYouStepProps {
  draft: FoundationDraft;
  errors: { firstName?: string; lastName?: string };
  saveError: string | null;
  isSaving: boolean;
  onChange: (patch: Partial<FoundationDraft>) => void;
  onContinue: () => void;
  onBack: () => void;
}

export const AboutYouStep: React.FC<AboutYouStepProps> = ({
  draft,
  errors,
  saveError,
  isSaving,
  onChange,
  onContinue,
  onBack,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const generationRef = useRef(0);
  const sessionRef = useRef<PortfolioImageUpload | null>(null);
  const localPreviewRef = useRef<string | null>(null);

  const replacePreview = (next: string | null) => {
    if (localPreviewRef.current && localPreviewRef.current !== next) URL.revokeObjectURL(localPreviewRef.current);
    localPreviewRef.current = next;
    setLocalPreview(next);
  };

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      sessionRef.current?.cancel();
      if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    };
  }, []);

  const handleFile = (file: File) => {
    sessionRef.current?.cancel();
    const generation = ++generationRef.current;
    setUploadError(null);
    setIsUploading(true);
    setStatusText("Preparing image…");
    setSelectedFile(file);
    const localUrl = URL.createObjectURL(file);
    replacePreview(localUrl);
    const session = beginAccountProfileImageUpload(file, (status) => {
      if (generationRef.current !== generation) return;
      setStatusText(imagePhaseLabel(status));
    });
    sessionRef.current = session;
    void session.done.then(
      (uploaded) => {
        if (generationRef.current !== generation) return;
        onChange({ photoURL: uploaded.downloadUrl, photoPath: uploaded.storagePath });
        setIsUploading(false);
        setStatusText(null);
        const probe = new Image();
        probe.onload = () => {
          if (generationRef.current !== generation) return;
          if (localPreviewRef.current === localUrl) replacePreview(null);
        };
        probe.onerror = () => {
          // Keep the local preview when the remote picture has not loaded.
        };
        probe.src = uploaded.downloadUrl;
      },
      (error: unknown) => {
        if (generationRef.current !== generation || error instanceof ImageUploadCancelled) return;
        setIsUploading(false);
        setStatusText(null);
        setUploadError(error instanceof Error ? error.message : "Upload failed. Try again.");
      },
    );
  };

  return (
    <StepFrame
      id="onboarding-about"
      kicker="01 — About you"
      title="Tell us about yourself."
      copy="We'll use these details to set up your professional profile."
      onContinue={onContinue}
      onBack={onBack}
      isSaving={isSaving || isUploading}
      saveError={saveError || uploadError}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="group relative h-28 w-28 flex-shrink-0 overflow-hidden rounded-2xl border border-[#D5E6E5] bg-[#F7FBFA]"
          aria-label="Add a profile picture"
        >
          {localPreview || draft.photoURL ? (
            <img src={localPreview || draft.photoURL} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center px-3 text-center text-xs font-semibold text-[#5C7372]">
              Add a photo
            </span>
          )}
        </button>
        <div>
          <p className="text-sm font-semibold text-[#243838]">Profile picture</p>
          <p className="mt-1 text-sm text-[#5C7372]">Optional. A clear portrait is enough.</p>
          <button
            type="button"
            id="profile-picture-button"
            onClick={() => inputRef.current?.click()}
            className="mt-3 text-sm font-bold text-[#3E7574]"
          >
            {isUploading ? (statusText || "Uploading image…") : draft.photoURL || localPreview ? "Replace picture" : "Upload picture"}
          </button>
          {isUploading && statusText && <p className="mt-2 text-sm font-medium text-[#3E7574]">{statusText}</p>}
          {!isUploading && uploadError && selectedFile && (
            <button type="button" className="mt-2 text-sm font-bold text-[#3E7574]" onClick={() => handleFile(selectedFile)}>
              Try again
            </button>
          )}
          <input
            ref={inputRef}
            id="profile-picture-input"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#243838]">First name</span>
          <input
            id="first-name-input"
            value={draft.firstName}
            onChange={(event) => onChange({ firstName: event.target.value })}
            autoComplete="given-name"
            className={fieldClass}
          />
          <FieldError message={errors.firstName} />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#243838]">Last name</span>
          <input
            id="last-name-input"
            value={draft.lastName}
            onChange={(event) => onChange({ lastName: event.target.value })}
            autoComplete="family-name"
            className={fieldClass}
          />
          <FieldError message={errors.lastName} />
        </label>
      </div>
    </StepFrame>
  );
};
