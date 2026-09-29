"""Scenario definitions: when the simulation runs, how big the city is, and what happens.

A scenario is plain data so runs are reproducible from a JSON file plus a seed.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field, replace
from datetime import datetime, timedelta
from pathlib import Path

from .geo import DHAKA_TZ

EVENT_KINDS = ("rain", "friday_prayer", "cricket", "eid_exodus", "eid_day", "hartal")


@dataclass(frozen=True)
class Event:
    kind: str
    start: datetime
    end: datetime
    intensity: float = 1.0
    params: dict = field(default_factory=dict)

    def active(self, t: datetime, lead: timedelta = timedelta(0), lag: timedelta = timedelta(0)) -> bool:
        return self.start - lead <= t < self.end + lag

    def to_json(self) -> dict:
        return {
            "kind": self.kind,
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
            "intensity": self.intensity,
            "params": self.params,
        }

    @classmethod
    def from_json(cls, data: dict) -> "Event":
        if data["kind"] not in EVENT_KINDS:
            raise ValueError(f"unknown event kind {data['kind']!r}; expected one of {EVENT_KINDS}")
        return cls(
            kind=data["kind"],
            start=_parse_time(data["start"]),
            end=_parse_time(data["end"]),
            intensity=float(data.get("intensity", 1.0)),
            params=dict(data.get("params", {})),
        )


@dataclass(frozen=True)
class Scenario:
    name: str
    start: datetime
    duration_s: float
    drivers: int = 1000
    daily_requests: float = 12_000.0
    seed: int = 42
    events: tuple[Event, ...] = ()
    auto_friday_prayer: bool = True
    description: str = ""

    @property
    def end(self) -> datetime:
        return self.start + timedelta(seconds=self.duration_s)

    def all_events(self) -> list[Event]:
        """Declared events plus Jumu'ah on any Friday the run covers."""
        events = list(self.events)
        if self.auto_friday_prayer and not any(e.kind == "friday_prayer" for e in events):
            day = self.start.date()
            while datetime.combine(day, datetime.min.time(), DHAKA_TZ) < self.end:
                if day.weekday() == 4:
                    events.append(friday_prayer(day))
                day += timedelta(days=1)
        return events

    def with_overrides(self, **changes) -> "Scenario":
        return replace(self, **{k: v for k, v in changes.items() if v is not None})

    def to_json(self) -> dict:
        data = asdict(self)
        data["start"] = self.start.isoformat()
        data["events"] = [e.to_json() for e in self.events]
        return data

    @classmethod
    def from_json(cls, data: dict) -> "Scenario":
        return cls(
            name=data["name"],
            start=_parse_time(data["start"]),
            duration_s=float(data["duration_s"]),
            drivers=int(data.get("drivers", 1000)),
            daily_requests=float(data.get("daily_requests", 12_000)),
            seed=int(data.get("seed", 42)),
            events=tuple(Event.from_json(e) for e in data.get("events", [])),
            auto_friday_prayer=bool(data.get("auto_friday_prayer", True)),
            description=data.get("description", ""),
        )


def _parse_time(value: str | datetime) -> datetime:
    t = value if isinstance(value, datetime) else datetime.fromisoformat(value)
    return t if t.tzinfo else t.replace(tzinfo=DHAKA_TZ)


def at(day: str, hhmm: str) -> datetime:
    return _parse_time(f"{day}T{hhmm}:00")


def friday_prayer(day) -> Event:
    """Jumu'ah in Dhaka: khutbah from about 13:00, prayer finishes around 13:45."""
    d = day.isoformat()
    return Event("friday_prayer", at(d, "12:50"), at(d, "13:50"))


def _hours(h: float) -> float:
    return h * 3600.0


# Built-in scenarios. Dates are examples; override with --date.
PRESETS: dict[str, Scenario] = {
    "weekday": Scenario(
        name="weekday",
        description="A normal Sunday-Thursday: morning and evening office rush.",
        start=at("2026-09-29", "06:00"),
        duration_s=_hours(18),
    ),
    "friday": Scenario(
        name="friday",
        description="Weekly holiday: quiet morning, Jumu'ah dip then a post-prayer surge, busy evening.",
        start=at("2026-10-02", "08:00"),
        duration_s=_hours(15),
    ),
    "monsoon-rain": Scenario(
        name="monsoon-rain",
        description="Heavy rain hits the evening rush: demand jumps, bikes go offline, roads flood.",
        start=at("2026-09-29", "15:00"),
        duration_s=_hours(6),
        events=(Event("rain", at("2026-09-29", "17:00"), at("2026-09-29", "19:00"), 0.9),),
    ),
    "cricket-mirpur": Scenario(
        name="cricket-mirpur",
        description="Day-night T20 international at Sher-e-Bangla National Cricket Stadium, Mirpur.",
        start=at("2026-10-08", "14:00"),
        duration_s=_hours(10),
        events=(
            Event("cricket", at("2026-10-08", "18:00"), at("2026-10-08", "21:30"), 1.0, {"attendance": 25000}),
        ),
    ),
    "eid-exodus": Scenario(
        name="eid-exodus",
        description="Last working day before Eid: the city empties towards bus terminals, Kamalapur and Sadarghat.",
        start=at("2027-03-08", "06:00"),
        duration_s=_hours(18),
        events=(Event("eid_exodus", at("2027-03-08", "07:00"), at("2027-03-08", "23:59"), 1.0),),
    ),
    "hartal": Scenario(
        name="hartal",
        description="General strike from dawn to dusk: empty roads, few drivers, no-go zones around Paltan.",
        start=at("2026-10-06", "06:00"),
        duration_s=_hours(16),
        events=(Event("hartal", at("2026-10-06", "06:00"), at("2026-10-06", "18:00"), 1.0),),
    ),
}


def load_scenario(name_or_path: str) -> Scenario:
    if name_or_path in PRESETS:
        return PRESETS[name_or_path]
    path = Path(name_or_path)
    if not path.exists():
        raise ValueError(f"unknown scenario {name_or_path!r}; presets: {', '.join(PRESETS)}")
    return Scenario.from_json(json.loads(path.read_text()))


def move_to_date(scenario: Scenario, date: str) -> Scenario:
    """Shift a scenario (and its events) so it starts on ``date`` at the same local time."""
    new_start = at(date, scenario.start.strftime("%H:%M"))
    delta = new_start - scenario.start
    events = tuple(replace(e, start=e.start + delta, end=e.end + delta) for e in scenario.events)
    return replace(scenario, start=new_start, events=events)
