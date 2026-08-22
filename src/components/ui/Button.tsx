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
      "inline-flex items-center justify-center font-sans font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#6DAEAD] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none text-nowrap rounded-[2px]";

    const sizeStyles = {
      sm: "text-xs px-3 py-1.5 gap-1.5 h-8",
      md: "text-sm px-5 py-2.5 gap-2 h-10",
      lg: "text-[15px] px-6 py-3.5 gap-2.5 h-12 min-h-[48px]",
    };

    const variantStyles = {
      primary:
        "bg-[#1A1A1B] text-white hover:bg-[#2C2C2D] active:bg-[#101011] border border-transparent shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
      secondary:
        "bg-[#EDF5F5] text-[#1A1A1B] hover:bg-[#DFEEEE] active:bg-[#D1E6E6] border border-transparent",
      outline:
        "bg-white text-[#1A1A1B] border border-[#E5E5E1] hover:border-[#6DAEAD] hover:shadow-[0_4px_12px_rgba(109,174,173,0.12)] active:bg-[#F9F9F8] shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
      ghost:
        "bg-transparent text-[#708595] hover:text-[#1A1A1B] hover:bg-[#F0F0EE] active:bg-[#E5E5E1]",
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
