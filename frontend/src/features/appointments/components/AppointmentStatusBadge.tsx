import type {
  AppointmentStatus,
} from "../lib/appointmentsApi";

type Props = {
  status: AppointmentStatus;
};

const LABELS: Record<
  AppointmentStatus,
  string
> = {
  requested: "Requested",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No show",
};

const CLASSES: Record<
  AppointmentStatus,
  string
> = {
  requested:
    "bg-amber-50 text-amber-800",
  confirmed:
    "bg-emerald-50 text-emerald-800",
  declined:
    "bg-rose-50 text-rose-800",
  cancelled:
    "bg-slate-100 text-slate-700",
  completed:
    "bg-blue-50 text-blue-800",
  no_show:
    "bg-orange-50 text-orange-800",
};

export function AppointmentStatusBadge({
  status,
}: Props) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${CLASSES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
