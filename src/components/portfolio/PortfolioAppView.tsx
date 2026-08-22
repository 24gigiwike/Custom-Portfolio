import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "../../lib/authContext";
import { getUserPortfolio } from "../../lib/portfolio";
import { PortfolioEmptyState } from "./PortfolioEmptyState";
import { PortfolioSetup } from "./PortfolioSetup";
import { PortfolioWorkspace } from "./PortfolioWorkspace";
import { brand } from "../../config/branding";
import type { Portfolio } from "../../types/portfolio";

export const PortfolioAppView: React.FC = () => {
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSettingUp, setIsSettingUp] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadUserPortfolio() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const existing = await getUserPortfolio(user.uid);
        if (isMounted) {
          setPortfolio(existing);
        }
      } catch (err) {
        console.error("Failed to load portfolio:", err);
        if (isMounted) {
          setLoadError("Unable to load your portfolio. Please refresh to try again.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadUserPortfolio();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Loading Screen (Preserves Custom Portfolio visual calmness)
  if (isLoading) {
    return (
      <div
        id="portfolio-loading-screen"
        className="relative min-h-screen w-full flex flex-col justify-between items-center px-6 sm:px-12 py-10 sm:py-12 bg-[#F8F8F7] text-[#1A1A1B]"
      >
        <div className="fixed left-0 top-0 w-1 h-full bg-gradient-to-b from-[#708595] to-[#6DAEAD] z-30 pointer-events-none" />

        <header className="w-full max-w-5xl flex items-baseline justify-between pt-2">
          <div className="text-[20px] font-medium tracking-[-0.03em] text-[#1A1A1B]">
            {brand.name}
          </div>
          <div className="font-support text-[11px] uppercase tracking-[0.15em] text-[#708595]">
            {brand.endorsement}
          </div>
        </header>

        <div className="flex flex-col items-center gap-3 my-auto">
          <div className="w-6 h-6 border-2 border-[#E5E5E1] border-t-[#6DAEAD] rounded-full animate-spin" />
          <span className="font-support text-xs uppercase tracking-[0.14em] text-[#708595]">
            Loading workspace...
          </span>
        </div>

        <footer className="w-full max-w-5xl flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-[#849693] pt-6 border-t border-[#E5E5E1]">
          <div>&copy; 2024 BroadBrand. All Rights Reserved.</div>
        </footer>
      </div>
    );
  }

  // If user is actively in the setup flow
  if (isSettingUp) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="setup-flow"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full min-h-screen"
        >
          <PortfolioSetup
            onSuccess={(createdPortfolio) => {
              setPortfolio(createdPortfolio);
              setIsSettingUp(false);
            }}
            onCancel={() => setIsSettingUp(false)}
          />
        </motion.div>
      </AnimatePresence>
    );
  }

  // If portfolio exists, show workspace
  if (portfolio) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="workspace-view"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full min-h-screen"
        >
          <PortfolioWorkspace portfolio={portfolio} />
        </motion.div>
      </AnimatePresence>
    );
  }

  // If no portfolio exists, show empty state
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="empty-state-view"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full min-h-screen"
      >
        <PortfolioEmptyState onCreateClick={() => setIsSettingUp(true)} />
      </motion.div>
    </AnimatePresence>
  );
};
