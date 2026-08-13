import { describe, expect, it } from "vitest";

import { filterNavigationSections } from "./navigation-access";

describe("filterNavigationSections", () => {
  const sections = [
    {
      title: "Practice",
      items: [
        { label: "Dashboard", href: "/dashboard" },
        {
          label: "Appointments",
          href: "/dashboard/appointments",
          permission: "appointments.read",
        },
      ],
    },
    {
      title: "System",
      items: [
        { label: "Users", href: "/dashboard/users", permission: "users.read" },
      ],
    },
  ];

  it("keeps public dashboard items and granted items", () => {
    const result = filterNavigationSections(
      sections,
      (permission) => permission === "appointments.read",
    );

    expect(result).toEqual([
      {
        title: "Practice",
        items: [sections[0].items[0], sections[0].items[1]],
      },
    ]);
  });

  it("removes sections that contain no usable items", () => {
    const result = filterNavigationSections(sections, () => false);

    expect(result).toEqual([
      {
        title: "Practice",
        items: [sections[0].items[0]],
      },
    ]);
  });
});

it("supports capability-based exclusion for self-service navigation", () => {
  const sections = [
    {
      title: "Profile",
      items: [
        {
          label: "My Profile",
          href: "/dashboard/my-profile",
          permission: "therapist_profiles.own.read",
          exclude_permission: "therapist_profiles.read",
        },
      ],
    },
  ];

  const therapistResult = filterNavigationSections(
    sections,
    (permission) =>
      permission === "therapist_profiles.own.read",
  );

  expect(therapistResult[0]?.items).toHaveLength(1);

  const adminResult = filterNavigationSections(
    sections,
    (permission) =>
      [
        "therapist_profiles.own.read",
        "therapist_profiles.read",
      ].includes(permission),
  );

  expect(adminResult).toEqual([]);
});
