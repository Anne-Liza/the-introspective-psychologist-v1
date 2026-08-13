import { describe, expect, it } from "vitest";

import {
  canManageTeamMember,
  selectableRoleOptions,
} from "./teamMemberAccess";

describe("team member lifecycle access", () => {
  it("prevents users from changing their own access", () => {
    expect(
      canManageTeamMember({
        actorId: "user-1",
        memberId: "user-1",
        memberRoleNames: ["Practice Admin"],
        manageableRoleNames: new Set(["Therapist"]),
        canUpdateUsers: true,
      }),
    ).toBe(false);
  });

  it("allows management only when every current role is managed", () => {
    const manageableRoleNames = new Set([
      "Therapist",
      "Senior Therapist",
    ]);

    expect(
      canManageTeamMember({
        actorId: "admin",
        memberId: "therapist",
        memberRoleNames: ["Therapist"],
        manageableRoleNames,
        canUpdateUsers: true,
      }),
    ).toBe(true);

    expect(
      canManageTeamMember({
        actorId: "admin",
        memberId: "protected-admin",
        memberRoleNames: ["Practice Admin"],
        manageableRoleNames,
        canUpdateUsers: true,
      }),
    ).toBe(false);
  });

  it("allows an authorized administrator to manage an unassigned account", () => {
    expect(
      canManageTeamMember({
        actorId: "admin",
        memberId: "unassigned",
        memberRoleNames: [],
        manageableRoleNames: new Set(["Therapist"]),
        canUpdateUsers: true,
      }),
    ).toBe(true);
  });

  it("hides full destination roles while preserving the current role", () => {
    const roles = [
      {
        role_name: "Therapist",
        description: null,
        maximum_active: null,
        active_count: 2,
        pending_count: 0,
        available_slots: null,
      },
      {
        role_name: "Senior Therapist",
        description: null,
        maximum_active: 1,
        active_count: 1,
        pending_count: 0,
        available_slots: 0,
      },
      {
        role_name: "Clinical Lead",
        description: null,
        maximum_active: 1,
        active_count: 1,
        pending_count: 0,
        available_slots: 0,
      },
    ];

    expect(
      selectableRoleOptions(
        roles,
        "Senior Therapist",
      ).map((role) => role.role_name),
    ).toEqual([
      "Therapist",
      "Senior Therapist",
    ]);
  });
});
