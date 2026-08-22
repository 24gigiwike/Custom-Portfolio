import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { brand } from "../../config/branding";
import { useAuth } from "../../lib/authContext";
import { createPortfolio } from "../../lib/portfolio";
import { StylePresetSelector } from "./StylePresetSelector";
import { Button } from "../ui/Button";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Mail,
  Globe,
  Linkedin,
  Github,
  Instagram,
  Twitter,
  Link as LinkIcon,
  Check,
} from "lucide-react";
import type {
  Portfolio,
  PortfolioStylePreset,
  PortfolioAvailability,
  PortfolioSocialLinks,
} from "../../types/portfolio";

interface PortfolioSetupProps {
  onSuccess: (portfolio: Portfolio) => void;
  onCancel: () => void;
}

const AVAILABILITY_OPTIONS: { id: PortfolioAvailability; label: string; desc: string }[] = [
  {
    id: "Available for work",
    label: "Available for work",
    desc: "Actively taking on new contracts, full-time roles, or advisory projects.",
  },
  {
    id: "Open to opportunities",
    label: "Open to opportunities",
    desc: "Selective inquiries and compelling propositions are welcome.",
  },
  {
    id: "Currently unavailable",
    label: "Currently unavailable",
    desc: "Fully committed to current engagements; accepting connection requests only.",
  },
];

