import React, { type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = "",
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      type = "button",
      id,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-sans font-bold tracking-[-0.02em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#6DAEAD] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none text-nowrap rounded-xl";

    const sizeStyles = {
      sm: "text-xs px-3.5 py-2 gap-1.5 h-9",
      md: "text-sm px-5 py-2.5 gap-2 h-11",
      lg: "text-[15px] px-6 py-3.5 gap-2.5 h-12 min-h-[48px]",
    };

    const variantStyles = {
      primary:
        "bg-[#6DAEAD] text-white hover:bg-[#5A9998] active:bg-[#4E8C8B] border border-transparent shadow-[0_8px_20px_rgba(109,174,173,0.28)]",
      secondary:
        "bg-[#E7F4F3] text-[#2F6463] hover:bg-[#D7EEED] active:bg-[#C9E6E5] border border-transparent",
      outline:
        "bg-white text-[#2F6463] border border-[#C5DDDC] hover:border-[#6DAEAD] hover:bg-[#F4FBFA] active:bg-[#E7F4F3] shadow-[0_4px_16px_rgba(109,174,173,0.08)]",
      ghost:
        "bg-transparent text-[#5C7372] hover:text-[#2F6463] hover:bg-[#E7F4F3] active:bg-[#D7EEED]",
    };

    return (
      <button
        ref={ref}
        type={type}
        id={id}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";
