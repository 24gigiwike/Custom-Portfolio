import React, { useState } from "react";
import { User, MapPin, Briefcase, Image as ImageIcon, Link as LinkIcon } from "lucide-react";

interface IdentitySectionProps {
  title: string;
  profession: string;
  location: string;
  profileImage: string | null;
  errors?: {
    title?: string;
    profession?: string;
  };
  onTitleChange: (value: string) => void;
  onProfessionChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onProfileImageChange: (value: string | null) => void;
}

export const IdentitySection: React.FC<IdentitySectionProps> = ({
  title,
  profession,
  location,
  profileImage,
  errors,
  onTitleChange,
  onProfessionChange,
  onLocationChange,
  onProfileImageChange,
}) => {
  const [showImageUrlInput, setShowImageUrlInput] = useState(false);

  // Compute fallback initials from title
  const getInitials = (nameStr: string) => {
    if (!nameStr.trim()) return "CP";
    const parts = nameStr.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <section
      id="identity-section"
      className="bg-white border border-[#E5E5E1] rounded-[2px] p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
    >
      <div className="flex items-baseline justify-between pb-4 mb-6 border-b border-[#E5E5E1]/70">
        <div>
          <span className="font-support text-[11px] uppercase tracking-[0.15em] text-[#708595] block mb-1">
            01 / Identity
          </span>
          <h2 className="text-lg font-medium text-[#1A1A1B] tracking-[-0.02em]">
            Personal & Professional Identity
          </h2>
        </div>
        <span className="font-support text-[10px] uppercase tracking-[0.12em] text-[#849693]">
          Core Presence
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        {/* Profile Image & Avatar Display */}
        <div className="flex flex-col items-start gap-3">
          <label className="font-support text-[11px] uppercase tracking-[0.14em] text-[#708595] block">
            Profile Portrait
          </label>

          <div className="relative group">
            {profileImage ? (
              <img
                src={profileImage}
                alt={title || "Profile"}
                referrerPolicy="no-referrer"
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-[2px] border border-[#E5E5E1] object-cover shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
              />
            ) : (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[2px] bg-[#F8F8F7] border border-[#E5E5E1] flex flex-col items-center justify-center text-[#708595]">
                <span className="font-mono text-xl font-medium tracking-tight text-[#1A1A1B]">
                  {getInitials(title)}
                </span>
                <span className="font-support text-[9px] uppercase tracking-[0.12em] text-[#849693] mt-1">
                  Portrait
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            id="toggle-custom-image-url"
            onClick={() => setShowImageUrlInput(!showImageUrlInput)}
            className="flex items-center gap-1.5 text-xs text-[#6DAEAD] hover:text-[#1A1A1B] font-medium transition-colors duration-150"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>{showImageUrlInput ? "Hide image URL" : "Custom image URL"}</span>
          </button>

          {showImageUrlInput && (
            <div className="w-full mt-1">
              <input
                type="url"
                id="profile-image-url-input"
                value={profileImage || ""}
                onChange={(e) => onProfileImageChange(e.target.value.trim() || null)}
                placeholder="https://..."
                className="w-full text-xs font-mono px-3 py-2 bg-[#F8F8F7] border border-[#E5E5E1] rounded-[2px] text-[#1A1A1B] placeholder:text-[#849693]/60 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors"
              />
              <span className="font-support text-[10px] text-[#849693] mt-1 block">
                Direct image link (HTTPS)
              </span>
            </div>
          )}
        </div>

        {/* Identity Inputs */}
        <div className="md:col-span-2 space-y-5">
          {/* Name / Title */}
          <div>
            <label
              htmlFor="identity-name-input"
              className="font-support text-[11px] uppercase tracking-[0.14em] text-[#708595] block mb-2"
            >
              Full Name / Display Title <span className="text-[#B91C1C]">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                id="identity-name-input"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="e.g. Alex Morgan"
                className={`w-full text-sm sm:text-base px-3.5 py-2.5 bg-[#F8F8F7] border rounded-[2px] text-[#1A1A1B] placeholder:text-[#849693]/60 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors ${
                  errors.title ? "border-[#B91C1C]" : "border-[#E5E5E1]"
                }`}
                maxLength={100}
              />
            </div>
            {errors.title ? (
              <p className="text-xs text-[#B91C1C] mt-1 font-light">{errors.title}</p>
            ) : (
              <p className="text-xs text-[#849693] mt-1 font-light">
                The primary display name shown across your portfolio.
              </p>
            )}
          </div>

          {/* Profession & Location Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Profession */}
            <div>
              <label
                htmlFor="identity-profession-input"
                className="font-support text-[11px] uppercase tracking-[0.14em] text-[#708595] block mb-2"
              >
                Profession / Role <span className="text-[#B91C1C]">*</span>
              </label>
              <div className="relative flex items-center">
                <Briefcase className="w-4 h-4 text-[#849693] absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  id="identity-profession-input"
                  value={profession}
                  onChange={(e) => onProfessionChange(e.target.value)}
                  placeholder="e.g. Web Designer"
                  className={`w-full text-sm pl-9 pr-3.5 py-2.5 bg-[#F8F8F7] border rounded-[2px] text-[#1A1A1B] placeholder:text-[#849693]/60 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors ${
                    errors.profession ? "border-[#B91C1C]" : "border-[#E5E5E1]"
                  }`}
                  maxLength={100}
                />
              </div>
              {errors.profession ? (
                <p className="text-xs text-[#B91C1C] mt-1 font-light">{errors.profession}</p>
              ) : (
                <p className="text-xs text-[#849693] mt-1 font-light">
                  Your core discipline or primary professional title.
                </p>
              )}
            </div>

            {/* Location */}
            <div>
              <label
                htmlFor="identity-location-input"
                className="font-support text-[11px] uppercase tracking-[0.14em] text-[#708595] block mb-2"
              >
                Location <span className="text-[#849693] font-normal lowercase">(optional)</span>
              </label>
              <div className="relative flex items-center">
                <MapPin className="w-4 h-4 text-[#849693] absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  id="identity-location-input"
                  value={location}
                  onChange={(e) => onLocationChange(e.target.value)}
                  placeholder="e.g. Lagos, Nigeria"
                  className="w-full text-sm pl-9 pr-3.5 py-2.5 bg-[#F8F8F7] border border-[#E5E5E1] rounded-[2px] text-[#1A1A1B] placeholder:text-[#849693]/60 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors"
                  maxLength={100}
                />
              </div>
              <p className="text-xs text-[#849693] mt-1 font-light">
                City, country, or remote base.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
