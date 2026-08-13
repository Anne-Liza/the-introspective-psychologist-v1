export type ManagedRoleOption = {
  role_name: string;
  description: string | null;
  maximum_active: number | null;
  active_count: number;
  pending_count: number;
  available_slots: number | null;
};

export function canManageTeamMember({
  actorId,
  memberId,
  memberRoleNames,
  manageableRoleNames,
  canUpdateUsers,
}: {
  actorId: string | undefined;
  memberId: string;
  memberRoleNames: string[];
  manageableRoleNames: Set<string>;
  canUpdateUsers: boolean;
}) {
  if (!canUpdateUsers || !actorId || actorId === memberId) {
    return false;
  }

  if (!memberRoleNames.length) {
    return true;
  }

  return memberRoleNames.every((roleName) =>
    manageableRoleNames.has(roleName),
  );
}

export function selectableRoleOptions(
  roles: ManagedRoleOption[],
  currentRoleName: string | undefined,
) {
  return roles.filter(
    (role) =>
      role.role_name === currentRoleName
      || role.available_slots === null
      || role.available_slots > 0,
  );
}
