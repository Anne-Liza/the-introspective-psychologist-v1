import { ChevronDown } from "lucide-react";

export type FilterOption = {
  value: string;
  label: string;
};

type FilterSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  label: string;
};

export function FilterSelect({
  value,
  onChange,
  options,
  label,
}: FilterSelectProps) {
  return (
    <label className="relative block min-w-[10rem]">
      <span className="sr-only">{label}</span>

      <select
        aria-label={label}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3.5 pr-10 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      />
    </label>
  );
}