export const PortfolioSetup: React.FC<PortfolioSetupProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { user, userAccount } = useAuth();

  const [step, setStep] = useState<number>(1);

  // Setup form states
  const [title, setTitle] = useState(userAccount?.displayName || user?.displayName || "");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState(userAccount?.email || user?.email || "");
  const [website, setWebsite] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");
  const [instagram, setInstagram] = useState("");
  const [twitter, setTwitter] = useState("");
  const [other, setOther] = useState("");
  const [availability, setAvailability] = useState<PortfolioAvailability>("Available for work");
  const [stylePreset, setStylePreset] = useState<PortfolioStylePreset>("MINIMAL");

  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Step 1 Submission
  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setValidationError("Please give your portfolio a title or name.");
      return;
    }
    setValidationError(null);
    setStep(2);
  };

  // Step 2 Submission
  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!headline.trim()) {
      setValidationError("Please enter a headline that captures your work.");
      return;
    }
    if (!bio.trim()) {
      setValidationError("Please enter a short introduction about yourself.");
      return;
    }
    setValidationError(null);
    setStep(3);
  };

  // Step 3 Submission
  const handleStep3Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setValidationError("Please provide a contact email address.");
      return;
    }
    setValidationError(null);
    setStep(4);
  };

  // Final Step Submission
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    setSubmissionError(null);

    const socialLinks: PortfolioSocialLinks = {};
    if (website.trim()) socialLinks.website = website.trim();
    if (linkedin.trim()) socialLinks.linkedin = linkedin.trim();
    if (github.trim()) socialLinks.github = github.trim();
    if (instagram.trim()) socialLinks.instagram = instagram.trim();
    if (twitter.trim()) socialLinks.twitter = twitter.trim();
    if (other.trim()) socialLinks.other = other.trim();

    try {
      const created = await createPortfolio({
        ownerId: user.uid,
        title: title.trim(),
        profession: userAccount?.customProfession || userAccount?.profession || "Creator",
        headline: headline.trim(),
        bio: bio.trim(),
        location: userAccount?.location || "",
        profileImage: user.photoURL || null,
        availability,
        email: email.trim(),
        socialLinks,
        stylePreset,
      });

      onSuccess(created);
    } catch (err) {
      console.error("Portfolio creation failed:", err);
      setSubmissionError("We couldn't create your portfolio. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedCurrent = String(step).padStart(2, "0");
  const formattedTotal = "04";

  return (
    <div
      id="portfolio-setup-screen"
      className="relative min-h-screen w-full flex flex-col justify-between items-center px-6 sm:px-12 py-10 sm:py-12 bg-[#F8F8F7] text-[#1A1A1B] selection:bg-[#6DAEAD]/20 overflow-x-hidden"
    >
      {/* Foundation Accent Bar */}
      <div className="fixed left-0 top-0 w-1 h-full bg-gradient-to-b from-[#708595] to-[#6DAEAD] z-30 pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-4xl flex items-center justify-between pt-2 pb-6 border-b border-[#E5E5E1]">
        <div className="flex items-baseline gap-3">
          <div className="text-[20px] font-medium tracking-[-0.03em] text-[#1A1A1B]">
            {brand.name}
          </div>
          <div className="font-support text-[11px] uppercase tracking-[0.15em] text-[#708595] hidden sm:block">
            Setup
          </div>
        </div>

        <div className="flex items-center gap-3 select-none">
          <span className="font-mono text-xs tracking-widest text-[#708595]">
            {formattedCurrent} <span className="text-[#849693]/50">/</span> {formattedTotal}
          </span>
          <div className="w-16 h-[2px] bg-[#E5E5E1] rounded-full overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-[#708595] to-[#6DAEAD] transition-all duration-500 ease-out"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-2xl flex flex-col items-center my-auto py-8 sm:py-12">
        <AnimatePresence mode="wait">
          {/* STEP 1: Name / Title */}
          {step === 1 && (
            <motion.form
              key="setup-step-1"
              id="portfolio-setup-step-1"
              onSubmit={handleStep1Submit}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-full flex flex-col items-start text-left"
            >
              <span className="font-support text-[11px] uppercase tracking-[0.18em] text-[#708595] mb-2.5">
                Stage 01 &mdash; Identity
              </span>

              <h1 className="text-3xl sm:text-4xl md:text-[46px] font-light md:font-[300] leading-[1.12] tracking-[-0.04em] text-[#1A1A1B] mb-3">
                Give your portfolio a name.
              </h1>

              <p className="text-base text-[#708595] mb-8 font-normal">
                This defines the main title of your presence. Most creators use their full name.
              </p>

              <div className="w-full mb-6">
                <label
                  htmlFor="portfolio-title-input"
                  className="block text-xs uppercase tracking-[0.1em] font-medium text-[#708595] mb-2 font-support"
                >
                  Portfolio Title
                </label>
                <input
                  id="portfolio-title-input"
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="e.g. Great Ibewuike"
                  autoFocus
                  className="w-full text-xl sm:text-2xl font-light text-[#1A1A1B] bg-white border border-[#E5E5E1] rounded-[2px] px-4 py-3.5 focus:outline-none focus:border-[#6DAEAD] focus:ring-1 focus:ring-[#6DAEAD] transition-all duration-200 placeholder:text-[#849693]/40 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                />
                {validationError && (
                  <div className="flex items-center gap-1.5 mt-2.5 text-xs text-[#B93838]">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{validationError}</span>
                  </div>
                )}
              </div>

              <div className="w-full flex items-center justify-between pt-4 border-t border-[#E5E5E1]/60">
                <Button
                  id="setup-step1-cancel-button"
                  type="button"
                  variant="ghost"
                  onClick={onCancel}
                  className="text-[#708595]"
                >
                  Cancel
                </Button>
                <Button
                  id="setup-step1-continue-button"
                  type="submit"
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRight className="w-4 h-4 ml-1" />}
                  className="min-w-[140px]"
                >
                  Continue
                </Button>
              </div>
            </motion.form>
          )}

          {/* STEP 2: Headline & Bio */}
          {step === 2 && (
            <motion.form
              key="setup-step-2"
              id="portfolio-setup-step-2"
              onSubmit={handleStep2Submit}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-full flex flex-col items-start text-left"
            >
              <span className="font-support text-[11px] uppercase tracking-[0.18em] text-[#708595] mb-2.5">
                Stage 02 &mdash; Narrative
              </span>

              <h1 className="text-3xl sm:text-4xl md:text-[46px] font-light md:font-[300] leading-[1.12] tracking-[-0.04em] text-[#1A1A1B] mb-3">
                How do you want to introduce yourself?
              </h1>

              <p className="text-base text-[#708595] mb-8 font-normal">
                Establish your headline statement and short introduction.
              </p>

              {/* Headline */}
              <div className="w-full mb-5">
                <label
                  htmlFor="portfolio-headline-input"
                  className="block text-xs uppercase tracking-[0.1em] font-medium text-[#708595] mb-2 font-support"
                >
                  Headline
                </label>
                <input
                  id="portfolio-headline-input"
                  type="text"
                  value={headline}
                  onChange={(e) => {
                    setHeadline(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="e.g. Web Designer & Digital Product Builder"
                  autoFocus
                  className="w-full text-base sm:text-lg font-light text-[#1A1A1B] bg-white border border-[#E5E5E1] rounded-[2px] px-4 py-3 focus:outline-none focus:border-[#6DAEAD] focus:ring-1 focus:ring-[#6DAEAD] transition-all duration-200 placeholder:text-[#849693]/40 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                />
              </div>

              {/* Bio */}
              <div className="w-full mb-6">
                <label
                  htmlFor="portfolio-bio-input"
                  className="block text-xs uppercase tracking-[0.1em] font-medium text-[#708595] mb-2 font-support"
                >
                  Short Introduction
                </label>
                <textarea
                  id="portfolio-bio-input"
                  rows={3}
                  value={bio}
                  onChange={(e) => {
                    setBio(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="e.g. I design digital experiences that help brands communicate, connect and grow."
                  className="w-full text-sm sm:text-base font-light text-[#1A1A1B] bg-white border border-[#E5E5E1] rounded-[2px] px-4 py-3 focus:outline-none focus:border-[#6DAEAD] focus:ring-1 focus:ring-[#6DAEAD] transition-all duration-200 placeholder:text-[#849693]/40 shadow-[0_1px_2px_rgba(0,0,0,0.02)] resize-none"
                />
              </div>

              {validationError && (
                <div className="flex items-center gap-1.5 mb-6 text-xs text-[#B93838]">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              <div className="w-full flex items-center justify-between pt-4 border-t border-[#E5E5E1]/60">
                <Button
                  id="setup-step2-back-button"
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  leftIcon={<ArrowLeft className="w-4 h-4 mr-1 text-[#708595]" />}
                >
                  Back
                </Button>
                <Button
                  id="setup-step2-continue-button"
                  type="submit"
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRight className="w-4 h-4 ml-1" />}
                  className="min-w-[140px]"
                >
                  Continue
                </Button>
              </div>
            </motion.form>
          )}

          {/* STEP 3: Reach / Social Links */}
          {step === 3 && (
            <motion.form
              key="setup-step-3"
              id="portfolio-setup-step-3"
              onSubmit={handleStep3Submit}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-full flex flex-col items-start text-left"
            >
              <span className="font-support text-[11px] uppercase tracking-[0.18em] text-[#708595] mb-2.5">
                Stage 03 &mdash; Presence
              </span>

              <h1 className="text-3xl sm:text-4xl md:text-[46px] font-light md:font-[300] leading-[1.12] tracking-[-0.04em] text-[#1A1A1B] mb-3">
                Where can people find you?
              </h1>

              <p className="text-base text-[#708595] mb-6 font-normal">
                Add the channels through which collaborators or clients can reach you.
              </p>

              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6">
                {/* Email (Required) */}
                <div className="sm:col-span-2">
                  <label
                    htmlFor="contact-email-input"
                    className="block text-xs uppercase tracking-[0.1em] font-medium text-[#708595] mb-1.5 font-support"
                  >
                    Primary Contact Email *
                  </label>
                  <div className="relative">
                    <input
                      id="contact-email-input"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (validationError) setValidationError(null);
                      }}
                      placeholder="hello@example.com"
                      className="w-full text-sm font-light text-[#1A1A1B] bg-white border border-[#E5E5E1] rounded-[2px] pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#6DAEAD] focus:ring-1 focus:ring-[#6DAEAD]"
                    />
                    <Mail className="w-4 h-4 text-[#849693] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Website */}
                <div>
                  <label
                    htmlFor="website-input"
                    className="block text-xs uppercase tracking-[0.1em] font-medium text-[#708595] mb-1.5 font-support"
                  >
                    Personal Website
                  </label>
                  <div className="relative">
                    <input
                      id="website-input"
                      type="text"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://..."
                      className="w-full text-sm font-light text-[#1A1A1B] bg-white border border-[#E5E5E1] rounded-[2px] pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#6DAEAD] focus:ring-1 focus:ring-[#6DAEAD]"
                    />
                    <Globe className="w-4 h-4 text-[#849693] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* LinkedIn */}
                <div>
                  <label
                    htmlFor="linkedin-input"
                    className="block text-xs uppercase tracking-[0.1em] font-medium text-[#708595] mb-1.5 font-support"
                  >
                    LinkedIn
                  </label>
                  <div className="relative">
                    <input
                      id="linkedin-input"
                      type="text"
                      value={linkedin}
                      onChange={(e) => setLinkedin(e.target.value)}
                      placeholder="linkedin.com/in/..."
                      className="w-full text-sm font-light text-[#1A1A1B] bg-white border border-[#E5E5E1] rounded-[2px] pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#6DAEAD] focus:ring-1 focus:ring-[#6DAEAD]"
                    />
                    <Linkedin className="w-4 h-4 text-[#849693] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* GitHub */}
                <div>
                  <label
                    htmlFor="github-input"
                    className="block text-xs uppercase tracking-[0.1em] font-medium text-[#708595] mb-1.5 font-support"
                  >
                    GitHub
                  </label>
                  <div className="relative">
                    <input
                      id="github-input"
                      type="text"
                      value={github}
                      onChange={(e) => setGithub(e.target.value)}
                      placeholder="github.com/..."
                      className="w-full text-sm font-light text-[#1A1A1B] bg-white border border-[#E5E5E1] rounded-[2px] pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#6DAEAD] focus:ring-1 focus:ring-[#6DAEAD]"
                    />
                    <Github className="w-4 h-4 text-[#849693] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Instagram */}
                <div>
                  <label
                    htmlFor="instagram-input"
                    className="block text-xs uppercase tracking-[0.1em] font-medium text-[#708595] mb-1.5 font-support"
                  >
                    Instagram
                  </label>
                  <div className="relative">
                    <input
                      id="instagram-input"
                      type="text"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      placeholder="instagram.com/..."
                      className="w-full text-sm font-light text-[#1A1A1B] bg-white border border-[#E5E5E1] rounded-[2px] pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#6DAEAD] focus:ring-1 focus:ring-[#6DAEAD]"
                    />
                    <Instagram className="w-4 h-4 text-[#849693] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Twitter / X */}
                <div>
                  <label
                    htmlFor="twitter-input"
                    className="block text-xs uppercase tracking-[0.1em] font-medium text-[#708595] mb-1.5 font-support"
                  >
                    X / Twitter
                  </label>
                  <div className="relative">
                    <input
                      id="twitter-input"
                      type="text"
                      value={twitter}
                      onChange={(e) => setTwitter(e.target.value)}
                      placeholder="x.com/..."
                      className="w-full text-sm font-light text-[#1A1A1B] bg-white border border-[#E5E5E1] rounded-[2px] pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#6DAEAD] focus:ring-1 focus:ring-[#6DAEAD]"
                    />
                    <Twitter className="w-4 h-4 text-[#849693] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Other */}
                <div>
                  <label
                    htmlFor="other-link-input"
                    className="block text-xs uppercase tracking-[0.1em] font-medium text-[#708595] mb-1.5 font-support"
                  >
                    Other Link
                  </label>
                  <div className="relative">
                    <input
                      id="other-link-input"
                      type="text"
                      value={other}
                      onChange={(e) => setOther(e.target.value)}
                      placeholder="https://..."
                      className="w-full text-sm font-light text-[#1A1A1B] bg-white border border-[#E5E5E1] rounded-[2px] pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#6DAEAD] focus:ring-1 focus:ring-[#6DAEAD]"
                    />
                    <LinkIcon className="w-4 h-4 text-[#849693] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              {validationError && (
                <div className="flex items-center gap-1.5 mb-6 text-xs text-[#B93838]">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              <div className="w-full flex items-center justify-between pt-4 border-t border-[#E5E5E1]/60">
                <Button
                  id="setup-step3-back-button"
                  type="button"
                  variant="outline"
                  onClick={() => setStep(2)}
                  leftIcon={<ArrowLeft className="w-4 h-4 mr-1 text-[#708595]" />}
                >
                  Back
                </Button>
                <Button
                  id="setup-step3-continue-button"
                  type="submit"
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRight className="w-4 h-4 ml-1" />}
                  className="min-w-[140px]"
                >
                  Continue
                </Button>
              </div>
            </motion.form>
          )}

          {/* STEP 4: Presentation & Style Preset */}
          {step === 4 && (
            <motion.form
              key="setup-step-4"
              id="portfolio-setup-step-4"
              onSubmit={handleFinalSubmit}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-full flex flex-col items-start text-left"
            >
              <span className="font-support text-[11px] uppercase tracking-[0.18em] text-[#708595] mb-2.5">
                Stage 04 &mdash; Presentation
              </span>

              <h1 className="text-3xl sm:text-4xl md:text-[46px] font-light md:font-[300] leading-[1.12] tracking-[-0.04em] text-[#1A1A1B] mb-3">
                How would you like to be presented?
              </h1>

              <p className="text-base text-[#708595] mb-6 font-normal">
                Choose your availability status and portfolio style preset.
              </p>

              {/* Availability Options */}
              <div className="w-full mb-8">
                <label className="block text-xs uppercase tracking-[0.1em] font-medium text-[#708595] mb-2.5 font-support">
                  Availability Status
                </label>
                <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {AVAILABILITY_OPTIONS.map((opt) => {
                    const isSelected = availability === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        id={`availability-opt-${opt.id.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                        onClick={() => setAvailability(opt.id)}
                        className={`p-3 text-left border rounded-[2px] transition-all duration-200 select-none flex flex-col justify-between ${
                          isSelected
                            ? "bg-white border-[#6DAEAD] ring-1 ring-[#6DAEAD] shadow-[0_1px_6px_rgba(109,174,173,0.12)]"
                            : "bg-white/80 border-[#E5E5E1] hover:border-[#708595]/50 hover:bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-[#1A1A1B]">
                            {opt.label}
                          </span>
                          {isSelected && <Check className="w-3 h-3 text-[#6DAEAD]" />}
                        </div>
                        <span className="text-[11px] text-[#708595] font-normal leading-snug">
                          {opt.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Style Preset Selector */}
              <div className="w-full mb-8">
                <label className="block text-xs uppercase tracking-[0.1em] font-medium text-[#708595] mb-2.5 font-support">
                  Style Preset
                </label>
                <StylePresetSelector
                  selected={stylePreset}
                  onSelect={(preset) => setStylePreset(preset)}
                />
              </div>

              {submissionError && (
                <div className="w-full p-3.5 mb-6 bg-[#FFF5F5] border border-[#FED7D7] rounded-[2px] text-xs text-[#B93838] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{submissionError}</span>
                </div>
              )}

              <div className="w-full flex items-center justify-between pt-4 border-t border-[#E5E5E1]/60 gap-3">
                <Button
                  id="setup-step4-back-button"
                  type="button"
                  variant="outline"
                  onClick={() => setStep(3)}
                  disabled={isSubmitting}
                  leftIcon={<ArrowLeft className="w-4 h-4 mr-1 text-[#708595]" />}
                >
                  Back
                </Button>
                <Button
                  id="setup-step4-submit-button"
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isSubmitting}
                  disabled={isSubmitting}
                  rightIcon={<Sparkles className="w-4 h-4 ml-1.5 text-[#94CEBB]" />}
                  className="min-w-[190px]"
                >
                  Create portfolio
                </Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </main>

      {/* Legal Footer */}
      <footer className="w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between text-[10px] sm:text-[11px] uppercase tracking-[0.12em] text-[#849693] pt-6 border-t border-[#E5E5E1] gap-3">
        <div>&copy; 2024 BroadBrand. All Rights Reserved.</div>
        <div className="font-support">{brand.endorsement}</div>
      </footer>
    </div>
  );
};
