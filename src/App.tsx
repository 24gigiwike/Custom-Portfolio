import React, { lazy, Suspense, useState, useEffect, useLayoutEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AuthProvider, useAuth } from "./lib/authContext";
import { SplashScreen } from "./components/splash/SplashScreen";
import { AuthScreen } from "./components/auth/AuthScreen";
import { OnboardingScreen } from "./components/onboarding/OnboardingScreen";
import { TemplateDiscovery } from "./components/discover/TemplateDiscovery";
import { isTemplateDiscoveryPath, TEMPLATE_DISCOVERY_PATH } from "./components/discover/templateDiscoveryPath";
import { PortfolioAppView } from "./components/portfolio/PortfolioAppView";
import { Button } from "./components/ui/Button";
import { isWdkTemplatePreviewPath } from "./preview/templatePreviewPath";
import { isPortfolioEditorPath } from "./components/portfolio-editor/portfolioEditorPath";
import { PortfolioEditor } from "./components/portfolio-editor/PortfolioEditor";
import { isPortfolioDesignPath } from "./components/portfolio-design/portfolioDesignPath";
import { PortfolioDesign } from "./components/portfolio-design/PortfolioDesign";
import { isPortfolioPublishPath } from "./components/portfolio-publish/portfolioPublishPath";
import { PortfolioPublish } from "./components/portfolio-publish/PortfolioPublish";
import { isPortfolioSeoPath } from "./components/portfolio-seo/portfolioSeoPath";
import { PortfolioSeo } from "./components/portfolio-seo/PortfolioSeo";
import { platformRobots, platformTitle, siteEnvironmentFromHost } from "./lib/portfolioSeo";
import { isFramedPortfolioReview, isPortfolioReviewPath } from "./components/portfolio-review/portfolioReviewPath";
import { PortfolioReview } from "./components/portfolio-review/PortfolioReview";
import { isPortfolioWorkspacePath, PORTFOLIO_WORKSPACE_PATH } from "./components/portfolio-workspace/portfolioWorkspacePath";
import { PortfolioWorkspace } from "./components/portfolio-workspace/PortfolioWorkspace";
import { isPublicPortfolioPath, publicPortfolioIdFromPath } from "./components/public/publicPortfolioPath";
import {
  allocateHistoryIndex,
  allowHistoryLeave,
  commitHistoryPop,
  historyIndexFromState,
  rememberHistoryIndex,
} from "./lib/unsavedChanges";
import type { AppRoute } from "./types";

const WdkTemplatePreview = lazy(() =>
  import("./preview/WdkTemplatePreview").then((module) => ({
    default: module.WdkTemplatePreview,
  })),
);

