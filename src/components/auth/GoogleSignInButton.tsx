import React from "react";
import { Loader2 } from "lucide-react";

interface GoogleSignInButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onClick,
  isLoading = false,
  disabled = false,
  className = "",
}) => {
  return (
    <button
      id="google-signin-button"
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`relative w-full max-w-[320px] flex items-center justify-center gap-3 px-6 py-3.5 min-h-[48px] bg-white hover:bg-white active:bg-[#F9F9F8] text-[#1A1A1B] font-sans font-medium text-[15px] border border-[#E5E5E1] hover:border-[#6DAEAD] hover:shadow-[0_4px_12px_rgba(109,174,173,0.12)] rounded-[2px] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#6DAEAD] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none ${className}`}
      aria-label="Continue with Google"
    >
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin text-[#6DAEAD]" />
      ) : (
        /* Official Google 4-Color 'G' Logo */
        <svg
          className="w-[18px] h-[18px] flex-shrink-0"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
      )}
      <span className="truncate tracking-[-0.01em]">Continue with Google</span>
    </button>
  );
};
