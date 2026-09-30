import React, { useRef, useState } from "react";
import { FieldError, fieldClass, StepFrame } from "./StepFrame";
import type { FoundationDraft } from "../../types";
import { deleteStoredImage, uploadAccountProfileImage } from "../../lib/storage";

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

  const handleFile = async (file: File) => {
    setUploadError(null);
    setIsUploading(true);
    const previousPath = draft.photoPath;
    try {
      const uploaded = await uploadAccountProfileImage(file);
      onChange({ photoURL: uploaded.downloadUrl, photoPath: uploaded.storagePath });
      if (previousPath && previousPath !== uploaded.storagePath) {
        void deleteStoredImage(previousPath).catch((error) => {
          console.error("Previous profile image cleanup failed:", error);
        });
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Couldn't upload this picture. Try again.");
    } finally {
      setIsUploading(false);
    }
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
          {draft.photoURL ? (
            <img src={draft.photoURL} alt="" className="h-full w-full object-cover" />
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
            {isUploading ? "Uploading…" : draft.photoURL ? "Replace picture" : "Upload picture"}
          </button>
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
