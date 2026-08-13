import { Search, X } from "lucide-react";

type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
};

export function SearchField({
  value,
  onChange,
  placeholder = "Search records",
  label = "Search",
}: SearchFieldProps) {
  return (
    <label className="relative block min-w-0 flex-1">
      <span className="sr-only">{label}</span>

      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      />

      <input
        type="search"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
      />

      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X
            aria-hidden="true"
            className="h-4 w-4"
          />
        </button>
      ) : null}
    </label>
  );
}
