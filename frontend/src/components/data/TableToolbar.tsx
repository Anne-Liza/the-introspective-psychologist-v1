import type { ReactNode } from "react";

type TableToolbarProps = {
  children: ReactNode;
  resultCount: number;
  totalCount?: number;
  resultLabel?: string;
  onClear?: () => void;
  hasActiveFilters?: boolean;
};

export function TableToolbar({
  children,
  resultCount,
  totalCount,
  resultLabel = "record",
  onClear,
  hasActiveFilters = false,
}: TableToolbarProps) {
  const showFilteredCount =
    hasActiveFilters &&
    totalCount !== undefined;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap">
          {children}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-slate-100 pt-3 xl:border-0 xl:pt-0">
          <p
            className="whitespace-nowrap text-sm text-slate-500"
            aria-live="polite"
          >
            <span className="font-semibold text-slate-800">
              {resultCount}
            </span>

            {showFilteredCount ? (
              <>
                {" of "}
                <span className="font-semibold text-slate-800">
                  {totalCount}
                </span>
              </>
            ) : null}

            {" "}
            {resultLabel}
            {(showFilteredCount
              ? totalCount
              : resultCount) === 1
              ? ""
              : "s"}
          </p>

          {hasActiveFilters && onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="whitespace-nowrap text-sm font-semibold text-slate-700 underline-offset-4 hover:underline"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
