from datetime import date, time
from types import SimpleNamespace

import pytest

from app.modules.booking_engine import service
from app.modules.services.models import Service


class ScalarResults:
    def __init__(self, records):
        self.records = records

    def all(self):
        return self.records


class FakeDB:
    def __init__(
        self,
        *,
        rule,
        service_duration,
    ):
        self.results = iter(
            [
                [rule],
                [],
                [],
                [],
            ]
        )

        self.service = SimpleNamespace(
            duration_minutes=service_duration,
        )

    def scalars(self, _statement):
        return ScalarResults(
            next(self.results)
        )

    def get(self, model, record_id):
        if (
            model is Service
            and record_id == "service-1"
        ):
            return self.service

        return None


def make_rule(
    *,
    service_id,
    slot_duration_minutes=60,
):
    return SimpleNamespace(
        start_time=time(9, 0),
        end_time=time(11, 0),
        slot_duration_minutes=(
            slot_duration_minutes
        ),
        buffer_minutes=10,
        service_id=service_id,
        therapist_profile_id=(
            "therapist-1"
        ),
        session_format="Online",
        location=None,
    )


@pytest.mark.parametrize(
    "rule_service_id",
    [
        "service-1",
        None,
    ],
)
def test_service_duration_controls_slot_length(
    monkeypatch,
    rule_service_id,
):
    monkeypatch.setattr(
        service,
        "_slot_has_started",
        lambda *_args, **_kwargs: False,
    )

    db = FakeDB(
        rule=make_rule(
            service_id=rule_service_id,
            slot_duration_minutes=60,
        ),
        service_duration=30,
    )

    slots = service.list_bookable_slots(
        db,
        slot_date=date(2030, 9, 2),
        service_id="service-1",
        therapist_profile_id=(
            "therapist-1"
        ),
        session_format="Online",
        manage_expiry=False,
    )

    assert [
        (
            slot.start_time,
            slot.end_time,
        )
        for slot in slots
    ] == [
        (
            time(9, 0),
            time(9, 30),
        ),
        (
            time(9, 40),
            time(10, 10),
        ),
        (
            time(10, 20),
            time(10, 50),
        ),
    ]


def test_availability_duration_is_fallback_without_service_duration(
    monkeypatch,
):
    monkeypatch.setattr(
        service,
        "_slot_has_started",
        lambda *_args, **_kwargs: False,
    )

    db = FakeDB(
        rule=make_rule(
            service_id="service-1",
            slot_duration_minutes=60,
        ),
        service_duration=None,
    )

    slots = service.list_bookable_slots(
        db,
        slot_date=date(2030, 9, 2),
        service_id="service-1",
        therapist_profile_id=(
            "therapist-1"
        ),
        session_format="Online",
        manage_expiry=False,
    )

    assert len(slots) == 1

    assert slots[0].start_time == time(
        9,
        0,
    )

    assert slots[0].end_time == time(
        10,
        0,
    )


def test_therapist_service_eligibility_allows_supported_service(
    monkeypatch,
):
    monkeypatch.setattr(
        service,
        "_published_therapists",
        lambda *_args, **_kwargs: [
            SimpleNamespace(
                id="therapist-1",
            )
        ],
    )

    monkeypatch.setattr(
        service,
        "public_therapist_bookable_service_ids",
        lambda *_args, **_kwargs: [
            "service-1",
        ],
    )

    service._assert_public_therapist_eligibility(
        object(),
        therapist_profile_id="therapist-1",
        service_id="service-1",
        session_format="Online",
    )


def test_therapist_service_eligibility_rejects_unsupported_service(
    monkeypatch,
):
    monkeypatch.setattr(
        service,
        "_published_therapists",
        lambda *_args, **_kwargs: [
            SimpleNamespace(
                id="therapist-1",
            )
        ],
    )

    monkeypatch.setattr(
        service,
        "public_therapist_bookable_service_ids",
        lambda *_args, **_kwargs: [
            "service-1",
        ],
    )

    with pytest.raises(
        ValueError,
        match=(
            "Selected therapist does not "
            "offer this service"
        ),
    ):
        service._assert_public_therapist_eligibility(
            object(),
            therapist_profile_id=(
                "therapist-1"
            ),
            service_id="service-2",
            session_format="Online",
        )


