import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AuthProvider, useAuth } from "./lib/authContext";
import { SplashScreen } from "./components/splash/SplashScreen";
import { AuthScreen } from "./components/auth/AuthScreen";
import { AuthenticatedPlaceholder } from "./components/app/AuthenticatedPlaceholder";
import type { AppRoute } from "./types";

function AppContent() {
  const { user, isLoading: isAuthLoading, status } = useAuth();
  const [hasCompletedSplash, setHasCompletedSplash] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => {
    const path = window.location.pathname;
    if (path === "/auth") return "/auth";
    if (path === "/app") return "/app";
    return "/";
  });

  // Sync browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === "/app") setCurrentRoute("/app");
      else if (path === "/auth") setCurrentRoute("/auth");
      else setCurrentRoute("/");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Update browser history URL smoothly
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
    if (user) {
      navigateTo("/app");
    } else {
      navigateTo("/auth");
    }
  };

  // Route protection & state sync
  useEffect(() => {
    if (!hasCompletedSplash || isAuthLoading) return;

    if (user && status === "authenticated") {
      // User is authenticated - send to /app
      if (currentRoute !== "/app") {
        navigateTo("/app");
      }
    } else if (!user && (status === "unauthenticated" || status === "error" || status === "idle")) {
      // User is not authenticated - protect /app and route to /auth
      if (currentRoute === "/app" || currentRoute === "/") {
        navigateTo("/auth");
      }
    }
  }, [user, status, hasCompletedSplash, isAuthLoading, currentRoute]);

  // If splash is not yet completed, show SplashScreen
  if (!hasCompletedSplash) {
    return <SplashScreen onComplete={handleSplashComplete} minDuration={2000} />;
  }

  return (
    <div className="w-full min-h-screen bg-[#F8F8F7]">
      <AnimatePresence mode="wait">
        {currentRoute === "/app" && user ? (
          <motion.div
            key="app-route"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full min-h-screen"
          >
            <AuthenticatedPlaceholder />
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
