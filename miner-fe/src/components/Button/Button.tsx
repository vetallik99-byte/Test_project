// miner/src/components/Button.tsx
import React from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      fullWidth = false,
      className = "",
      children,
      onKeyDown,
      onKeyUp,
      onClick,
      disabled,
      onBlur,
      ...rest
    },
    ref,
  ) => {
    const cls = [
      styles.button,
      styles[variant],
      styles[size],
      fullWidth ? styles.fullWidth : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const [isActive, setIsActive] = React.useState(false);

    // Ensure Space/Enter activate the button reliably across browsers and reflect :active via data attribute
    const handleKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
      onKeyDown?.(e);
      if (e.defaultPrevented) return;
      if (disabled) return;

      if (e.key === "Enter") {
        e.preventDefault();
        setIsActive(true);
        (e.currentTarget as HTMLButtonElement).click();
      } else if (e.key === " ") {
        // Prevent page scroll; set active visual until keyup
        e.preventDefault();
        setIsActive(true);
      }
    };

    const handleKeyUp: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
      onKeyUp?.(e);
      if (e.defaultPrevented) return;
      if (disabled) return;

      if (e.key === " ") {
        e.preventDefault();
        (e.currentTarget as HTMLButtonElement).click();
        setIsActive(false);
      } else if (e.key === "Enter") {
        setIsActive(false);
      }
    };

    const handleBlur: React.FocusEventHandler<HTMLButtonElement> = (e) => {
      onBlur?.(e);
      setIsActive(false);
    };

    return (
      <button
        ref={ref}
        className={cls}
        disabled={disabled}
        data-active={isActive ? "true" : undefined}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={handleBlur}
        onClick={onClick}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;
