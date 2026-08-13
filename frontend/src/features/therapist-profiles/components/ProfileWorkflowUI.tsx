import type { ReactNode } from "react";

type SurfaceCardProps = {
  children: ReactNode;
  className?: string;
};

export function SurfaceCard({
  children,
  className = "",
}: SurfaceCardProps) {
  return (
    <section
      className={`rounded-[2rem] border border-app-border bg-app-surface ${className}`}
    >
      {children}
    </section>
  );
}

type StatusPillProps = {
  children: ReactNode;
  tone?: "quiet" | "active" | "attention";
};

export function StatusPill({
  children,
  tone = "quiet",
}: StatusPillProps) {
  const styles = {
    quiet:
      "bg-app-tint text-app-muted",
    active:
      "bg-app-soft text-app-primary",
    attention:
      "border border-app-border bg-app-surface text-app-accent",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

type WorkflowNoticeProps = {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
};

export function WorkflowNotice({
  eyebrow,
  title,
  children,
}: WorkflowNoticeProps) {
  return (
    <div className="rounded-[1.75rem] border border-app-border bg-app-soft p-5 md:p-6">
      {eyebrow ? (
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-app-accent">
          {eyebrow}
        </p>
      ) : null}

      <h3 className="mt-2 font-display text-xl leading-snug text-app-ink">
        {title}
      </h3>

      {children ? (
        <div className="mt-3 text-sm leading-7 text-app-muted">
          {children}
        </div>
      ) : null}
    </div>
  );
}

type ProfileAvatarProps = {
  name: string;
  src?: string | null;
  className?: string;
};

export function ProfileAvatar({
  name,
  src,
  className = "",
}: ProfileAvatarProps) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`aspect-[4/3] rounded-[1.5rem] object-cover ${className}`}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`grid aspect-[4/3] place-items-center rounded-[1.5rem] bg-app-soft font-display text-3xl text-app-primary ${className}`}
    >
      {initials || "TP"}
    </div>
  );
}
