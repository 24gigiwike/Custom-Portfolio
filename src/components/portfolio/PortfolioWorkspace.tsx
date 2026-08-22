import React from "react";
import { motion } from "motion/react";
import { brand } from "../../config/branding";
import { useAuth } from "../../lib/authContext";
import { Button } from "../ui/Button";
import {
  LogOut,
  User as UserIcon,
  Sparkles,
  MapPin,
  Briefcase,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
} from "lucide-react";
import type { Portfolio } from "../../types/portfolio";

interface PortfolioWorkspaceProps {
  portfolio: Portfolio;
}

interface StageStep {
  id: string;
  name: string;
  desc: string;
  status: "active" | "upcoming";
}

const PORTFOLIO_STAGES: StageStep[] = [
  {
    id: "profile",
    name: "Profile",
    desc: "Identity, narrative, channels & presence",
    status: "active",
  },
  {
    id: "work",
    name: "Work",
    desc: "Curated case studies & featured projects",
    status: "upcoming",
  },
  {
    id: "experience",
    name: "Experience",
    desc: "Career chronology & leadership milestones",
    status: "upcoming",
  },
  {
    id: "details",
    name: "Details",
    desc: "Capabilities, disciplines & testimonials",
    status: "upcoming",
  },
  {
    id: "publish",
    name: "Publish",
    desc: "Final review & public domain distribution",
    status: "upcoming",
  },
];

