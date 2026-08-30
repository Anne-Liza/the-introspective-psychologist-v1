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
