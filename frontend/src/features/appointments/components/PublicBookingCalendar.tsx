import {
  useMemo,
  useState,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import type {
  PublicAvailableDate,
} from "../../booking-engine/lib/bookingEngineApi";

import {
  addDaysIso,
  addMonthsIso,
  bookingDateInTimeZone,
  buildCalendarMonth,
  calendarMonthLabel,
  monthStartIso,
} from "../lib/publicBookingCalendar";

const WEEKDAYS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

type Props = {
  availableDates:
    PublicAvailableDate[];
  bookingWindowDays: number;
  bookingTimezone: string;
  selectedDate: string;
  onSelectDate: (
    date: string,
  ) => void;
};

export function PublicBookingCalendar({
  availableDates,
  bookingWindowDays,
  bookingTimezone,
  selectedDate,
  onSelectDate,
}: Props) {
  const today =
    bookingDateInTimeZone(
      new Date(),
      bookingTimezone,
    );

  const windowEnd =
    addDaysIso(
      today,
      bookingWindowDays,
    );

  const minimumMonth =
    monthStartIso(today);

  const maximumMonth =
    monthStartIso(windowEnd);

  const initialDate =
    selectedDate ||
    availableDates[0]?.date ||
    today;

  const [
    visibleMonth,
    setVisibleMonth,
  ] = useState(
    () =>
      monthStartIso(initialDate),
  );

  const availableByDate =
    useMemo(
      () =>
        new Map(
          availableDates.map(
            (item) => [
              item.date,
              item,
            ],
          ),
        ),
      [availableDates],
    );

  const cells =
    buildCalendarMonth(
      visibleMonth,
    );

  const canGoPrevious =
    visibleMonth >
    minimumMonth;

  const canGoNext =
    visibleMonth <
    maximumMonth;

  return (
    <div className="rounded-2xl border border-[#dce3d3] bg-[#fbfaf5] p-3 md:p-4">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          aria-label="Previous month"
          disabled={!canGoPrevious}
          onClick={() =>
            setVisibleMonth(
              addMonthsIso(
                visibleMonth,
                -1,
              ),
            )
          }
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#dce3d3] bg-white text-[#53604b] transition hover:border-[#899b7c] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft
            aria-hidden="true"
            size={18}
          />
        </button>

        <p className="font-serif text-lg font-semibold text-[#26311f]">
          {calendarMonthLabel(
            visibleMonth,
          )}
        </p>

        <button
          type="button"
          aria-label="Next month"
          disabled={!canGoNext}
          onClick={() =>
            setVisibleMonth(
              addMonthsIso(
                visibleMonth,
                1,
              ),
            )
          }
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#dce3d3] bg-white text-[#53604b] transition hover:border-[#899b7c] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight
            aria-hidden="true"
            size={18}
          />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map(
          (weekday) => (
            <div
              key={weekday}
              className="py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#738064]"
            >
              {weekday}
            </div>
          ),
        )}

        {cells.map(
          (date, index) => {
            if (!date) {
              return (
                <div
                  key={`empty-${index}`}
                  aria-hidden="true"
                  className="min-h-11 md:min-h-12"
                />
              );
            }

            const availability =
              availableByDate.get(
                date,
              );

            const withinWindow =
              date >= today &&
              date <= windowEnd;

            const available =
              Boolean(
                availability,
              ) &&
              withinWindow;

            const selected =
              available &&
              date ===
                selectedDate;

            const dayNumber =
              Number(
                date.slice(8, 10),
              );

            const count =
              availability
                ?.available_slot_count ??
              0;

            return (
              <button
                key={date}
                type="button"
                disabled={!available}
                aria-pressed={
                  selected
                }
                aria-label={
                  available
                    ? `${date}, ${count} ${
                        count === 1
                          ? "time"
                          : "times"
                      } available`
                    : `${date}, unavailable`
                }
                onClick={() =>
                  onSelectDate(
                    date,
                  )
                }
                className={[
                  "relative flex min-h-11 flex-col items-center justify-center rounded-lg border text-[13px] transition md:min-h-12",
                  selected
                    ? "border-[#536b43] bg-[#eef3e9] font-semibold text-[#26311f] ring-1 ring-[#536b43]"
                    : available
                      ? "border-[#dce3d3] bg-white font-medium text-[#26311f] hover:border-[#899b7c] hover:bg-[#f4f7f1]"
                      : "cursor-not-allowed border-transparent bg-[#f0f1ec] text-[#a2a89d]",
                ].join(" ")}
              >
                <span>
                  {dayNumber}
                </span>

                {available ? (
                  <span
                    aria-hidden="true"
                    className="mt-1 h-1.5 w-1.5 rounded-full bg-[#6f865b]"
                  />
                ) : null}
              </button>
            );
          },
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#738064]">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#6f865b]" />
          Available
        </span>

        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-[#f0f1ec]" />
          No available times
        </span>
      </div>
    </div>
  );
}
