import React, { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { useAuth } from "../../../lib/authContext";
import { Button } from "../../ui/Button";
import { SaveStatus, type SaveState } from "./SaveStatus";
import { IdentitySection } from "./IdentitySection";
import { HeroSection } from "./HeroSection";
import { ContactSection } from "./ContactSection";
import { SocialLinksSection } from "./SocialLinksSection";
import { AvailabilitySection } from "./AvailabilitySection";
import {
  updatePortfolioProfile,
  isProfileComplete,
} from "../../../lib/portfolio";
import {
  ArrowLeft,
  Save,
  Eye,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type {
  Portfolio,
  PortfolioAvailability,
  PortfolioSocialLinks,
} from "../../../types/portfolio";

interface ProfileEditorProps {
  portfolio: Portfolio;
  onBackToWorkspace: () => void;
  onSaveSuccess: (updated: Portfolio) => void;
}

export const ProfileEditor: React.FC<ProfileEditorProps> = ({
  portfolio,
  onBackToWorkspace,
  onSaveSuccess,
}) => {
  const { user } = useAuth();

  // Form State initialized from current portfolio
  const [title, setTitle] = useState(portfolio.title || "");
  const [profession, setProfession] = useState(portfolio.profession || "");
  const [location, setLocation] = useState(portfolio.location || "");
  const [profileImage, setProfileImage] = useState<string | null>(
    portfolio.profileImage || user?.photoURL || null
  );
  const [headline, setHeadline] = useState(portfolio.headline || "");
  const [bio, setBio] = useState(portfolio.bio || "");
  const [availability, setAvailability] = useState<PortfolioAvailability>(
    portfolio.availability || "Available for work"
  );
  const [email, setEmail] = useState(portfolio.email || user?.email || "");
  const [socialLinks, setSocialLinks] = useState<PortfolioSocialLinks>(
    portfolio.socialLinks || {}
  );

  // Status & Error States
  const [saveStatus, setSaveStatus] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Detect dirty / unsaved changes
  const isDirty = useMemo(() => {
    if (title !== (portfolio.title || "")) return true;
    if (profession !== (portfolio.profession || "")) return true;
    if (location !== (portfolio.location || "")) return true;
    if (profileImage !== (portfolio.profileImage || null)) return true;
    if (headline !== (portfolio.headline || "")) return true;
    if (bio !== (portfolio.bio || "")) return true;
    if (availability !== (portfolio.availability || "Available for work")) return true;
    if (email !== (portfolio.email || "")) return true;

    // Compare social links
    const currentSocials = portfolio.socialLinks || {};
    const keys = ["website", "linkedin", "github", "instagram", "twitter", "x", "other"] as const;
    for (const key of keys) {
      const currentVal = currentSocials[key] || "";
      const newVal = socialLinks[key] || "";
      if (currentVal !== newVal) return true;
    }

    return false;
  }, [
    title,
    profession,
    location,
    profileImage,
    headline,
    bio,
    availability,
    email,
    socialLinks,
    portfolio,
  ]);

  // Update saveStatus when user edits
  useEffect(() => {
    if (isDirty && saveStatus !== "saving") {
      setSaveStatus("unsaved");
    } else if (!isDirty && saveStatus === "unsaved") {
      setSaveStatus("idle");
    }
  }, [isDirty, saveStatus]);

  // Check completion status for live badge
  const profileIsComplete = useMemo(() => {
    return isProfileComplete({
      title,
      profession,
      headline,
      bio,
      email,
    });
  }, [title, profession, headline, bio, email]);

  // Validate form fields
  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!title.trim()) {
      errors.title = "Please provide your name or display title.";
    }

    if (!profession.trim()) {
      errors.profession = "Please specify your profession or core role.";
    }

    if (!headline.trim()) {
      errors.headline = "Hero headline is required.";
    }

    if (!bio.trim()) {
      errors.bio = "A short professional introduction is required.";
    }

    if (!email.trim()) {
      errors.email = "Contact email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Please enter a valid email address.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save handler
  const handleSave = async () => {
    if (!validate()) {
      setSaveStatus("error");
      setErrorMessage("Please review the highlighted required fields.");
      return;
    }

    setSaveStatus("saving");
    setErrorMessage(null);

    try {
      await updatePortfolioProfile(portfolio.id, {
        title: title.trim(),
        profession: profession.trim(),
        location: location.trim(),
        profileImage,
        headline: headline.trim(),
        bio: bio.trim(),
        availability,
        email: email.trim(),
        socialLinks,
      });

      // Construct updated portfolio representation
      const updatedPortfolio: Portfolio = {
        ...portfolio,
        title: title.trim(),
        profession: profession.trim(),
        location: location.trim() || undefined,
        profileImage,
        headline: headline.trim(),
        bio: bio.trim(),
        availability,
        email: email.trim(),
        socialLinks,
        updatedAt: new Date().toISOString(),
      };

      onSaveSuccess(updatedPortfolio);
      setSaveStatus("saved");

      // Reset saved state after a few seconds if no further edits
      setTimeout(() => {
        setSaveStatus((prev) => (prev === "saved" ? "idle" : prev));
      }, 4000);
    } catch (err) {
      console.error("Failed to update portfolio profile:", err);
      setSaveStatus("error");
      setErrorMessage("We couldn't save your changes. Please try again.");
    }
  };

  return (
    <div id="profile-editor-screen" className="text-[#243838]">
      <main className="flex w-full flex-col">
        {/* Editor Title & Status Ribbon */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 flex w-full flex-col justify-between gap-4 rounded-[28px] bg-[#6DAEAD] p-6 text-white sm:p-8 md:flex-row md:items-end"
        >
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                id="back-to-workspace-top-button"
                onClick={onBackToWorkspace}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-white/85 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Overview
              </button>
              {profileIsComplete ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em]">
                  <CheckCircle2 className="h-3 w-3" />
                  Profile complete
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em]">
                  In progress
                </span>
              )}
            </div>

            <h1 className="mb-1 text-3xl font-bold tracking-[-0.045em] sm:text-5xl">
              Let&apos;s build your presence.
            </h1>
            <p className="text-sm font-medium text-white/85">
              Start with the information people see first.
            </p>
          </div>

          {/* Action Bar (Top) */}
          <div className="flex items-center gap-3">
            <SaveStatus status={saveStatus} errorMessage={errorMessage} />
            <Button
              id="top-save-profile-button"
              variant="secondary"
              size="md"
              leftIcon={<Save className="w-3.5 h-3.5" />}
              isLoading={saveStatus === "saving"}
              onClick={handleSave}
              disabled={saveStatus === "saving"}
              className="bg-white text-[#2F6463] shadow-none hover:bg-[#F4FBFA]"
            >
              Save changes
            </Button>
          </div>
        </motion.div>

        {/* Global Error Banner if write fails */}
        {saveStatus === "error" && errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex w-full items-center justify-between gap-3 rounded-2xl border border-[#F3C7C7] bg-[#FFF6F6] p-4 text-sm font-medium text-[#B93838]"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={handleSave}
              className="font-medium underline hover:text-[#991B1B] text-nowrap"
            >
              Try again
            </button>
          </motion.div>
        )}

        {/* Editor Sections Stack */}
        <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-12">
          <IdentitySection
            title={title}
            profession={profession}
            location={location}
            profileImage={profileImage}
            errors={fieldErrors}
            onTitleChange={(val) => {
              setTitle(val);
              if (fieldErrors.title) setFieldErrors({ ...fieldErrors, title: "" });
            }}
            onProfessionChange={(val) => {
              setProfession(val);
              if (fieldErrors.profession) setFieldErrors({ ...fieldErrors, profession: "" });
            }}
            onLocationChange={setLocation}
            onProfileImageChange={setProfileImage}
          />
          </div>

          <div className="lg:col-span-7">
          <HeroSection
            headline={headline}
            bio={bio}
            errors={fieldErrors}
            onHeadlineChange={(val) => {
              setHeadline(val);
              if (fieldErrors.headline) setFieldErrors({ ...fieldErrors, headline: "" });
            }}
            onBioChange={(val) => {
              setBio(val);
              if (fieldErrors.bio) setFieldErrors({ ...fieldErrors, bio: "" });
            }}
          />
          </div>

          <div className="lg:col-span-5">
          <ContactSection
            email={email}
            authEmail={user?.email}
            error={fieldErrors.email}
            onEmailChange={(val) => {
              setEmail(val);
              if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: "" });
            }}
          />
          </div>

          <div className="lg:col-span-7">
          <SocialLinksSection
            socialLinks={socialLinks}
            onChange={setSocialLinks}
          />
          </div>

          <div className="lg:col-span-5">
          <AvailabilitySection
            availability={availability}
            onChange={setAvailability}
          />
          </div>
        </div>

        {/* Bottom Actions Footer Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 flex w-full flex-col items-stretch justify-between gap-4 rounded-[28px] border border-white/80 bg-white/75 p-4 shadow-[0_10px_30px_rgba(109,174,173,0.08)] backdrop-blur-xl sm:flex-row sm:items-center"
        >
          <button
            type="button"
            id="back-to-workspace-bottom-button"
            onClick={onBackToWorkspace}
            className="flex items-center justify-center gap-2 text-sm font-bold text-[#3E7574] transition-colors hover:text-[#243838] sm:justify-start"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to workspace</span>
          </button>

          <div className="flex items-center justify-end gap-3 flex-wrap">
            <SaveStatus status={saveStatus} errorMessage={errorMessage} />

            {/* Preview Button (Disabled / reserved for future phases with explicit tooltip) */}
            <div className="relative group">
              <Button
                id="profile-preview-button"
                variant="outline"
                size="md"
                leftIcon={<Eye className="w-3.5 h-3.5" />}
                disabled={true}
                className="cursor-not-allowed opacity-60"
                title="Full portfolio preview engine arrives in subsequent phases"
              >
                Preview
              </Button>
            </div>

            <Button
              id="bottom-save-profile-button"
              variant="primary"
              size="md"
              leftIcon={<Save className="w-3.5 h-3.5" />}
              isLoading={saveStatus === "saving"}
              onClick={handleSave}
              disabled={saveStatus === "saving"}
            >
              Save changes
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
};