export const PortfolioWorkspace: React.FC<PortfolioWorkspaceProps> = ({
  portfolio,
}) => {
  const { signOutUser, status } = useAuth();
  const isSigningOut = status === "unauthenticated";

  return (
    <div
      id="portfolio-workspace-screen"
      className="relative min-h-screen w-full flex flex-col justify-between items-center px-6 sm:px-12 py-10 sm:py-12 bg-[#F8F8F7] text-[#1A1A1B] selection:bg-[#6DAEAD]/20 overflow-x-hidden"
    >
      {/* Foundation Accent Bar */}
      <div className="fixed left-0 top-0 w-1 h-full bg-gradient-to-b from-[#708595] to-[#6DAEAD] z-30 pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-5xl flex items-baseline justify-between pt-2 pb-6 border-b border-[#E5E5E1]">
        <div className="flex items-baseline gap-3">
          <div className="text-[20px] font-medium tracking-[-0.03em] text-[#1A1A1B]">
            {brand.name}
          </div>
          <div className="font-support text-[11px] uppercase tracking-[0.15em] text-[#708595] hidden sm:block">
            {brand.endorsement}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#6DAEAD]" />
            <span className="font-support text-[11px] uppercase tracking-[0.15em] text-[#708595]">
              {portfolio.title}
            </span>
          </div>
          <span className="text-[#E5E5E1] font-light">|</span>
          <button
            type="button"
            id="workspace-signout-button"
            onClick={signOutUser}
            disabled={isSigningOut}
            className="flex items-center gap-1.5 text-xs text-[#708595] hover:text-[#1A1A1B] transition-colors duration-150"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-5xl flex-1 flex flex-col my-8 sm:my-10">
        {/* Workspace Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full bg-white border border-[#E5E5E1] rounded-[2px] p-6 sm:p-8 mb-8 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
        >
          <div className="flex items-start gap-4 sm:gap-5 flex-1">
            {portfolio.profileImage ? (
              <img
                src={portfolio.profileImage}
                alt={portfolio.title}
                referrerPolicy="no-referrer"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-[2px] border border-[#E5E5E1] object-cover shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[2px] bg-[#F8F8F7] border border-[#E5E5E1] flex items-center justify-center text-[#6DAEAD] flex-shrink-0">
                <UserIcon className="w-8 h-8" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-light text-[#1A1A1B] tracking-[-0.03em] truncate">
                  {portfolio.title}
                </h1>
                <span className="font-support text-[10px] uppercase tracking-[0.12em] bg-[#F0F2F2] text-[#708595] px-2 py-0.5 rounded-[2px] border border-[#E5E5E1]">
                  Draft
                </span>
                <span className="font-support text-[10px] uppercase tracking-[0.12em] bg-[#F0F7F6] text-[#6DAEAD] px-2 py-0.5 rounded-[2px] border border-[#6DAEAD]/30">
                  {portfolio.stylePreset}
                </span>
              </div>

              <div className="text-sm font-medium text-[#708595] mb-2 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1.5 text-[#1A1A1B]">
                  <Briefcase className="w-3.5 h-3.5 text-[#6DAEAD]" />
                  {portfolio.profession}
                </span>
                {portfolio.location && (
                  <span className="flex items-center gap-1.5 text-[#708595]">
                    <MapPin className="w-3.5 h-3.5 text-[#849693]" />
                    {portfolio.location}
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm text-[#708595] font-light leading-relaxed line-clamp-2">
                {portfolio.headline}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <Button
              id="continue-building-button"
              variant="primary"
              size="lg"
              rightIcon={<ArrowRight className="w-4 h-4 ml-1" />}
              className="min-w-[180px]"
            >
              Continue building
            </Button>
          </div>
        </motion.div>

        {/* Portfolio Pipeline Progress */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full mb-8"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-support text-[11px] uppercase tracking-[0.15em] text-[#708595]">
              Portfolio Pipeline
            </span>
            <span className="text-xs font-mono text-[#849693]">
              1 of 5 Stages Ready
            </span>
          </div>

          <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {PORTFOLIO_STAGES.map((stage, idx) => {
              const isActive = stage.status === "active";
              return (
                <div
                  key={stage.id}
                  id={`stage-card-${stage.id}`}
                  className={`p-4 border rounded-[2px] flex flex-col justify-between transition-all duration-200 ${
                    isActive
                      ? "bg-white border-[#6DAEAD] ring-1 ring-[#6DAEAD]/50 shadow-[0_1px_3px_rgba(109,174,173,0.1)]"
                      : "bg-white/60 border-[#E5E5E1] opacity-75"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[11px] text-[#849693]">
                        0{idx + 1}
                      </span>
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-support tracking-[0.1em] text-[#388E6D] bg-[#F0FDF4] px-1.5 py-0.5 rounded-[2px] border border-[#DCFCE7]">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-support tracking-[0.1em] text-[#849693] bg-[#F8F8F7] px-1.5 py-0.5 rounded-[2px] border border-[#E5E5E1]">
                          <Clock className="w-2.5 h-2.5" />
                          Upcoming
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-medium text-[#1A1A1B] mb-1">
                      {stage.name}
                    </div>

                    <p className="text-xs text-[#708595] font-light leading-snug">
                      {stage.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Identity Details Foundation */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {/* Identity & Bio */}
          <div className="md:col-span-2 bg-white border border-[#E5E5E1] rounded-[2px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E5E5E1]/60">
                <span className="font-support text-[11px] uppercase tracking-[0.12em] text-[#708595]">
                  Introduction & Narrative
                </span>
                <span className="text-xs text-[#849693] font-mono">
                  slug: /{portfolio.slug}
                </span>
              </div>

              <div className="text-sm font-medium text-[#1A1A1B] mb-2">
                {portfolio.headline}
              </div>

              <p className="text-xs sm:text-sm text-[#708595] font-light leading-relaxed mb-4">
                {portfolio.bio}
              </p>
            </div>

            <div className="pt-3 border-t border-[#E5E5E1]/60 flex items-center justify-between text-xs text-[#708595]">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#388E6D]" />
                <span>{portfolio.availability || "Available for work"}</span>
              </span>
              <span className="font-mono text-[11px] text-[#849693]">
                {portfolio.email}
              </span>
            </div>
          </div>

          {/* Style & System Archetype */}
          <div className="bg-white border border-[#E5E5E1] rounded-[2px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E5E5E1]/60">
                <span className="font-support text-[11px] uppercase tracking-[0.12em] text-[#708595]">
                  Style Archetype
                </span>
                <Sparkles className="w-3.5 h-3.5 text-[#6DAEAD]" />
              </div>

              <div className="text-base font-medium text-[#1A1A1B] mb-1">
                {portfolio.stylePreset}
              </div>

              <p className="text-xs text-[#708595] font-light leading-relaxed mb-4">
                Theme: Light mode with Custom Portfolio brand accent. Typography and layout
                architecture will render around this preset.
              </p>
            </div>

            <div className="pt-3 border-t border-[#E5E5E1]/60 flex items-center justify-between text-xs text-[#849693]">
              <span className="font-support text-[10px] uppercase tracking-[0.1em]">
                Engine Status
              </span>
              <span className="text-[#6DAEAD] font-medium">Foundation Ready</span>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Legal Footer */}
      <footer className="w-full max-w-5xl flex flex-col sm:flex-row items-center justify-between text-[10px] sm:text-[11px] uppercase tracking-[0.12em] text-[#849693] pt-6 border-t border-[#E5E5E1] gap-3">
        <div>&copy; 2024 BroadBrand. All Rights Reserved.</div>
        <div className="font-support">{brand.endorsement}</div>
      </footer>
    </div>
  );
};
