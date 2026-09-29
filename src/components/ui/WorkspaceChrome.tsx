import React from "react";
import { brand } from "../../config/branding";
import { useAuth } from "../../lib/authContext";
import { LogOut } from "lucide-react";

export type WorkspaceNavKey = "overview" | "work" | "profile";

interface WorkspaceChromeProps {
  active: WorkspaceNavKey;
  portfolioTitle?: string;
  published?: boolean;
  showNav?: boolean;
  trailing?: React.ReactNode;
  onNavigate: (key: WorkspaceNavKey) => void;
  children: React.ReactNode;
}

const NAV_ITEMS: { key: WorkspaceNavKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "work", label: "Work" },
  { key: "profile", label: "Profile" },
];

export const WorkspaceChrome: React.FC<WorkspaceChromeProps> = ({
  active,
  portfolioTitle,
  published = false,
  showNav = true,
  trailing,
  onNavigate,
  children,
}) => {
  const { signOutUser, status } = useAuth();
  const isSigningOut = status === "unauthenticated";

  const navButton = (item: (typeof NAV_ITEMS)[number], compact = false, idSuffix = "") => {
    const isActive = active === item.key;
    return (
      <button
        key={`${item.key}${idSuffix}`}
        type="button"
        id={`workspace-nav-${item.key}${idSuffix}`}
        onClick={() => onNavigate(item.key)}
        className={`rounded-xl font-bold tracking-[-0.02em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6DAEAD] ${
          compact ? "flex-1 py-3 text-sm" : "px-3.5 py-2 text-sm"
        } ${
          isActive
            ? "bg-[#6DAEAD] text-white"
            : "text-[#3E7574] hover:bg-[#E7F4F3]"
        }`}
      >
        {item.label}
      </button>
    );
  };

  return (
    <div className="relative min-h-screen bg-[#F3FAF9] text-[#243838]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,_rgba(109,174,173,0.28),_transparent_68%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-24 pt-4 sm:px-6 sm:pt-6 lg:pb-10">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/70 bg-white/75 px-4 py-3 shadow-[0_10px_40px_rgba(109,174,173,0.1)] backdrop-blur-xl sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <div className="text-[15px] font-bold tracking-[-0.04em] text-[#3E7574]">
                {brand.name}
              </div>
              <div className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6E8887]">
                {portfolioTitle || brand.endorsement}
              </div>
            </div>
            <span
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${
                published
                  ? "bg-[#6DAEAD] text-white"
                  : "bg-[#F4FBFA] text-[#5C7372] ring-1 ring-[#D5E6E5]"
              }`}
            >
              {published ? "Published" : "Draft"}
            </span>
          </div>

          {showNav && (
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Workspace">
              {NAV_ITEMS.map((item) => navButton(item, false, ""))}
            </nav>
          )}

          <div className="flex items-center justify-end gap-2">
            {trailing}
            <button
              type="button"
              id="workspace-signout-button"
              onClick={signOutUser}
              disabled={isSigningOut}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-[#5C7372] transition-colors hover:bg-[#E7F4F3] hover:text-[#2F6463] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6DAEAD]"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        <div className="flex-1">{children}</div>
      </div>

      {showNav && (
        <nav
          className="fixed inset-x-3 bottom-3 z-40 flex items-center gap-1 rounded-2xl border border-white/80 bg-white/80 p-1.5 shadow-[0_12px_40px_rgba(62,117,116,0.16)] backdrop-blur-xl lg:hidden"
          aria-label="Workspace"
        >
          {NAV_ITEMS.map((item) => navButton(item, true, "-mobile"))}
        </nav>
      )}
    </div>
  );
};
