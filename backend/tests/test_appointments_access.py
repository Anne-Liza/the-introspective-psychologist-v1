from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.modules.appointments import routes
from app.modules.appointments.schemas import (
    TherapistAppointmentRead,
)
from app.modules.auth.dependencies import require_permission
from app.modules.therapist_profiles.access import (
    resolve_assigned_therapist_profile_id,
)


class ScalarResults:
    def __init__(self, records):
        self.records = records

    def all(self):
        return self.records


def make_user(
    *permission_codes: str,
    user_id: str = "user-1",
):
    return SimpleNamespace(
        id=user_id,
        roles=[
            SimpleNamespace(
                permissions=[
                    SimpleNamespace(code=code)
                    for code in permission_codes
                ]
            )
        ],
    )


def make_appointment(
    *,
    appointment_id: str,
    therapist_profile_id: str,
    client_name: str,
):
    return SimpleNamespace(
        id=appointment_id,
        appointment_date="2026-09-02",
        start_time="10:00:00",
        end_time="11:00:00",
        client_name=client_name,
        client_email="private@example.com",
        client_phone="+254700000000",
        service_id="service-1",
        therapist_profile_id=therapist_profile_id,
        status="confirmed",
        session_format="online",
        location="Online",
        client_message="Private client message",
        admin_notes="Private admin note",
        source="public_request",
        sort_order=0,
    )


def test_appointments_read_permission_allows_admin():
    admin = make_user(
        "appointments.read",
        "appointments.create",
        "appointments.update",
        "appointments.delete",
    )

    dependency = require_permission(
        "appointments.read"
    )

    assert dependency(admin) is admin


def test_therapist_cannot_use_global_appointments_permission():
    therapist = make_user(
        "appointments.own.read"
    )

    dependency = require_permission(
        "appointments.read"
    )

    with pytest.raises(HTTPException) as exc_info:
        dependency(therapist)

    assert exc_info.value.status_code == 403
    assert (
        exc_info.value.detail
        == "Missing required permission: appointments.read"
    )


def test_therapist_has_own_appointments_permission():
    therapist = make_user(
        "appointments.own.read"
    )

    dependency = require_permission(
        "appointments.own.read"
    )

    assert dependency(therapist) is therapist


def test_admin_list_returns_practice_appointments():
    appointments = [
        make_appointment(
            appointment_id="appointment-1",
            therapist_profile_id="therapist-1",
            client_name="Client One",
        ),
        make_appointment(
            appointment_id="appointment-2",
            therapist_profile_id="therapist-2",
            client_name="Client Two",
        ),
    ]

    class DB:
        def scalars(self, _statement):
            return ScalarResults(appointments)

    result = routes.list_appointments(
        db=DB(),
        current_user=make_user(
            "appointments.read"
        ),
    )

    assert len(result) == 2
    assert {
        appointment.therapist_profile_id
        for appointment in result
    } == {
        "therapist-1",
        "therapist-2",
    }


def test_my_appointments_query_is_scoped_to_current_therapist(
    monkeypatch,
):
    therapist = make_user(
        "appointments.own.read",
        user_id="therapist-user-1",
    )

    own_appointment = make_appointment(
        appointment_id="appointment-1",
        therapist_profile_id="therapist-1",
        client_name="Own Client",
    )

    captured_statements = []

    class DB:
        def scalars(self, statement):
            captured_statements.append(statement)
            return ScalarResults(
                [own_appointment]
            )

    monkeypatch.setattr(
        routes,
        "resolve_assigned_therapist_profile_id",
        lambda db, current_user: "therapist-1",
    )

    result = routes.list_my_appointments(
        db=DB(),
        current_user=therapist,
    )

    assert len(result) == 1
    assert result[0].therapist_profile_id == (
        "therapist-1"
    )

    assert len(captured_statements) == 1

    compiled_query = str(
        captured_statements[0].compile(
            compile_kwargs={
                "literal_binds": True,
            }
        )
    )

    assert "therapist_profile_id" in compiled_query
    assert "therapist-1" in compiled_query


def test_therapist_appointment_schema_hides_sensitive_fields():
    appointment = make_appointment(
        appointment_id="appointment-1",
        therapist_profile_id="therapist-1",
        client_name="Client One",
    )

    payload = (
        TherapistAppointmentRead
        .model_validate(appointment)
        .model_dump()
    )

    assert payload["client_name"] == "Client One"

    assert payload["therapist_profile_id"] == (
        "therapist-1"
    )

    forbidden_fields = {
        "client_email",
        "client_phone",
        "client_message",
        "admin_notes",
        "source",
    }

    assert forbidden_fields.isdisjoint(
        payload.keys()
    )


def test_linked_user_resolves_to_therapist_profile():
    class DB:
        def scalar(self, _statement):
            return SimpleNamespace(
                id="therapist-1"
            )

    user = make_user(
        "appointments.own.read"
    )

    assert (
        resolve_assigned_therapist_profile_id(
            DB(),
            user,
        )
        == "therapist-1"
    )


def test_unlinked_therapist_returns_setup_conflict():
    class DB:
        def scalar(self, _statement):
            return None

    user = make_user(
        "appointments.own.read"
    )

    with pytest.raises(HTTPException) as exc_info:
        resolve_assigned_therapist_profile_id(
            DB(),
            user,
        )

    assert exc_info.value.status_code == 409
    assert (
        "not linked to a therapist profile"
        in str(exc_info.value.detail)
    )
