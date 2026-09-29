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
      className={`relative flex min-h-[52px] w-full max-w-[360px] items-center justify-center gap-3 rounded-xl border border-white/80 bg-white px-6 py-3.5 text-[15px] font-bold tracking-[-0.02em] text-[#243838] shadow-[0_10px_30px_rgba(36,56,56,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(109,174,173,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#6DAEAD] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      aria-label="Continue with Google"
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-[#6DAEAD]" />
      ) : (
        <svg
          className="h-[18px] w-[18px] flex-shrink-0"
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
      <span className="truncate">Continue with Google</span>
    </button>
  );
};
