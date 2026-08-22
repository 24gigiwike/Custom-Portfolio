import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AuthProvider, useAuth } from "./lib/authContext";
import { SplashScreen } from "./components/splash/SplashScreen";
import { AuthScreen } from "./components/auth/AuthScreen";
import { OnboardingScreen } from "./components/onboarding/OnboardingScreen";
import { PortfolioAppView } from "./components/portfolio/PortfolioAppView";
import type { AppRoute } from "./types";

function AppContent() {
  const { user, userAccount, isLoading: isAuthLoading, authPhase } = useAuth();
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
    if (!user) {
      if (initialPath === "/auth") {
        navigateTo("/auth");
      } else if (initialPath === "/app" || initialPath === "/onboarding" || initialPath === "/") {
        navigateTo("/auth");
      } else {
        navigateTo(initialPath);
      }
    } else if (userAccount?.onboardingCompleted) {
      if (initialPath === "/" || initialPath === "/auth") {
        navigateTo("/app");
      } else {
        navigateTo(initialPath);
      }
    } else {
      navigateTo("/onboarding");
    }
  };

  // Route protection & state synchronization
  useEffect(() => {
    if (!hasCompletedSplash || isAuthLoading || authPhase === "AUTH_LOADING") return;

    if (authPhase === "SIGNED_OUT" || !user) {
      // Unauthenticated user -> redirect to /auth
      if (currentRoute === "/app" || currentRoute === "/onboarding" || currentRoute === "/") {
        navigateTo("/auth");
      }
    } else if (authPhase === "ONBOARDING_REQUIRED") {
      // Authenticated but onboarding incomplete -> redirect to /onboarding
      if (currentRoute === "/app" || currentRoute === "/auth" || currentRoute === "/") {
        navigateTo("/onboarding");
      }
    } else if (authPhase === "READY") {
      // Authenticated and onboarding complete -> redirect to /app
      if (currentRoute === "/auth" || currentRoute === "/onboarding" || currentRoute === "/") {
        navigateTo("/app");
      }
    }
  }, [user, userAccount, authPhase, hasCompletedSplash, isAuthLoading, currentRoute]);

  // If splash is not yet completed, show original SplashScreen
  if (!hasCompletedSplash) {
    return <SplashScreen onComplete={handleSplashComplete} minDuration={2000} />;
  }

  return (
    <div className="w-full min-h-screen bg-[#F8F8F7]">
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
        ) : currentRoute === "/onboarding" && user ? (
          <motion.div
            key="onboarding-route"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full min-h-screen"
          >
            <OnboardingScreen onCompleted={() => navigateTo("/app")} />
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
