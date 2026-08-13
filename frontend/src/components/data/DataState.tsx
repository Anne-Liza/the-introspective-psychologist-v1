import {
  AlertCircle,
  Inbox,
  LoaderCircle,
} from "lucide-react";

type DataStateProps = {
  isLoading: boolean;
  isError: boolean;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function DataState({
  isLoading,
  isError,
  empty,
  emptyTitle = "No records yet",
  emptyDescription = "New activity will appear here when it becomes available.",
}: DataStateProps) {
  if (isLoading) {
    return (
      <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#dfe3d4] bg-white p-5 text-sm text-[#667064] shadow-[0_8px_24px_rgba(37,48,38,0.04)]">
        <LoaderCircle className="h-5 w-5 animate-spin text-[#718064]" />
        <span>Loading information…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="flex min-w-0 items-start gap-3 rounded-2xl border border-[#e7b8b8] bg-[#fff8f8] p-5 text-sm text-[#8a3d3d]"
        role="alert"
      >
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">
            This information could not be loaded
          </p>
          <p className="mt-1 leading-6">
            Refresh the page or try again in a moment.
          </p>
        </div>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="min-w-0 rounded-2xl border border-dashed border-[#cdd5c5] bg-[#fafaf6] px-5 py-10 text-center">
        <Inbox className="mx-auto h-7 w-7 text-[#9aa493]" />
        <p className="mt-3 font-semibold text-[#34422f]">
          {emptyTitle}
        </p>
        <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-[#788176]">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return null;
}
