import React, { lazy, Suspense, useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AuthProvider, useAuth } from "./lib/authContext";
import { SplashScreen } from "./components/splash/SplashScreen";
import { AuthScreen } from "./components/auth/AuthScreen";
import { OnboardingScreen } from "./components/onboarding/OnboardingScreen";
import { TemplateDiscovery } from "./components/discover/TemplateDiscovery";
import { PortfolioAppView } from "./components/portfolio/PortfolioAppView";
import { Button } from "./components/ui/Button";
import { isWdkTemplatePreviewPath, WDK_TEMPLATE_PREVIEW_PATH } from "./preview/templatePreviewPath";
import { isPortfolioEditorPath } from "./components/portfolio-editor/portfolioEditorPath";
import { PortfolioEditor } from "./components/portfolio-editor/PortfolioEditor";
import type { AppRoute } from "./types";

const WdkTemplatePreview = lazy(() =>
  import("./preview/WdkTemplatePreview").then((module) => ({
    default: module.WdkTemplatePreview,
  })),
);

function AppContent() {
  const {
    user,
    userAccount,
    isLoading: isAuthLoading,
    authPhase,
    accountError,
    retryLoadAccount,
    signOutUser,
  } = useAuth();
  const [isRetryingAccount, setIsRetryingAccount] = useState(false);
  const [hasCompletedSplash, setHasCompletedSplash] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => {
    const path = window.location.pathname;
    return path || "/";
  });

  // Sync browser back/forward history navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      setCurrentRoute(path || "/");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = (route: AppRoute) => {
    setCurrentRoute(route);
    try {
      if (window.location.pathname !== route) {
        window.history.pushState(null, "", route);
      }
    } catch {
      // In strict iframe sandbox, ignore pushState errors
    }
  };

  // Handle splash completion
  const handleSplashComplete = () => {
    setHasCompletedSplash(true);
    const initialPath = window.location.pathname || "/";
    if (isWdkTemplatePreviewPath(initialPath) || isPortfolioEditorPath(initialPath)) {
      navigateTo(initialPath);
      return;
    }
    if (!user || authPhase === "SIGNED_OUT") {
      if (initialPath === "/auth") {
        navigateTo("/auth");
      } else if (initialPath === "/app" || initialPath === "/onboarding" || initialPath === "/discover" || initialPath === "/") {
        navigateTo("/auth");
      } else {
        navigateTo(initialPath);
      }
    } else if (authPhase === "ONBOARDING_REQUIRED") {
      navigateTo("/onboarding");
    } else if (authPhase === "TEMPLATE_DISCOVERY") {
      navigateTo("/discover");
    } else if (authPhase === "READY" || userAccount?.onboardingCompleted) {
      if (
        initialPath === "/" ||
        initialPath === "/auth" ||
        initialPath === "/onboarding" ||
        initialPath === "/discover"
      ) {
        navigateTo("/app");
      } else {
        navigateTo(initialPath);
      }
    }
  };

  // Route protection & state synchronization
  useEffect(() => {
    if (!hasCompletedSplash || isAuthLoading || authPhase === "AUTH_LOADING" || authPhase === "ACCOUNT_LOADING") return;

    if (authPhase === "ACCOUNT_ERROR") return;

    if (isWdkTemplatePreviewPath(currentRoute)) return;

    if (authPhase === "SIGNED_OUT" || !user) {
      if (
        currentRoute === "/app" ||
        currentRoute === "/onboarding" ||
        currentRoute === "/discover" ||
        currentRoute === "/" ||
        isPortfolioEditorPath(currentRoute)
      ) {
        navigateTo("/auth");
      }
    } else if (authPhase === "ONBOARDING_REQUIRED") {
      if (currentRoute === "/app" || currentRoute === "/auth" || currentRoute === "/discover" || currentRoute === "/") {
        navigateTo("/onboarding");
      }
    } else if (authPhase === "TEMPLATE_DISCOVERY") {
      if (currentRoute === "/app" || currentRoute === "/auth" || currentRoute === "/onboarding" || currentRoute === "/") {
        navigateTo("/discover");
      }
    } else if (authPhase === "READY") {
      if (currentRoute === "/auth" || currentRoute === "/onboarding" || currentRoute === "/discover" || currentRoute === "/") {
        navigateTo("/app");
      }
    }
  }, [user, userAccount, authPhase, hasCompletedSplash, isAuthLoading, currentRoute]);

  // If splash is not yet completed, show original SplashScreen
  if (!hasCompletedSplash) {
    return <SplashScreen onComplete={handleSplashComplete} minDuration={2000} />;
  }

  if (isWdkTemplatePreviewPath(currentRoute)) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#F8F5F0]" />}>
        <WdkTemplatePreview />
      </Suspense>
    );
  }

  if (user && (authPhase === "ACCOUNT_ERROR" || isRetryingAccount)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3FAF9] px-6 font-sans text-[#243838]">
        <div className="w-full max-w-md rounded-2xl border border-[#D5E6E5] bg-white p-8 shadow-[0_12px_32px_rgba(109,174,173,0.08)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">Account</p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.04em]">Account data couldn't be loaded</h1>
          <p className="mt-3 text-sm font-medium leading-relaxed text-[#5C7372]">
            {accountError || "You're signed in, but your account could not be loaded. This is not a new account."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              id="retry-account-load"
              isLoading={isRetryingAccount}
              onClick={() => {
                setIsRetryingAccount(true);
                void retryLoadAccount().finally(() => setIsRetryingAccount(false));
              }}
            >
              Try again
            </Button>
            <Button id="sign-out-account-error" variant="outline" onClick={() => void signOutUser()}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#F3FAF9]">
      <AnimatePresence mode="wait">
        {currentRoute === "/app" && user && authPhase === "READY" ? (
          <motion.div
            key="app-route"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full min-h-screen"
          >
            <PortfolioAppView />
          </motion.div>
        ) : isPortfolioEditorPath(currentRoute) && !user ? (
          <div className="flex min-h-screen items-center justify-center bg-[#F3FAF9] font-sans text-[#243838]">
            <p className="text-sm font-medium text-[#5C7372]">Loading your portfolio…</p>
          </div>
        ) : isPortfolioEditorPath(currentRoute) && user ? (
          <motion.div
            key="portfolio-editor-route"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full min-h-screen"
          >
            <PortfolioEditor onPreview={() => navigateTo(WDK_TEMPLATE_PREVIEW_PATH)} />
          </motion.div>
        ) : currentRoute === "/discover" && user && authPhase === "TEMPLATE_DISCOVERY" ? (
          <motion.div
            key="discover-route"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full min-h-screen"
          >
            <TemplateDiscovery account={userAccount} onSignOut={() => void signOutUser()} />
          </motion.div>
        ) : currentRoute === "/onboarding" && user && authPhase === "ONBOARDING_REQUIRED" ? (
          <motion.div
            key="onboarding-route"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full min-h-screen"
          >
            <OnboardingScreen onDiscover={() => navigateTo("/discover")} />
          </motion.div>
        ) : (
          <motion.div
            key="auth-route"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full min-h-screen"
          >
            <AuthScreen />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
