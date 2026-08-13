import type {
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "ghost";

type ButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
    variant?: ButtonVariant;
  };

const variants: Record<ButtonVariant, string> = {
  primary:
    "border border-[#4f6047] bg-[#4f6047] text-white hover:border-[#3f4e39] hover:bg-[#3f4e39]",
  secondary:
    "border border-[#ccd4c4] bg-white text-[#34422f] hover:border-[#aebaa5] hover:bg-[#f5f6f1]",
  success:
    "border border-[#3f704f] bg-[#3f704f] text-white hover:border-[#315d40] hover:bg-[#315d40]",
  warning:
    "border border-[#d5a43c] bg-[#f5ead0] text-[#6e531c] hover:bg-[#eedcae]",
  danger:
    "border border-[#c94b4b] bg-[#c94b4b] text-white hover:border-[#a93c3c] hover:bg-[#a93c3c]",
  ghost:
    "border border-transparent bg-transparent text-[#56684b] hover:bg-[#eef1e8] hover:text-[#34422f]",
};

export function Button({
  children,
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex max-w-full items-center justify-center rounded-xl px-4 py-2.5 text-center text-sm font-semibold leading-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#718064] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-[#d9ddd5] disabled:bg-[#e7e9e4] disabled:text-[#92988f] disabled:opacity-100 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
