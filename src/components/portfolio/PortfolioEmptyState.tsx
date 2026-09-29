import React from "react";
import { motion } from "motion/react";
import { brand } from "../../config/branding";
import { useAuth } from "../../lib/authContext";
import { Button } from "../ui/Button";
import { ArrowRight, LogOut } from "lucide-react";

interface PortfolioEmptyStateProps {
  onCreateClick: () => void;
}

export const PortfolioEmptyState: React.FC<PortfolioEmptyStateProps> = ({
  onCreateClick,
}) => {
  const { user, userAccount, signOutUser, status } = useAuth();
  const isSigningOut = status === "unauthenticated";
  const effectiveDisplayName = userAccount?.displayName || user?.displayName || "Creator";

  return (
    <div
      id="portfolio-empty-state-screen"
      className="min-h-screen bg-[#F3FAF9] text-[#243838] selection:bg-[#6DAEAD]/25"
    >
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
        <header className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/80 px-4 py-3 backdrop-blur-xl">
          <div>
            <div className="text-[15px] font-bold tracking-[-0.04em] text-[#3E7574]">
              {brand.name}
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6E8887]">
              {brand.endorsement}
            </div>
          </div>
          <button
            type="button"
            onClick={signOutUser}
            disabled={isSigningOut}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-[#5C7372] hover:bg-[#E7F4F3]"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </header>

        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="grid flex-1 items-stretch gap-4 lg:grid-cols-12"
        >
          <section className="flex flex-col justify-between rounded-[28px] bg-[#6DAEAD] p-8 text-white sm:p-12 lg:col-span-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/75">
              {effectiveDisplayName}
            </p>
            <div className="py-10">
              <h1 className="max-w-xl text-4xl font-bold leading-[1.02] tracking-[-0.045em] sm:text-6xl">
                Your portfolio starts here.
              </h1>
              <p className="mt-5 max-w-md text-base font-medium leading-relaxed text-white/85 sm:text-lg">
                Bring your work, experience and skills together in a digital presence designed around you.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Button
                id="create-portfolio-button"
                variant="secondary"
                size="lg"
                onClick={onCreateClick}
                rightIcon={<ArrowRight className="ml-1 h-4 w-4" />}
                className="bg-white text-[#2F6463] hover:bg-[#F4FBFA]"
              >
                Create my portfolio
              </Button>
              <span className="text-sm font-medium text-white/80">
                You can change everything later.
              </span>
            </div>
          </section>

          <aside className="grid gap-4 lg:col-span-5">
            <div className="rounded-[28px] border border-[#D5E6E5] bg-white p-7">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3E7574]">
                What comes next
              </p>
              <ol className="mt-5 space-y-4 text-sm font-semibold text-[#243838]">
                <li>Name the portfolio.</li>
                <li>Write the introduction people see first.</li>
                <li>Choose how you want to be reached.</li>
                <li>Pick a style direction.</li>
              </ol>
            </div>
            <div className="rounded-[28px] bg-[#E7F4F3] p-7">
              <p className="text-2xl font-bold tracking-[-0.04em] text-[#2F6463]">
                One portfolio. Your account.
              </p>
              <p className="mt-2 text-sm font-medium leading-relaxed text-[#5C7372]">
                Signed in as {effectiveDisplayName}.
              </p>
            </div>
          </aside>
        </motion.main>
      </div>
    </div>
  );
};
