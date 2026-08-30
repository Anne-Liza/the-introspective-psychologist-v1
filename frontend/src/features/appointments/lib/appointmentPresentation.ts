export function normalizeAppointmentFormat(
  value: string | null | undefined,
) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "_");
}

export function formatAppointmentTime(
  value: string,
) {
  const [hourValue, minuteValue] =
    value.split(":");

  const hours = Number(hourValue);
  const minutes = Number(minuteValue);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return value;
  }

  const date = new Date(
    2000,
    0,
    1,
    hours,
    minutes,
  );

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatAppointmentTimeRange(
  startTime: string,
  endTime: string,
) {
  return `${formatAppointmentTime(
    startTime,
  )} – ${formatAppointmentTime(endTime)}`;
}

function timeInMinutes(value: string) {
  const [hourValue, minuteValue] =
    value.split(":");

  const hours = Number(hourValue);
  const minutes = Number(minuteValue);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

export function appointmentDurationMinutes(
  startTime: string,
  endTime: string,
) {
  const start = timeInMinutes(startTime);
  const end = timeInMinutes(endTime);

  if (
    start === null ||
    end === null ||
    end <= start
  ) {
    return null;
  }

  return end - start;
}

export function formatLocationSuffix(
  format: string | null | undefined,
  location: string | null | undefined,
) {
  const normalizedLocation =
    location?.trim();

  if (!normalizedLocation) {
    return "";
  }

  if (
    normalizeAppointmentFormat(format) ===
    normalizeAppointmentFormat(
      normalizedLocation,
    )
  ) {
    return "";
  }

  return ` · ${normalizedLocation}`;
}

export function isActiveUpcomingStatus(
  status: string,
) {
  return (
    status === "requested" ||
    status === "confirmed"
  );
}
