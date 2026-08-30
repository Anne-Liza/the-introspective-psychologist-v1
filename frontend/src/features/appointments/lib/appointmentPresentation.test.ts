import { describe, expect, it } from "vitest";

import {
  appointmentDurationMinutes,
  formatAppointmentTime,
  formatAppointmentTimeRange,
  formatLocationSuffix,
  isActiveUpcomingStatus,
  normalizeAppointmentFormat,
} from "./appointmentPresentation";

describe("appointment presentation", () => {
  it("normalizes equivalent format values", () => {
    expect(
      normalizeAppointmentFormat("Online"),
    ).toBe("online");

    expect(
      normalizeAppointmentFormat(
        "in-person",
      ),
    ).toBe("in_person");

    expect(
      normalizeAppointmentFormat(
        "in_person",
      ),
    ).toBe("in_person");
  });

  it("formats times without database seconds", () => {
    expect(
      formatAppointmentTime("10:00:00"),
    ).toBe("10:00 AM");

    expect(
      formatAppointmentTime("16:30:00"),
    ).toBe("4:30 PM");

    expect(
      formatAppointmentTimeRange(
        "16:00:00",
        "17:00:00",
      ),
    ).toBe("4:00 PM – 5:00 PM");
  });

  it("calculates duration from the appointment", () => {
    expect(
      appointmentDurationMinutes(
        "16:00:00",
        "17:00:00",
      ),
    ).toBe(60);

    expect(
      appointmentDurationMinutes(
        "11:00:00",
        "12:15:00",
      ),
    ).toBe(75);
  });

  it("hides redundant location text", () => {
    expect(
      formatLocationSuffix(
        "online",
        "Online",
      ),
    ).toBe("");

    expect(
      formatLocationSuffix(
        "online",
        "Secure video session",
      ),
    ).toBe(" · Secure video session");
  });

  it("identifies active schedule statuses", () => {
    expect(
      isActiveUpcomingStatus("requested"),
    ).toBe(true);

    expect(
      isActiveUpcomingStatus("confirmed"),
    ).toBe(true);

    expect(
      isActiveUpcomingStatus("cancelled"),
    ).toBe(false);
  });
});
