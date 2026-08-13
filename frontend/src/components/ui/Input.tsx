import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function Input({ label, className = "", ...props }: InputProps) {
  return (
    <label className="block min-w-0 space-y-2">
      {label ? <span className="text-sm font-medium text-slate-700">{label}</span> : null}
      <input
        className={`min-w-0 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-slate-900 ${className}`}
        {...props}
      />
    </label>
  );
}