const PublicPortfolioView = lazy(() =>
  import("./components/public/PublicPortfolioView").then((module) => ({
    default: module.PublicPortfolioView,
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
  const [hasCompletedSplash, setHasCompletedSplash] = useState(
    () => isFramedPortfolioReview(window.location.search) || isPublicPortfolioPath(window.location.pathname)
  );
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => {
    const path = window.location.pathname;
    return path || "/";
  });
  const routeRef = useRef(currentRoute);
  routeRef.current = currentRoute;
  const historySession = useRef({
    idx: historyIndexFromState(window.history.state) ?? 0,
    reverting: false,
  });
  const historyReady = useRef(false);
  if (!historyReady.current) {
    historyReady.current = true;
    rememberHistoryIndex(historySession.current.idx);
  }

  useLayoutEffect(() => {
    if (isPublicPortfolioPath(currentRoute) || isWdkTemplatePreviewPath(currentRoute)) return;
    document.title = platformTitle(currentRoute);
    const robots = platformRobots(currentRoute, siteEnvironmentFromHost(window.location.hostname));
    let meta = document.head.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", robots);
  }, [currentRoute]);

  useLayoutEffect(() => {
    if (historyIndexFromState(window.history.state) !== null) return;
    try {
      const url = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.history.replaceState({ ...(window.history.state ?? {}), idx: historySession.current.idx }, "", url);
    } catch {
      // In strict iframe sandbox, ignore history errors
    }
  }, []);

  // Sync browser back/forward history navigation
  useEffect(() => {
    const handlePopState = () => {
      const nextPath = window.location.pathname || "/";
      const nextRoute = commitHistoryPop(
        historySession.current,
        { path: nextPath, idx: historyIndexFromState(window.history.state) },
        routeRef.current,
        allowHistoryLeave,
        {
          go: (delta) => window.history.go(delta),
          pushState: (idx, path) => window.history.pushState({ idx }, "", path),
        },
      );
      if (nextRoute !== null) setCurrentRoute(nextRoute);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = (route: AppRoute) => {
    setCurrentRoute(route);
    if (window.location.pathname === route) return;
    const idx = allocateHistoryIndex();
    try {
      window.history.pushState({ idx }, "", route);
      historySession.current.idx = idx;
    } catch {
      rememberHistoryIndex(idx - 1);
    }
  };

  // Handle splash completion
  const handleSplashComplete = () => {
    setHasCompletedSplash(true);
    const initialPath = window.location.pathname || "/";
    if (isPublicPortfolioPath(initialPath)) {
      navigateTo(initialPath);
      return;
    }
    if (
      isWdkTemplatePreviewPath(initialPath) ||
      isPortfolioEditorPath(initialPath) ||
      isPortfolioDesignPath(initialPath) ||
      isPortfolioReviewPath(initialPath) ||
      isPortfolioPublishPath(initialPath) ||
      isPortfolioSeoPath(initialPath) ||
      isPortfolioWorkspacePath(initialPath)
    ) {
      navigateTo(initialPath);
      return;
    }
    if (isTemplateDiscoveryPath(initialPath)) {
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
    } else if (initialPath === "/discover") {
      navigateTo(TEMPLATE_DISCOVERY_PATH);
    } else if (authPhase === "TEMPLATE_DISCOVERY") {
      navigateTo(TEMPLATE_DISCOVERY_PATH);
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
    if (isPublicPortfolioPath(currentRoute)) return;

    if (!hasCompletedSplash || isAuthLoading || authPhase === "AUTH_LOADING" || authPhase === "ACCOUNT_LOADING") return;

    if (authPhase === "ACCOUNT_ERROR") return;

    if (isWdkTemplatePreviewPath(currentRoute)) return;

    if (currentRoute === "/discover") {
      if (authPhase === "SIGNED_OUT" || !user) {
        navigateTo("/auth");
      } else if (authPhase === "ONBOARDING_REQUIRED") {
        navigateTo("/onboarding");
      } else {
        navigateTo(TEMPLATE_DISCOVERY_PATH);
      }
      return;
    }

    if (authPhase === "SIGNED_OUT" || !user) {
      if (
        currentRoute === "/app" ||
        currentRoute === "/onboarding" ||
        currentRoute === "/discover" ||
        currentRoute === "/" ||
        isPortfolioEditorPath(currentRoute) ||
        isPortfolioDesignPath(currentRoute) ||
        isPortfolioReviewPath(currentRoute) ||
        isPortfolioPublishPath(currentRoute) ||
        isPortfolioSeoPath(currentRoute) ||
        isPortfolioWorkspacePath(currentRoute) ||
        isTemplateDiscoveryPath(currentRoute)
      ) {
        navigateTo("/auth");
      }
    } else if (authPhase === "ONBOARDING_REQUIRED") {
      if (
        currentRoute === "/app" ||
        currentRoute === "/auth" ||
        currentRoute === "/discover" ||
        currentRoute === "/" ||
        isTemplateDiscoveryPath(currentRoute)
      ) {
        navigateTo("/onboarding");
      }
    } else if (authPhase === "TEMPLATE_DISCOVERY") {
      if (currentRoute === "/app" || currentRoute === "/auth" || currentRoute === "/onboarding" || currentRoute === "/") {
        navigateTo(TEMPLATE_DISCOVERY_PATH);
      }
    } else if (authPhase === "READY") {
      if (currentRoute === "/auth" || currentRoute === "/onboarding" || currentRoute === "/") {
        navigateTo("/app");
      }
    }
  }, [user, userAccount, authPhase, hasCompletedSplash, isAuthLoading, currentRoute]);

  const publicPortfolioId = publicPortfolioIdFromPath(currentRoute);
  if (publicPortfolioId) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#F8F5F0]" />}>
        <PublicPortfolioView publicId={publicPortfolioId} />
      </Suspense>
    );
  }

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
        ) : (isTemplateDiscoveryPath(currentRoute) || currentRoute === "/discover") && !user ? (
          <div className="flex min-h-screen items-center justify-center bg-[#F3FAF9] font-sans text-[#243838]">
            <p className="text-sm font-medium text-[#5C7372]">Loading templates…</p>
          </div>
        ) : (isTemplateDiscoveryPath(currentRoute) || currentRoute === "/discover") && user ? (
          <motion.div
            key="template-discovery-route"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full min-h-screen"
          >
            <TemplateDiscovery onOpenPath={navigateTo} />
          </motion.div>
        ) : (isPortfolioWorkspacePath(currentRoute) || isPortfolioEditorPath(currentRoute) || isPortfolioDesignPath(currentRoute) || isPortfolioReviewPath(currentRoute) || isPortfolioPublishPath(currentRoute) || isPortfolioSeoPath(currentRoute)) && !user ? (
          <div className="flex min-h-screen items-center justify-center bg-[#F3FAF9] font-sans text-[#243838]">
            <p className="text-sm font-medium text-[#5C7372]">Loading your portfolio…</p>
          </div>
        ) : isPortfolioWorkspacePath(currentRoute) && user ? (
          <motion.div
            key="portfolio-workspace-route"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full min-h-screen"
          >
            <PortfolioWorkspace onOpenPath={navigateTo} />
          </motion.div>
        ) : isPortfolioEditorPath(currentRoute) && user ? (
          <motion.div
            key="portfolio-editor-route"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full min-h-screen"
          >
            <PortfolioEditor
              onWorkspace={() => navigateTo(PORTFOLIO_WORKSPACE_PATH)}
              onPreview={(path) => navigateTo(path)}
              onDiscover={() => navigateTo(TEMPLATE_DISCOVERY_PATH)}
            />
          </motion.div>
        ) : isPortfolioDesignPath(currentRoute) && user ? (
          <motion.div
            key="portfolio-design-route"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full min-h-screen"
          >
            <PortfolioDesign
              onWorkspace={() => navigateTo(PORTFOLIO_WORKSPACE_PATH)}
              onPreview={(path) => navigateTo(path)}
              onDiscover={() => navigateTo(TEMPLATE_DISCOVERY_PATH)}
            />
          </motion.div>
        ) : isPortfolioReviewPath(currentRoute) && user ? (
          <motion.div
            key="portfolio-review-route"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full min-h-screen"
          >
            <PortfolioReview onOpenPath={navigateTo} />
          </motion.div>
        ) : isPortfolioPublishPath(currentRoute) && user ? (
          <motion.div
            key="portfolio-publish-route"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full min-h-screen"
          >
            <PortfolioPublish onOpenPath={navigateTo} />
          </motion.div>
        ) : isPortfolioSeoPath(currentRoute) && user ? (
          <motion.div
            key="portfolio-seo-route"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full min-h-screen"
          >
            <PortfolioSeo onOpenPath={navigateTo} />
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
            <OnboardingScreen onDiscover={() => navigateTo(TEMPLATE_DISCOVERY_PATH)} />
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
