from datetime import date, time
from types import SimpleNamespace

from app.modules.appointments import notifications


def make_appointment(**overrides):
    values = {
        "id": "appointment-1",
        "appointment_date": date(2026, 9, 2),
        "start_time": time(10, 0),
        "end_time": time(11, 0),
        "client_name": "Client One",
        "client_email": "private@example.com",
        "client_phone": "+254700000000",
        "service_id": "service-1",
        "therapist_profile_id": "therapist-1",
        "status": "requested",
        "session_format": "online",
        "location": "Online",
        "client_message": (
            "Private message from the client."
        ),
        "admin_notes": (
            "Private note for administrators."
        ),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_assignment_event_when_therapist_changes():
    appointment = make_appointment(
        therapist_profile_id="therapist-2"
    )

    before = (
        notifications
        .therapist_notification_snapshot(
            make_appointment()
        )
    )

    assert (
        notifications
        .therapist_notification_event(
            before,
            appointment,
        )
        == "assigned"
    )


def test_schedule_change_creates_update_event():
    appointment = make_appointment()

    before = (
        notifications
        .therapist_notification_snapshot(
            appointment
        )
    )

    appointment.start_time = time(12, 0)
    appointment.end_time = time(13, 0)

    assert (
        notifications
        .therapist_notification_event(
            before,
            appointment,
        )
        == "updated"
    )


def test_cancellation_creates_cancelled_event():
    appointment = make_appointment()

    before = (
        notifications
        .therapist_notification_snapshot(
            appointment
        )
    )

    appointment.status = "cancelled"

    assert (
        notifications
        .therapist_notification_event(
            before,
            appointment,
        )
        == "cancelled"
    )


def test_admin_only_change_does_not_notify():
    appointment = make_appointment()

    before = (
        notifications
        .therapist_notification_snapshot(
            appointment
        )
    )

    appointment.admin_notes = (
        "Changed administrator-only note."
    )
    appointment.client_phone = "+254711111111"
    appointment.client_message = (
        "Changed private client message."
    )

    assert (
        notifications
        .therapist_notification_event(
            before,
            appointment,
        )
        is None
    )


def test_unassignment_does_not_email_old_therapist():
    appointment = make_appointment()

    before = (
        notifications
        .therapist_notification_snapshot(
            appointment
        )
    )

    appointment.therapist_profile_id = None

    assert (
        notifications
        .therapist_notification_event(
            before,
            appointment,
        )
        is None
    )


def test_notification_contains_only_safe_details(
    monkeypatch,
):
    appointment = make_appointment()

    profile = SimpleNamespace(
        id="therapist-1",
        user_id="user-1",
        full_name="Therapist One",
    )

    user = SimpleNamespace(
        id="user-1",
        email="therapist@example.com",
        is_active=True,
    )

    service = SimpleNamespace(
        id="service-1",
        name="Individual Therapy",
        service_format="therapy",
    )

    monkeypatch.setattr(
        notifications,
        "_therapist_recipient",
        lambda db, appointment: (
            profile,
            user,
        ),
    )

    monkeypatch.setattr(
        notifications,
        "_appointment_service",
        lambda db, appointment: service,
    )

    monkeypatch.setattr(
        notifications,
        "_active_template",
        lambda db, event: None,
    )

    sent = {}

    def fake_send_email(
        db,
        *,
        to_email,
        subject,
        body,
    ):
        sent.update(
            to_email=to_email,
            subject=subject,
            body=body,
        )
        return SimpleNamespace(
            status="sent"
        )

    monkeypatch.setattr(
        notifications,
        "send_email",
        fake_send_email,
    )

    result = (
        notifications
        .notify_therapist_appointment(
            object(),
            appointment=appointment,
            event="assigned",
        )
    )

    assert result is not None
    assert (
        sent["to_email"]
        == "therapist@example.com"
    )

    assert "Client One" in sent["body"]
    assert (
        "Individual Therapy"
        in sent["body"]
    )
    assert "02 Sep 2026" in sent["body"]
    assert "10:00" in sent["body"]
    assert "11:00" in sent["body"]

    forbidden = (
        "private@example.com",
        "+254700000000",
        "Private message from the client.",
        "Private note for administrators.",
    )

    for value in forbidden:
        assert value not in sent["body"]


def test_missing_recipient_skips_notification(
    monkeypatch,
):
    appointment = make_appointment()

    monkeypatch.setattr(
        notifications,
        "_therapist_recipient",
        lambda db, appointment: None,
    )

    called = False

    def fake_send_email(*args, **kwargs):
        nonlocal called
        called = True

    monkeypatch.setattr(
        notifications,
        "send_email",
        fake_send_email,
    )

    result = (
        notifications
        .notify_therapist_appointment(
            object(),
            appointment=appointment,
            event="assigned",
        )
    )

    assert result is None
    assert called is False
