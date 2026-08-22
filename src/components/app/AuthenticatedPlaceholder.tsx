import React from "react";
import { motion } from "motion/react";
import { brand } from "../../config/branding";
import { useAuth } from "../../lib/authContext";
import { Button } from "../ui/Button";
import { LogOut, User as UserIcon, CheckCircle2 } from "lucide-react";

export const AuthenticatedPlaceholder: React.FC = () => {
  const { user, signOutUser, status } = useAuth();
  const isSigningOut = status === "unauthenticated";

  return (
    <div
      id="authenticated-placeholder-screen"
      className="relative min-h-screen w-full flex flex-col justify-between items-center px-6 sm:px-12 py-10 sm:py-12 bg-[#F8F8F7] text-[#1A1A1B] selection:bg-[#6DAEAD]/20 overflow-x-hidden"
    >
      {/* Foundation Accent Bar */}
      <div className="fixed left-0 top-0 w-1 h-full bg-gradient-to-b from-[#708595] to-[#6DAEAD] z-30 pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-5xl flex items-baseline justify-between pt-2">
        <div className="text-[20px] font-medium tracking-[-0.03em] text-[#1A1A1B]">
          {brand.name}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#6DAEAD]" />
            <span className="font-support text-[11px] uppercase tracking-[0.15em] text-[#708595]">
              Session Active
            </span>
          </div>
        </div>
      </header>

      {/* Main Authenticated State Confirmation */}
      <motion.main
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[540px] flex flex-col items-center text-center my-auto py-10 sm:py-14"
      >
        {/* User Avatar / Status Badge */}
        <div className="relative mb-6">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || "User avatar"}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-[2px] border border-[#E5E5E1] shadow-[0_1px_3px_rgba(0,0,0,0.03)] object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-[2px] bg-white border border-[#E5E5E1] flex items-center justify-center text-[#6DAEAD] shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
              <UserIcon className="w-7 h-7" />
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-[#388E6D]" />
          </div>
        </div>

        {/* Primary Message */}
        <h1 className="text-3xl sm:text-4xl md:text-[44px] font-light md:font-[300] leading-[1.15] tracking-[-0.035em] text-[#1A1A1B] mb-3">
          You&apos;re signed in.
        </h1>
        <p className="text-base font-normal text-[#708595] mb-5">
          Welcome to {brand.name}.
        </p>

        {user?.email && (
          <div className="px-4 py-2 rounded-[2px] bg-white border border-[#E5E5E1] text-xs text-[#1A1A1B] font-mono mb-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            {user.email}
          </div>
        )}

        <p className="text-sm text-[#849693] max-w-sm mb-8 leading-relaxed">
          Your portfolio workspace will be ready in the next step.
        </p>

        {/* Sign Out Action */}
        <Button
          id="sign-out-button"
          variant="outline"
          onClick={signOutUser}
          isLoading={isSigningOut}
          leftIcon={<LogOut className="w-4 h-4 text-[#708595]" />}
          className="w-full max-w-[280px]"
        >
          Sign out
        </Button>
      </motion.main>

      {/* Legal Footer */}
      <footer className="w-full max-w-5xl flex flex-col sm:flex-row items-center justify-between text-[10px] sm:text-[11px] uppercase tracking-[0.12em] text-[#849693] pt-6 border-t border-[#E5E5E1] gap-3">
        <div>&copy; 2024 BroadBrand. All Rights Reserved.</div>
        <div className="font-support">{brand.endorsement}</div>
      </footer>
    </div>
  );
};
