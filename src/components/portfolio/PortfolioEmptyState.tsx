import React from "react";
import { motion } from "motion/react";
import { brand } from "../../config/branding";
import { useAuth } from "../../lib/authContext";
import { Button } from "../ui/Button";
import { ArrowRight, LogOut, Sparkles } from "lucide-react";

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
      className="relative min-h-screen w-full flex flex-col justify-between items-center px-6 sm:px-12 py-10 sm:py-12 bg-[#F8F8F7] text-[#1A1A1B] selection:bg-[#6DAEAD]/20 overflow-x-hidden"
    >
      {/* Foundation Accent Bar */}
      <div className="fixed left-0 top-0 w-1 h-full bg-gradient-to-b from-[#708595] to-[#6DAEAD] z-30 pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-5xl flex items-baseline justify-between pt-2">
        <div className="flex items-baseline gap-3">
          <div className="text-[20px] font-medium tracking-[-0.03em] text-[#1A1A1B]">
            {brand.name}
          </div>
          <div className="font-support text-[11px] uppercase tracking-[0.15em] text-[#708595] hidden sm:block">
            {brand.endorsement}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-[#708595] font-light hidden sm:inline-block">
            {effectiveDisplayName}
          </span>
          <button
            type="button"
            onClick={signOutUser}
            disabled={isSigningOut}
            className="flex items-center gap-1.5 text-xs text-[#708595] hover:text-[#1A1A1B] transition-colors duration-150"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <motion.main
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl flex flex-col items-start text-left my-auto py-10 sm:py-14"
      >
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[2px] bg-white border border-[#E5E5E1] mb-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <Sparkles className="w-3.5 h-3.5 text-[#6DAEAD]" />
          <span className="font-support text-[11px] uppercase tracking-[0.14em] text-[#708595]">
            Portfolio Foundation
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-[50px] font-light md:font-[300] leading-[1.12] tracking-[-0.04em] text-[#1A1A1B] mb-4">
          Your portfolio starts here.
        </h1>

        <p className="text-base sm:text-lg text-[#708595] font-normal leading-relaxed max-w-xl mb-10">
          Bring your work, experience and skills together in a digital presence designed around you.
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
          <Button
            id="create-portfolio-button"
            variant="primary"
            size="lg"
            onClick={onCreateClick}
            rightIcon={<ArrowRight className="w-4 h-4 ml-1" />}
            className="w-full sm:w-auto min-w-[200px]"
          >
            Create my portfolio
          </Button>

          <span className="text-xs text-[#849693] font-light">
            You can change everything later.
          </span>
        </div>
      </motion.main>

      {/* Legal Footer */}
      <footer className="w-full max-w-5xl flex flex-col sm:flex-row items-center justify-between text-[10px] sm:text-[11px] uppercase tracking-[0.12em] text-[#849693] pt-6 border-t border-[#E5E5E1] gap-3">
        <div>&copy; 2024 BroadBrand. All Rights Reserved.</div>
        <div className="font-support">{brand.endorsement}</div>
      </footer>
    </div>
  );
};
