"""Time-of-day demand profiles, Dhaka traffic, and how events change the city.

Everything here is a pure function of simulated time and the scenario, so the
same scenario always produces the same conditions regardless of dispatch policy.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta

import numpy as np

from ..scenario import Event, Scenario
from .places import MIRPUR_STADIUM, PLACES, Place

# Hourly shape (value at hh:00) for each regular trip purpose on a working day.
# Shares say how much of a normal working day's requests each purpose makes up.
PURPOSES: dict[str, dict] = {
    "commute_to_work": {
        "share": 0.18, "origin": "residential", "dest": "office", "decay_km": 6.0,
        "profile": [0, 0, 0, 0, 0, .05, .3, .9, 1, .8, .35, .15, .1, .1, .1, .1, .1, .05, .05, .02, .01, 0, 0, 0],
    },
    "commute_home": {
        "share": 0.20, "origin": "office", "dest": "residential", "decay_km": 6.0,
        "profile": [.03, 0, 0, 0, 0, 0, 0, 0, 0, 0, .05, .05, .1, .15, .2, .3, .6, .95, 1, .8, .45, .2, .1, .05],
    },
    "education": {
        "share": 0.06, "origin": "residential", "dest": "education", "decay_km": 4.0,
        "profile": [0, 0, 0, 0, 0, 0, .3, 1, .8, .3, .1, .1, .1, .1, .05, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    "education_home": {
        "share": 0.05, "origin": "education", "dest": "residential", "decay_km": 4.0,
        "profile": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, .1, .4, .8, 1, .6, .4, .3, .1, 0, 0, 0, 0, 0],
    },
    "shopping": {
        "share": 0.13, "origin": "residential", "dest": "retail+leisure", "decay_km": 4.0,
        "profile": [0, 0, 0, 0, 0, 0, 0, .05, .1, .2, .4, .6, .6, .6, .7, .8, .9, 1, 1, .9, .6, .3, .1, .02],
    },
    "shopping_home": {
        "share": 0.13, "origin": "retail+leisure", "dest": "residential", "decay_km": 4.0,
        "profile": [.1, .03, 0, 0, 0, 0, 0, 0, 0, .05, .1, .2, .4, .5, .5, .6, .7, .8, .9, 1, 1, .9, .6, .3],
    },
    "errand": {
        "share": 0.20, "origin": "residential+office", "dest": "hospital+office+retail+residential", "decay_km": 4.0,
        "profile": [.05, .02, .01, .01, .01, .05, .2, .5, .8, 1, 1, 1, .9, .9, .9, .9, .9, .8, .7, .6, .5, .35, .2, .1],
    },
    "airport_out": {
        "share": 0.025, "origin": "residential+office", "dest": "airport", "decay_km": 0.0,
        "profile": [.4, .3, .3, .5, .8, .9, .7, .6, .5, .5, .5, .5, .5, .5, .6, .7, .8, .9, 1, 1, .9, .8, .6, .5],
    },
    "airport_in": {
        "share": 0.025, "origin": "airport", "dest": "residential+office", "decay_km": 0.0,
        "profile": [.6, .5, .4, .3, .3, .4, .6, .8, .8, .7, .6, .5, .5, .6, .6, .7, .7, .8, .8, .9, 1, 1, .9, .8],
    },
}

# Event-only purposes: their rates come from events, not the daily profile.
EVENT_PURPOSES: dict[str, dict] = {
    "after_prayer": {"origin": "mosque+residential", "dest": "residential+retail+leisure", "decay_km": 4.0},
    "cricket_in": {"origin": "residential", "dest": "stadium_mirpur", "decay_km": 0.0},
    "cricket_out": {"origin": "stadium_mirpur", "dest": "residential", "decay_km": 7.0},
    "exodus": {"origin": "residential", "dest": "terminal+airport", "decay_km": 0.0},
}

# How strongly each day type scales each purpose (Bangladesh: Friday is the
# weekly holiday, Saturday is off for government and many offices).
DAY_FACTORS = {
    "workday": {},
    "saturday": {"commute_to_work": .55, "commute_home": .55, "education": .6, "education_home": .6, "shopping": 1.2,
                 "shopping_home": 1.2, "errand": .9},
    "friday": {"commute_to_work": .12, "commute_home": .15, "education": .05, "education_home": .05, "shopping": 1.45,
               "shopping_home": 1.45, "errand": .7, "airport_out": 1.1, "airport_in": 1.1},
}

# Multiplier on free-flow speed by hour. Dhaka peaks crawl at about a third.
CONGESTION = {
    "workday": [.95, 1, 1, 1, 1, .95, .8, .6, .45, .47, .55, .6, .6, .6, .6, .55, .5, .43, .41, .47, .6, .72, .85, .9],
    "saturday": [.95, 1, 1, 1, 1, 1, .9, .75, .6, .6, .6, .6, .6, .6, .6, .55, .5, .45, .45, .5, .6, .75, .85, .9],
    "friday": [.95, 1, 1, 1, 1, 1, 1, .95, .9, .85, .8, .75, .75, .8, .7, .65, .6, .55, .55, .6, .7, .8, .9, .95],
}

# Streets that flood after heavy rain.
WATERLOGGING_SPOTS = [
    ("Mirpur 10", 23.8070, 90.3685),
    ("Shantinagar", 23.7390, 90.4135),
    ("Dhanmondi 27", 23.7560, 90.3760),
    ("Karwan Bazar", 23.7510, 90.3925),
    ("Motijheel", 23.7275, 90.4205),
    ("Rampura", 23.7600, 90.4200),
]

HARTAL_FLASHPOINTS = [
    ("Paltan", 23.7330, 90.4125),
    ("Gulistan", 23.7240, 90.4120),
    ("Motijheel", 23.7275, 90.4205),
    ("Shahbag", 23.7385, 90.3958),
]

VEHICLE_KINDS = ("bike", "cng", "car", "premium")


@dataclass(frozen=True)
class Zone:
    """A circular area with local effects on traffic, pickups or trip origins."""

    lat: float
    lng: float
    radius_m: float
    speed: float = 1.0
    accept: float = 1.0
    origin: float = 1.0
    label: str = ""


@dataclass
class Conditions:
    """The state of the city at one moment."""

    when: datetime
    rates_per_hour: dict[str, float] = field(default_factory=dict)
    speed_factor: float = 1.0
    supply: dict[str, float] = field(default_factory=lambda: {k: 1.0 for k in VEHICLE_KINDS})
    accept_factor: float = 1.0
    zones: list[Zone] = field(default_factory=list)
    rain: float = 0.0
    labels: list[str] = field(default_factory=list)

    @property
    def total_rate(self) -> float:
        return float(sum(self.rates_per_hour.values()))


def day_type(t: datetime) -> str:
    wd = t.weekday()
    if wd == 4:
        return "friday"
    if wd == 5:
        return "saturday"
    return "workday"


def hourly(values: list[float], t: datetime) -> float:
    h = t.hour + t.minute / 60 + t.second / 3600
    i = int(h) % 24
    f = h - int(h)
    return values[i] * (1 - f) + values[(i + 1) % 24] * f


def _profile_norm(values: list[float]) -> float:
    return float(np.sum(values))


def _ramp(t: datetime, start: datetime, end: datetime, ramp: timedelta) -> float:
    """1 inside [start, end], fading linearly over ``ramp`` either side."""
    if t < start - ramp or t > end + ramp:
        return 0.0
    if t < start:
        return 1 - (start - t) / ramp
    if t > end:
        return 1 - (t - end) / ramp
    return 1.0


def _triangle(t: datetime, start: datetime, peak: datetime, end: datetime) -> float:
    """Triangular pulse normalised so its integral over the window is 1 hour^-1 * hours."""
    if t <= start or t >= end:
        return 0.0
    width_h = (end - start).total_seconds() / 3600
    height = 2 / width_h
    if t <= peak:
        return height * (t - start) / (peak - start)
    return height * (end - t) / (end - peak)


def conditions_at(t: datetime, scenario: Scenario, events: list[Event] | None = None) -> Conditions:
    events = scenario.all_events() if events is None else events
    dt = day_type(t)
    factors = DAY_FACTORS[dt]
    rates = {}
    for name, spec in PURPOSES.items():
        per_day = scenario.daily_requests * spec["share"] * factors.get(name, 1.0)
        rates[name] = per_day * hourly(spec["profile"], t) / _profile_norm(spec["profile"])

    c = Conditions(when=t, rates_per_hour=rates, speed_factor=hourly(CONGESTION[dt], t))
    for event in events:
        _apply_event(c, event, scenario)
    c.speed_factor = float(np.clip(c.speed_factor, 0.15, 1.1))
    return c


def _scale_all(c: Conditions, factor: float, only: tuple[str, ...] | None = None) -> None:
    for k in c.rates_per_hour:
        if only is None or k in only:
            c.rates_per_hour[k] *= factor


def _apply_event(c: Conditions, e: Event, scenario: Scenario) -> None:
    t = c.when
    strength = e.intensity
    if e.kind == "rain":
        w = _ramp(t, e.start, e.end, timedelta(minutes=15))
        if w > 0:
            c.rain = max(c.rain, w * strength)
            _scale_all(c, 1 + 0.7 * w * strength)
            c.speed_factor *= 1 - 0.3 * w * strength
            c.supply["bike"] *= 1 - 0.7 * w * strength
            c.supply["cng"] *= 1 - 0.2 * w * strength
            c.supply["car"] *= 1 - 0.05 * w * strength
            c.supply["premium"] *= 1 - 0.05 * w * strength
            c.accept_factor *= 1 - 0.15 * w * strength
            c.labels.append(f"Rain ({int(round(100 * w * strength))}%)")
        # Streets stay flooded for an hour after heavy rain.
        flood = _ramp(t, e.start + timedelta(minutes=30), e.end + timedelta(minutes=60), timedelta(minutes=20))
        if flood > 0 and strength >= 0.5:
            for name, lat, lng in WATERLOGGING_SPOTS:
                c.zones.append(Zone(lat, lng, 700, speed=1 - 0.5 * flood * strength, accept=1 - 0.3 * flood, label=f"Waterlogging: {name}"))
            c.labels.append("Waterlogging")

    elif e.kind == "friday_prayer":
        if e.start <= t < e.end:
            _scale_all(c, 0.25)
            for k in c.supply:
                c.supply[k] *= 0.35
            c.labels.append("Jumu'ah prayer")
        surge_start = e.end - timedelta(minutes=5)
        surge_end = e.end + timedelta(minutes=45)
        if surge_start < t < surge_end:
            total = 0.025 * scenario.daily_requests * strength
            c.rates_per_hour["after_prayer"] = total * _triangle(t, surge_start, e.end + timedelta(minutes=10), surge_end)
            for p in PLACES:
                if p.category == "mosque":
                    c.zones.append(Zone(p.lat, p.lng, 600, speed=0.6, label=p.name))
            c.labels.append("After Jumu'ah")

    elif e.kind == "cricket":
        attendance = float(e.params.get("attendance", 25000))
        share = float(e.params.get("ride_hail_share", 0.08))
        stadium: Place = MIRPUR_STADIUM
        arrive_start = e.start - timedelta(hours=2)
        arrive_end = e.start + timedelta(minutes=30)
        if arrive_start < t < arrive_end:
            total = attendance * share * 0.6 * strength
            c.rates_per_hour["cricket_in"] = total * _triangle(t, arrive_start, e.start - timedelta(minutes=40), arrive_end)
            c.labels.append("Cricket: crowd arriving at Mirpur")
        leave_end = e.end + timedelta(minutes=70)
        if e.end - timedelta(minutes=10) < t < leave_end:
            total = attendance * share * 0.9 * strength
            c.rates_per_hour["cricket_out"] = total * _triangle(t, e.end - timedelta(minutes=10), e.end + timedelta(minutes=10), leave_end)
            c.labels.append("Cricket: match over, crowd leaving")
        if e.start - timedelta(hours=1) <= t < e.start + timedelta(minutes=20) or e.end <= t < e.end + timedelta(minutes=60):
            c.zones.append(Zone(stadium.lat, stadium.lng, 1800, speed=0.45, label="Mirpur match traffic"))
        if e.start <= t < e.end:
            c.labels.append("Cricket: match in progress")

    elif e.kind == "eid_exodus":
        w = _ramp(t, e.start, e.end, timedelta(minutes=30))
        if w > 0:
            hour_shape = hourly([.1, .05, .05, .05, .1, .3, .6, .8, 1, 1, .9, .8, .8, .8, .9, 1, 1, 1, 1, .9, .8, .6, .4, .2], t)
            c.rates_per_hour["exodus"] = 0.06 * scenario.daily_requests * strength * w * hour_shape
            _scale_all(c, 1 - 0.5 * w * strength, only=("commute_to_work", "commute_home", "education", "education_home"))
            for p in PLACES:
                if p.category in ("terminal", "airport"):
                    c.zones.append(Zone(p.lat, p.lng, 1200, speed=1 - 0.6 * w * strength, label=f"Eid rush: {p.name}"))
            c.labels.append("Eid exodus")

    elif e.kind == "eid_day":
        if e.start <= t < e.end:
            _scale_all(c, 0.25)
            c.rates_per_hour["errand"] = c.rates_per_hour.get("errand", 0) * 2.0  # visiting relatives
            c.speed_factor = max(c.speed_factor, 0.95)
            for k in c.supply:
                c.supply[k] *= 0.3
            c.labels.append("Eid day")

    elif e.kind == "hartal":
        w = _ramp(t, e.start, e.end, timedelta(minutes=30))
        if w > 0:
            _scale_all(c, 1 - 0.65 * w * strength)
            for k in c.supply:
                c.supply[k] *= 1 - 0.75 * w * strength
            c.speed_factor = max(c.speed_factor, 0.9 * w + c.speed_factor * (1 - w))
            for name, lat, lng in HARTAL_FLASHPOINTS:
                c.zones.append(Zone(lat, lng, 1200, accept=1 - 0.8 * w * strength, origin=1 - 0.7 * w * strength, label=f"Hartal: {name}"))
            c.labels.append("Hartal")
