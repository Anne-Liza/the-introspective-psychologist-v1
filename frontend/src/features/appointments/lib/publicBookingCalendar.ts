function isoParts(
  value: string,
): [number, number, number] {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})$/,
  );

  if (!match) {
    throw new Error(
      `Invalid ISO date: ${value}`,
    );
  }

  return [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
}

function isoFromUtcDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0");
  const day = String(
    date.getUTCDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function addDaysIso(
  value: string,
  days: number,
) {
  const [year, month, day] =
    isoParts(value);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day + days,
      12,
    ),
  );

  return isoFromUtcDate(date);
}

export function monthStartIso(
  value: string,
) {
  const [year, month] =
    isoParts(value);

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    "01",
  ].join("-");
}

export function addMonthsIso(
  monthValue: string,
  months: number,
) {
  const [year, month] =
    isoParts(monthValue);

  const date = new Date(
    Date.UTC(
      year,
      month - 1 + months,
      1,
      12,
    ),
  );

  return isoFromUtcDate(date);
}

export function bookingDateInTimeZone(
  now: Date,
  timeZone: string,
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    ).formatToParts(now);

  const values = Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value,
    ]),
  );

  return [
    values.year,
    values.month,
    values.day,
  ].join("-");
}

export function buildCalendarMonth(
  monthValue: string,
): Array<string | null> {
  const [year, month] =
    isoParts(monthValue);

  const firstDay = new Date(
    Date.UTC(
      year,
      month - 1,
      1,
      12,
    ),
  );

  // Monday = 0, Sunday = 6.
  const leadingCells =
    (firstDay.getUTCDay() + 6) % 7;

  const daysInMonth =
    new Date(
      Date.UTC(
        year,
        month,
        0,
        12,
      ),
    ).getUTCDate();

  const totalCells =
    Math.ceil(
      (leadingCells + daysInMonth) / 7,
    ) * 7;

  const cells: Array<
    string | null
  > = Array(totalCells).fill(null);

  for (
    let day = 1;
    day <= daysInMonth;
    day += 1
  ) {
    const date = new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        12,
      ),
    );

    cells[
      leadingCells + day - 1
    ] = isoFromUtcDate(date);
  }

  return cells;
}

export function calendarMonthLabel(
  monthValue: string,
) {
  const [year, month] =
    isoParts(monthValue);

  return new Intl.DateTimeFormat(
    "en",
    {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    },
  ).format(
    new Date(
      Date.UTC(
        year,
        month - 1,
        1,
        12,
      ),
    ),
  );
}
