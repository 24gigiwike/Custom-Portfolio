import React, { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { brand } from "../../../config/branding";
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
  LogOut,
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
  const { user, signOutUser, status } = useAuth();
  const isSigningOut = status === "unauthenticated";

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
    <div
      id="profile-editor-screen"
      className="relative min-h-screen w-full flex flex-col justify-between items-center px-6 sm:px-12 py-10 sm:py-12 bg-[#F8F8F7] text-[#1A1A1B] selection:bg-[#6DAEAD]/20 overflow-x-hidden"
    >
      {/* Foundation Accent Bar */}
      <div className="fixed left-0 top-0 w-1 h-full bg-gradient-to-b from-[#708595] to-[#6DAEAD] z-30 pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-5xl flex items-baseline justify-between pt-2 pb-6 border-b border-[#E5E5E1]">
        <div className="flex items-baseline gap-3">
          <div className="text-[20px] font-medium tracking-[-0.03em] text-[#1A1A1B]">
            {brand.name}
          </div>
          <div className="font-support text-[11px] uppercase tracking-[0.15em] text-[#708595] hidden sm:block">
            {brand.endorsement}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            id="back-to-workspace-top-button"
            onClick={onBackToWorkspace}
            className="flex items-center gap-1.5 text-xs text-[#708595] hover:text-[#1A1A1B] transition-colors duration-150"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Workspace</span>
          </button>
          <span className="text-[#E5E5E1] font-light">|</span>
          <button
            type="button"
            id="editor-signout-button"
            onClick={signOutUser}
            disabled={isSigningOut}
            className="flex items-center gap-1.5 text-xs text-[#708595] hover:text-[#1A1A1B] transition-colors duration-150"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-5xl flex-1 flex flex-col my-8 sm:my-10">
        {/* Editor Title & Status Ribbon */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 mb-8 border-b border-[#E5E5E1]"
        >
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="font-support text-[11px] uppercase tracking-[0.15em] text-[#708595]">
                Profile Builder
              </span>
              <span className="text-[#E5E5E1] font-light">•</span>
              {profileIsComplete ? (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase font-support tracking-[0.1em] text-[#388E6D] bg-[#F0FDF4] px-2 py-0.5 rounded-[2px] border border-[#DCFCE7]">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Profile Complete
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase font-support tracking-[0.1em] text-[#708595] bg-[#F0F2F2] px-2 py-0.5 rounded-[2px] border border-[#E5E5E1]">
                  Profile In Progress
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-light text-[#1A1A1B] tracking-[-0.03em] mb-1">
              Let's build your presence.
            </h1>
            <p className="text-xs sm:text-sm text-[#708595] font-light">
              Start with the information people see first. Tell people who you are.
            </p>
          </div>

          {/* Action Bar (Top) */}
          <div className="flex items-center gap-3">
            <SaveStatus status={saveStatus} errorMessage={errorMessage} />
            <Button
              id="top-save-profile-button"
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

        {/* Global Error Banner if write fails */}
        {saveStatus === "error" && errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full bg-[#FEF2F2] border border-[#FEE2E2] rounded-[2px] p-4 mb-6 text-xs text-[#B91C1C] flex items-center justify-between gap-3"
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
        <div className="w-full space-y-8">
          {/* 01. Identity */}
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

          {/* 02. Hero & Narrative */}
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

          {/* 03. Direct Contact */}
          <ContactSection
            email={email}
            authEmail={user?.email}
            error={fieldErrors.email}
            onEmailChange={(val) => {
              setEmail(val);
              if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: "" });
            }}
          />

          {/* 04. Social Channels */}
          <SocialLinksSection
            socialLinks={socialLinks}
            onChange={setSocialLinks}
          />

          {/* 05. Availability */}
          <AvailabilitySection
            availability={availability}
            onChange={setAvailability}
          />
        </div>

        {/* Bottom Actions Footer Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full mt-10 pt-6 border-t border-[#E5E5E1] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4"
        >
          <button
            type="button"
            id="back-to-workspace-bottom-button"
            onClick={onBackToWorkspace}
            className="flex items-center justify-center sm:justify-start gap-2 text-xs text-[#708595] hover:text-[#1A1A1B] font-medium transition-colors"
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
                className="opacity-60 cursor-not-allowed"
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

      {/* Legal Footer */}
      <footer className="w-full max-w-5xl flex flex-col sm:flex-row items-center justify-between text-[10px] sm:text-[11px] uppercase tracking-[0.12em] text-[#849693] pt-6 border-t border-[#E5E5E1] gap-3">
        <div>&copy; 2024 BroadBrand. All Rights Reserved.</div>
        <div className="font-support">{brand.endorsement}</div>
      </footer>
    </div>
  );
};
