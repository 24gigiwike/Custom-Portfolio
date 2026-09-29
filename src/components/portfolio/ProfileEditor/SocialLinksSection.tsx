import React from "react";
import {
  Globe,
  Linkedin,
  Github,
  Instagram,
  Twitter,
  Link2,
} from "lucide-react";
import type { PortfolioSocialLinks } from "../../../types/portfolio";

interface SocialLinksSectionProps {
  socialLinks: PortfolioSocialLinks;
  onChange: (socialLinks: PortfolioSocialLinks) => void;
}

export const SocialLinksSection: React.FC<SocialLinksSectionProps> = ({
  socialLinks,
  onChange,
}) => {
  const handleLinkChange = (key: keyof PortfolioSocialLinks, value: string) => {
    onChange({
      ...socialLinks,
      [key]: value,
    });
  };

  const platforms: {
    key: keyof PortfolioSocialLinks;
    label: string;
    placeholder: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: "website",
      label: "Personal Website / Domain",
      placeholder: "https://yourdomain.com",
      icon: <Globe className="w-4 h-4 text-[#6E8887]" />,
    },
    {
      key: "linkedin",
      label: "LinkedIn Profile",
      placeholder: "https://linkedin.com/in/username",
      icon: <Linkedin className="w-4 h-4 text-[#6E8887]" />,
    },
    {
      key: "github",
      label: "GitHub Profile",
      placeholder: "https://github.com/username",
      icon: <Github className="w-4 h-4 text-[#6E8887]" />,
    },
    {
      key: "x",
      label: "X / Twitter",
      placeholder: "https://x.com/username",
      icon: <Twitter className="w-4 h-4 text-[#6E8887]" />,
    },
    {
      key: "instagram",
      label: "Instagram Profile",
      placeholder: "https://instagram.com/username",
      icon: <Instagram className="w-4 h-4 text-[#6E8887]" />,
    },
    {
      key: "other",
      label: "Other Channel (Dribbble, Read.cv, Medium, etc.)",
      placeholder: "https://...",
      icon: <Link2 className="w-4 h-4 text-[#6E8887]" />,
    },
  ];

  return (
    <section
      id="social-presence-section"
      className="bg-white border border-[#D5E6E5] rounded-2xl p-6 sm:p-8 shadow-[0_12px_32px_rgba(109,174,173,0.08)]"
    >
      <div className="flex items-baseline justify-between pb-4 mb-6 border-b border-[#D5E6E5]/70">
        <div>
          <span className="font-support text-[11px] uppercase tracking-[0.15em] text-[#5C7372] block mb-1">
            04 / Channels & Presence
          </span>
          <h2 className="text-lg font-medium text-[#243838] tracking-[-0.02em]">
            Professional & Social Links
          </h2>
        </div>
        <span className="font-support text-[10px] uppercase tracking-[0.12em] text-[#6E8887]">
          Optional Links
        </span>
      </div>

      <p className="text-xs text-[#5C7372] font-light mb-6">
        Connect your verified channels. Only filled profiles will appear on your public portfolio.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {platforms.map((platform) => {
          // If key is 'x', also check 'twitter' if 'x' is undefined
          const val =
            platform.key === "x"
              ? socialLinks.x ?? socialLinks.twitter ?? ""
              : socialLinks[platform.key] ?? "";

          return (
            <div key={platform.key} className="flex flex-col">
              <label
                htmlFor={`social-input-${platform.key}`}
                className="font-support text-[11px] uppercase tracking-[0.14em] text-[#5C7372] block mb-1.5"
              >
                {platform.label}
              </label>

              <div className="relative flex items-center">
                <span className="absolute left-3 pointer-events-none flex items-center justify-center">
                  {platform.icon}
                </span>
                <input
                  type="text"
                  id={`social-input-${platform.key}`}
                  value={val}
                  onChange={(e) => handleLinkChange(platform.key, e.target.value)}
                  placeholder={platform.placeholder}
                  className="w-full text-xs sm:text-sm pl-9 pr-3.5 py-2.5 bg-[#F7FBFA] border border-[#D5E6E5] rounded-2xl text-[#243838] placeholder:text-[#6E8887]/60 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors"
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
