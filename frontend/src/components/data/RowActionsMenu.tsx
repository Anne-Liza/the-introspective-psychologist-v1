import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { MoreHorizontal } from "lucide-react";

type RowActionsMenuProps = {
  children: ReactNode;
  label?: string;
};

export function RowActionsMenu({
  children,
  label = "Open actions",
}: RowActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(
      event: MouseEvent,
    ) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node,
        )
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown,
    );
    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      );
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className="relative inline-block text-left"
    >
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() =>
          setIsOpen((current) => !current)
        }
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
      >
        <MoreHorizontal
          aria-hidden="true"
          className="h-5 w-5"
        />
      </button>

      {isOpen ? (
        <div
          role="menu"
          onClick={() => setIsOpen(false)}
          className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export const rowActionClassName =
  "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50";

export const destructiveRowActionClassName =
  "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50";
