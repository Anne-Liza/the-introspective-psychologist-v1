from __future__ import annotations

import json


PROFILE_ACCESS_POLICY_JSON = '{"invitation_expiry_hours": 72, "invitation_roles": {"Practice Admin": {"invited_by_roles": ["Super Developer"], "maximum_active": 1}, "Therapist": {"invited_by_roles": ["Super Developer", "Practice Admin"], "maximum_active": null}}, "registration_mode": "invitation_only", "role_capacities": {"Practice Admin": 1, "Super Developer": 1}, "staff_onboarding_mode": "invitation_only", "system_role_names": ["Super Developer"]}'

PROFILE_ACCESS_POLICY = json.loads(PROFILE_ACCESS_POLICY_JSON)


def public_registration_enabled() -> bool:
    return PROFILE_ACCESS_POLICY["registration_mode"] == "public"


def direct_user_creation_enabled() -> bool:
    return PROFILE_ACCESS_POLICY["staff_onboarding_mode"] == "direct"


def invitation_onboarding_enabled() -> bool:
    return PROFILE_ACCESS_POLICY["staff_onboarding_mode"] == "invitation_only"


def invitation_expiry_hours() -> int:
    return int(PROFILE_ACCESS_POLICY["invitation_expiry_hours"])


def invitation_role_policy(role_name: str) -> dict | None:
    value = PROFILE_ACCESS_POLICY["invitation_roles"].get(role_name)
    return dict(value) if isinstance(value, dict) else None


def invitation_role_policies() -> dict[str, dict]:
    return {
        role_name: dict(policy)
        for role_name, policy in PROFILE_ACCESS_POLICY["invitation_roles"].items()
        if isinstance(policy, dict)
    }


def role_maximum_active(role_name: str) -> int | None:
    value = PROFILE_ACCESS_POLICY.get("role_capacities", {}).get(role_name)
    return int(value) if value is not None else None


def actor_can_invite_role(actor, role_name: str) -> bool:
    policy = invitation_role_policy(role_name)
    if policy is None:
        return False
    allowed_inviters = set(policy.get("invited_by_roles", []))
    return bool(user_role_names(actor) & allowed_inviters)


def system_role_names() -> set[str]:
    return set(PROFILE_ACCESS_POLICY["system_role_names"])


def user_role_names(user) -> set[str]:
    return {role.name for role in getattr(user, "roles", [])}


def user_has_system_role(user) -> bool:
    return bool(user_role_names(user) & system_role_names())


def actor_can_manage_user(actor, target) -> bool:
    if user_has_system_role(actor):
        return True

    if user_has_system_role(target):
        return False

    if PROFILE_ACCESS_POLICY.get("staff_onboarding_mode") != "invitation_only":
        return True

    target_roles = user_role_names(target)
    return not target_roles or all(
        actor_can_invite_role(actor, role_name)
        for role_name in target_roles
    )


def actor_can_manage_role_transition(
    actor,
    current_role_names: set[str],
    new_role_name: str,
) -> bool:
    if new_role_name in system_role_names():
        return False

    if user_has_system_role(actor):
        return True

    managed_roles = set(current_role_names)
    managed_roles.add(new_role_name)

    return all(
        actor_can_invite_role(actor, role_name)
        for role_name in managed_roles
    )


def actor_can_assign_roles(_actor, role_names: list[str]) -> bool:
    requested_system_roles = set(role_names) & system_role_names()
    return not requested_system_roles
