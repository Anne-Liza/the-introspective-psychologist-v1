import { Button } from "../../../components/ui/Button";
import type { AvailabilityRule } from "../lib/availabilityApi";

const DAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

type Props = {
  rule: AvailabilityRule;
  serviceName?: string;
  therapistName?: string;
  canEdit?: boolean;
  canDelete?: boolean;
  deleting?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
};

function formatTime(value: string) {
  return value.slice(0, 5);
}

export function AvailabilityRuleCard({
  rule,
  serviceName,
  therapistName,
  canEdit = false,
  canDelete = false,
  deleting = false,
  onEdit,
  onDelete,
}: Props) {
  const dayLabel =
    DAY_LABELS[rule.day_of_week]
    ?? `Day ${rule.day_of_week}`;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {dayLabel}
          </p>

          <h3 className="mt-1 text-xl font-bold text-slate-950">
            {rule.title}
          </h3>

          {therapistName ? (
            <p className="mt-1 text-sm text-slate-600">
              {therapistName}
            </p>
          ) : null}
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
          {formatTime(rule.start_time)}
          {" to "}
          {formatTime(rule.end_time)}
        </span>
      </div>

      <dl className="mt-5 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-slate-950">
            Slot duration
          </dt>
          <dd>
            {rule.slot_duration_minutes} minutes
          </dd>
        </div>

        <div>
          <dt className="font-semibold text-slate-950">
            Buffer
          </dt>
          <dd>{rule.buffer_minutes} minutes</dd>
        </div>

        <div>
          <dt className="font-semibold text-slate-950">
            Format
          </dt>
          <dd>
            {rule.session_format
              || "To be confirmed"}
          </dd>
        </div>

        <div>
          <dt className="font-semibold text-slate-950">
            Service
          </dt>
          <dd>{serviceName || "All services"}</dd>
        </div>

        <div>
          <dt className="font-semibold text-slate-950">
            Timezone
          </dt>
          <dd>{rule.timezone}</dd>
        </div>

        <div>
          <dt className="font-semibold text-slate-950">
            Booking status
          </dt>
          <dd>
            {rule.is_active ? "Active" : "Inactive"}
            {" · "}
            {rule.is_public ? "Public" : "Private"}
          </dd>
        </div>
      </dl>

      {rule.location ? (
        <p className="mt-4 text-sm text-slate-600">
          {rule.location}
        </p>
      ) : null}

      {canEdit || canDelete ? (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {canEdit ? (
            <Button
              type="button"
              variant="secondary"
              onClick={onEdit}
            >
              Edit
            </Button>
          ) : null}

          {canDelete ? (
            <Button
              type="button"
              variant="danger"
              onClick={onDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
