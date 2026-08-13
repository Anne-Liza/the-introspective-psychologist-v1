import type { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string };

export function Textarea({ label, className = "", ...props }: TextareaProps) {
  return (
    <label className="block space-y-2">
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
      <textarea className={`min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 ${className}`} {...props} />
    </label>
  );
}
