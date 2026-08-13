import { describe, expect, it } from "vitest";

import { hasUserPermission, type PermissionSubject } from "./permissions";

function subjectWith(...permissions: string[]): PermissionSubject {
  return {
    roles: [
      {
        id: "role-1",
        name: "Test role",
        permissions: permissions.map((code) => ({ id: code, code })),
      },
    ],
  };
}

describe("hasUserPermission", () => {
  it("allows a directly granted permission", () => {
    expect(hasUserPermission(subjectWith("appointments.read"), "appointments.read")).toBe(true);
  });

  it("denies an ungranted permission", () => {
    expect(hasUserPermission(subjectWith("appointments.read"), "appointments.update")).toBe(false);
  });

  it("treats system.all as the audited super-developer grant", () => {
    expect(hasUserPermission(subjectWith("system.all"), "roles.manage")).toBe(true);
  });

  it("fails closed when role permissions are absent", () => {
    expect(hasUserPermission({ roles: [{ id: "legacy", name: "Legacy" }] }, "users.read")).toBe(false);
  });
});