def test_therapist_service_eligibility_rejects_unsupported_format(
    monkeypatch,
):
    monkeypatch.setattr(
        service,
        "_published_therapists",
        lambda *_args, **_kwargs: [],
    )

    monkeypatch.setattr(
        service,
        "public_therapist_bookable_service_ids",
        lambda *_args, **_kwargs: [
            "service-1",
        ],
    )

    with pytest.raises(
        ValueError,
        match=(
            "Selected therapist is not "
            "available for this session format"
        ),
    ):
        service._assert_public_therapist_eligibility(
            object(),
            therapist_profile_id=(
                "therapist-1"
            ),
            service_id="service-1",
            session_format="In person",
        )


def test_public_slots_reject_forged_therapist_service_pair(
    monkeypatch,
):
    monkeypatch.setattr(
        service,
        "_validate_public_booking_date",
        lambda *_args, **_kwargs: None,
    )

    monkeypatch.setattr(
        service,
        "_format_policy_item",
        lambda *_args, **_kwargs: {
            "label": "Online",
            "requires_location": False,
        },
    )

    monkeypatch.setattr(
        service,
        "_resolve_location",
        lambda *_args, **_kwargs: None,
    )

    monkeypatch.setattr(
        service,
        "_published_service",
        lambda *_args, **_kwargs: (
            SimpleNamespace(
                id="service-2",
            )
        ),
    )

    monkeypatch.setattr(
        service,
        "_published_therapists",
        lambda *_args, **_kwargs: [
            SimpleNamespace(
                id="therapist-1",
            )
        ],
    )

    monkeypatch.setattr(
        service,
        "public_therapist_bookable_service_ids",
        lambda *_args, **_kwargs: [
            "service-1",
        ],
    )

    def unexpected_slot_lookup(
        *_args,
        **_kwargs,
    ):
        raise AssertionError(
            "Raw slot lookup should not run "
            "for an invalid therapist/service pair."
        )

    monkeypatch.setattr(
        service,
        "list_bookable_slots",
        unexpected_slot_lookup,
    )

    with pytest.raises(
        ValueError,
        match=(
            "Selected therapist does not "
            "offer this service"
        ),
    ):
        service.list_public_bookable_slots(
            object(),
            slot_date=date(
                2030,
                9,
                2,
            ),
            service_id="service-2",
            session_format="Online",
            preferred_therapist_profile_id=(
                "therapist-1"
            ),
        )


def test_public_slots_allow_no_preference_for_eligible_service(
    monkeypatch,
):
    monkeypatch.setattr(
        service,
        "_validate_public_booking_date",
        lambda *_args, **_kwargs: None,
    )

    monkeypatch.setattr(
        service,
        "_format_policy_item",
        lambda *_args, **_kwargs: {
            "label": "Online",
            "requires_location": False,
        },
    )

    monkeypatch.setattr(
        service,
        "_resolve_location",
        lambda *_args, **_kwargs: None,
    )

    monkeypatch.setattr(
        service,
        "_published_service",
        lambda *_args, **_kwargs: (
            SimpleNamespace(
                id="service-1",
            )
        ),
    )

    monkeypatch.setattr(
        service,
        "_published_therapists",
        lambda *_args, **_kwargs: [
            SimpleNamespace(
                id="therapist-1",
            )
        ],
    )

    def specific_guard_should_not_run(
        *_args,
        **_kwargs,
    ):
        raise AssertionError(
            "Specific therapist guard should "
            "not run for No preference."
        )

    monkeypatch.setattr(
        service,
        "_assert_public_therapist_eligibility",
        specific_guard_should_not_run,
    )

    monkeypatch.setattr(
        service,
        "list_bookable_slots",
        lambda *_args, **_kwargs: [
            SimpleNamespace(
                date=date(
                    2030,
                    9,
                    2,
                ),
                start_time=time(
                    9,
                    0,
                ),
                end_time=time(
                    9,
                    30,
                ),
                service_id="service-1",
                therapist_profile_id=(
                    "therapist-1"
                ),
                session_format="Online",
                location=None,
            )
        ],
    )

    slots = (
        service.list_public_bookable_slots(
            object(),
            slot_date=date(
                2030,
                9,
                2,
            ),
            service_id="service-1",
            session_format="Online",
            preferred_therapist_profile_id=None,
        )
    )

    assert len(slots) == 1
    assert slots[0].start_time == time(
        9,
        0,
    )
    assert slots[0].end_time == time(
        9,
        30,
    )
