import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description: string;
  eyebrow?: string;
  actions?: ReactNode;
};

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-sm font-medium text-[#718064]">
            {eyebrow}
          </p>
        ) : null}

        <h1 className="mt-1 break-words font-serif text-3xl font-semibold tracking-tight text-[#253026]">
          {title}
        </h1>

        <p className="mt-2 max-w-3xl break-words leading-7 text-[#667064]">
          {description}
        </p>
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
