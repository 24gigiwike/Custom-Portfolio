import React from "react";
import { motion } from "motion/react";
import { brand } from "../../config/branding";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { useAuth } from "../../lib/authContext";
import { AlertCircle } from "lucide-react";

export const AuthScreen: React.FC = () => {
  const { signInWithGoogle, status, error, clearError } = useAuth();
  const isLoading = status === "authenticating";

  return (
    <div
      id="auth-screen"
      className="relative min-h-screen w-full flex flex-col justify-between items-center px-6 sm:px-12 py-10 sm:py-12 bg-[#F8F8F7] text-[#1A1A1B] selection:bg-[#6DAEAD]/20 overflow-x-hidden"
    >
      {/* Foundation Accent Bar */}
      <div className="fixed left-0 top-0 w-1 h-full bg-gradient-to-b from-[#708595] to-[#6DAEAD] z-30 pointer-events-none" />

      {/* Top Navigation */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-5xl flex items-baseline justify-between pt-2"
      >
        <div className="text-[20px] font-medium tracking-[-0.03em] text-[#1A1A1B]">
          {brand.name}
        </div>
        <div className="font-support text-[11px] uppercase tracking-[0.15em] text-[#708595]">
          {brand.endorsement}
        </div>
      </motion.header>

      {/* Main Entry (Bold Typography Core) */}
      <motion.main
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[540px] flex flex-col items-center text-center my-auto py-10 sm:py-14"
      >
        {/* Brand Mark Container */}
        <div className="mb-10 sm:mb-14 opacity-90 flex justify-center">
          <img
            src={brand.splashLogoUrl}
            alt={`${brand.name} Mark`}
            referrerPolicy="no-referrer"
            className="h-20 sm:h-24 md:h-[110px] w-auto object-contain select-none pointer-events-none"
          />
        </div>

        {/* Bold Headline */}
        <h1 className="text-3xl sm:text-4xl md:text-[50px] font-light md:font-[300] leading-[1.1] tracking-[-0.04em] mb-8 sm:mb-10 text-[#1A1A1B]">
          {brand.tagline}
        </h1>

        {/* Error Notification if any */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-[360px] mb-6 p-3 bg-[#FFF5F5] border border-[#FED7D7] rounded-[2px] text-left flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-[#B93838] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-[#B93838]">{error}</p>
            </div>
            <button
              type="button"
              onClick={clearError}
              className="text-xs text-[#B93838]/70 hover:text-[#B93838] ml-1"
            >
              Dismiss
            </button>
          </motion.div>
        )}

        {/* Primary Google Auth Action */}
        <div className="w-full max-w-[320px] flex flex-col items-center gap-4">
          <GoogleSignInButton
            onClick={signInWithGoogle}
            isLoading={isLoading}
            disabled={isLoading}
          />
        </div>

        {/* Terms and Privacy Footnote */}
        <p className="mt-8 text-[11px] text-[#849693] leading-relaxed max-w-xs">
          By continuing, you agree to Custom Portfolio&apos;s{" "}
          <span className="text-[#708595] underline underline-offset-2 hover:text-[#1A1A1B] cursor-pointer">
            Terms of Service
          </span>{" "}
          and{" "}
          <span className="text-[#708595] underline underline-offset-2 hover:text-[#1A1A1B] cursor-pointer">
            Privacy Policy
          </span>
          .
        </p>
      </motion.main>

      {/* Legal Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="w-full max-w-5xl flex flex-col sm:flex-row items-center justify-between text-[10px] sm:text-[11px] uppercase tracking-[0.12em] text-[#849693] pt-6 border-t border-[#E5E5E1] gap-3"
      >
        <div>&copy; 2024 BroadBrand. All Rights Reserved.</div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6DAEAD]" />
          <span>Phase 1 Deployment</span>
        </div>
      </motion.footer>
    </div>
  );
};
