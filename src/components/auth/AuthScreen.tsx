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
      className="relative min-h-screen w-full overflow-x-hidden bg-[#F3FAF9] text-[#243838] selection:bg-[#6DAEAD]/25"
    >
      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-stretch gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:py-8">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex flex-col justify-between overflow-hidden rounded-[28px] bg-[#6DAEAD] px-7 py-8 text-white sm:px-10 sm:py-12"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="text-lg font-bold tracking-[-0.04em]">{brand.name}</div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">
              {brand.endorsement}
            </div>
          </div>

          <div className="max-w-xl py-12">
            <img
              src={brand.splashLogoUrl}
              alt={`${brand.name} Mark`}
              referrerPolicy="no-referrer"
              className="mb-8 h-16 w-auto object-contain sm:h-20"
            />
            <h1 className="text-4xl font-bold leading-[1.05] tracking-[-0.045em] sm:text-5xl lg:text-6xl">
              {brand.tagline}
            </h1>
            <p className="mt-6 max-w-md text-base font-medium leading-relaxed text-white/85 sm:text-lg">
              A workspace for the work you want people to remember.
            </p>
          </div>

          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">
            BroadBrand
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col justify-center rounded-[28px] border border-white/80 bg-white/80 px-6 py-10 shadow-[0_20px_60px_rgba(109,174,173,0.12)] backdrop-blur-xl sm:px-10"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">
            Sign in
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-[#243838] sm:text-4xl">
            Continue into your workspace.
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#5C7372]">
            Google is the only way in. Your portfolio stays tied to this account.
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 flex items-start gap-2.5 rounded-2xl border border-[#F3C7C7] bg-[#FFF6F6]/90 p-3.5 text-left backdrop-blur-sm"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#B93838]" />
              <p className="flex-1 text-xs font-medium text-[#B93838]">{error}</p>
              <button
                type="button"
                onClick={clearError}
                className="text-xs font-bold text-[#B93838]/80 hover:text-[#B93838]"
              >
                Dismiss
              </button>
            </motion.div>
          )}

          <div className="mt-8 flex w-full flex-col items-start gap-4">
            <GoogleSignInButton
              onClick={signInWithGoogle}
              isLoading={isLoading}
              disabled={isLoading}
            />
            <p className="max-w-xs text-[11px] leading-relaxed text-[#6E8887]">
              By continuing, you agree to Custom Portfolio&apos;s{" "}
              <span className="cursor-pointer font-semibold text-[#3E7574] underline underline-offset-2">
                Terms of Service
              </span>{" "}
              and{" "}
              <span className="cursor-pointer font-semibold text-[#3E7574] underline underline-offset-2">
                Privacy Policy
              </span>
              .
            </p>
          </div>
        </motion.section>
      </div>
    </div>
  );
};
