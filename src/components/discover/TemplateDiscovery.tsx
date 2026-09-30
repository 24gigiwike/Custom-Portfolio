import React from "react";
import { listTemplates } from "../../lib/templates";
import type { UserProfile } from "../../types";
import { brand } from "../../config/branding";

interface TemplateDiscoveryProps {
  account: UserProfile | null;
  onSignOut: () => void;
}

export const TemplateDiscovery: React.FC<TemplateDiscoveryProps> = ({ account, onSignOut }) => {
  const templates = listTemplates();
  const title = account?.professionalProfile?.title;
  const name = account?.accountPrivate?.firstName || account?.displayName;

  return (
    <div id="template-discovery" className="min-h-screen bg-[#F8F8F7] text-[#243838]">
      <div className="pointer-events-none fixed left-0 top-0 z-30 h-full w-1 bg-gradient-to-b from-[#708595] to-[#6DAEAD]" />
      <header className="flex items-center justify-between px-5 py-5 sm:px-10">
        <div>
          <p className="text-lg font-bold tracking-[-0.04em]">{brand.name}</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5C7372]">{brand.endorsement}</p>
        </div>
        <button type="button" onClick={onSignOut} className="text-sm font-bold text-[#3E7574]">
          Sign out
        </button>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-col px-5 pb-20 pt-8 sm:px-10 sm:pt-16">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">Template discovery</p>
        <h1 className="mt-3 text-4xl font-bold leading-[1.05] tracking-[-0.045em] sm:text-5xl">
          {name ? `${name}, your starting point is next.` : "Your starting point is next."}
        </h1>
        <p className="mt-5 max-w-lg text-base font-medium leading-relaxed text-[#5C7372]">
          Template discovery is coming next. Your profile is saved, and a portfolio is created only after you choose a direction.
        </p>
        {title && (
          <p className="mt-6 text-sm font-semibold text-[#243838]">
            Saved for this search: <span className="font-medium text-[#5C7372]">{title}</span>
          </p>
        )}
        {templates.length === 0 && (
          <div className="mt-10 rounded-2xl border border-[#E4E4E0] bg-white px-6 py-8">
            <p className="text-lg font-bold tracking-[-0.03em]">No directions to choose yet.</p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[#5C7372]">
              When portfolio templates are ready, they will appear here to preview. Nothing is published before then.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};
