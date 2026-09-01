import {
  describe,
  expect,
  it,
} from "vitest";

import {
  addDaysIso,
  bookingDateInTimeZone,
  buildCalendarMonth,
  monthStartIso,
} from "./publicBookingCalendar";

describe(
  "public booking calendar",
  () => {
    it(
      "uses the booking timezone for today",
      () => {
        const now = new Date(
          "2026-08-30T21:30:00Z",
        );

        expect(
          bookingDateInTimeZone(
            now,
            "Africa/Nairobi",
          ),
        ).toBe("2026-08-31");
      },
    );

    it(
      "calculates the booking window safely",
      () => {
        expect(
          addDaysIso(
            "2026-08-31",
            45,
          ),
        ).toBe("2026-10-15");
      },
    );

    it(
      "builds a Monday-first month grid",
      () => {
        const cells =
          buildCalendarMonth(
            "2026-09-01",
          );

        expect(cells).toHaveLength(35);

        // 1 September 2026 is Tuesday.
        expect(cells[0]).toBeNull();
        expect(cells[1]).toBe(
          "2026-09-01",
        );
        expect(cells[2]).toBe(
          "2026-09-02",
        );

        expect(
          monthStartIso(
            "2026-09-24",
          ),
        ).toBe("2026-09-01");
      },
    );
  },
);
