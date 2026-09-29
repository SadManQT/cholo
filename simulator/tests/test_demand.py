from datetime import timedelta

import numpy as np
import pytest

from dhaka_twin.demand.model import MIN_TRIP_KM, DemandModel
from dhaka_twin.demand.patterns import conditions_at
from dhaka_twin.demand.places import places_in
from dhaka_twin.geo import haversine_np
from dhaka_twin.scenario import PRESETS, Event, at, move_to_date


def integrate(scenario, start, hours, step_min=5):
    total = 0.0
    t = start
    for _ in range(int(hours * 60 / step_min)):
        total += conditions_at(t, scenario).total_rate * step_min / 60
        t += timedelta(minutes=step_min)
    return total


def test_a_working_day_produces_about_the_configured_daily_requests():
    sc = PRESETS["weekday"]
    total = integrate(sc, at("2026-09-29", "00:00"), 24)
    assert total == pytest.approx(sc.daily_requests, rel=0.02)


def test_office_rush_hours_are_busier_than_midday_and_night():
    sc = PRESETS["weekday"]
    rate = lambda hhmm: conditions_at(at("2026-09-29", hhmm), sc).total_rate  # noqa: E731
    assert rate("08:30") > rate("11:30") > rate("03:00")
    assert rate("18:00") > rate("11:30")
    assert conditions_at(at("2026-09-29", "18:00"), sc).speed_factor < conditions_at(at("2026-09-29", "03:00"), sc).speed_factor


def test_friday_prayer_empties_the_roads_then_surges():
    sc = PRESETS["friday"]
    before = conditions_at(at("2026-10-02", "12:30"), sc)
    during = conditions_at(at("2026-10-02", "13:15"), sc)
    after = conditions_at(at("2026-10-02", "14:00"), sc)
    assert during.total_rate < 0.4 * before.total_rate
    assert during.supply["car"] < 0.5
    assert "Jumu'ah prayer" in during.labels
    assert after.rates_per_hour.get("after_prayer", 0) > 0
    assert after.total_rate > before.total_rate
    # Friday mornings carry almost no commuters.
    assert conditions_at(at("2026-10-02", "08:30"), sc).rates_per_hour["commute_to_work"] < \
        0.2 * conditions_at(at("2026-09-29", "08:30"), PRESETS["weekday"]).rates_per_hour["commute_to_work"]


def test_rain_raises_demand_slows_traffic_and_takes_bikes_offline():
    sc = PRESETS["monsoon-rain"]
    dry = conditions_at(at("2026-09-29", "16:00"), sc)
    wet = conditions_at(at("2026-09-29", "18:00"), sc)
    base = conditions_at(at("2026-09-29", "18:00"), PRESETS["weekday"])
    assert wet.total_rate > 1.4 * base.total_rate
    assert wet.speed_factor < base.speed_factor
    assert wet.supply["bike"] < 0.5 < wet.supply["car"]
    assert any(z.label.startswith("Waterlogging") for z in wet.zones)
    assert dry.rain == 0 and wet.rain > 0.8


def test_cricket_match_sends_crowds_to_and_from_mirpur():
    sc = PRESETS["cricket-mirpur"]
    assert conditions_at(at("2026-10-08", "17:20"), sc).rates_per_hour["cricket_in"] > 0
    leaving = conditions_at(at("2026-10-08", "21:40"), sc)
    assert leaving.rates_per_hour["cricket_out"] > 0
    assert any("Mirpur" in z.label for z in leaving.zones)
    event = sc.events[0]
    out_total = 0.0
    t = event.end - timedelta(minutes=10)
    while t < event.end + timedelta(minutes=70):
        out_total += conditions_at(t, sc).rates_per_hour.get("cricket_out", 0) / 60
        t += timedelta(minutes=1)
    assert out_total == pytest.approx(25000 * 0.08 * 0.9, rel=0.05)


def test_hartal_suppresses_demand_and_supply_but_clears_the_roads():
    sc = PRESETS["hartal"]
    strike = conditions_at(at("2026-10-06", "10:00"), sc)
    normal = conditions_at(at("2026-10-06", "10:00"), PRESETS["weekday"])
    assert strike.total_rate < 0.5 * normal.total_rate
    assert strike.supply["car"] < 0.4
    assert strike.speed_factor > normal.speed_factor
    assert any(z.accept < 0.5 for z in strike.zones)


def test_auto_friday_prayer_and_date_moves():
    sc = move_to_date(PRESETS["weekday"], "2026-10-09")
    assert sc.start.weekday() == 4
    assert [e.kind for e in sc.all_events()] == ["friday_prayer"]
    moved = move_to_date(PRESETS["monsoon-rain"], "2026-10-01")
    assert moved.events[0].start == at("2026-10-01", "17:00")


def test_generation_is_deterministic_and_respects_trip_rules(graph):
    sc = PRESETS["weekday"]
    t = at("2026-09-29", "09:00")
    cond = conditions_at(t, sc)
    a = DemandModel(graph, np.random.default_rng(3)).generate(t, 1800, cond)
    b = DemandModel(graph, np.random.default_rng(3)).generate(t, 1800, cond)
    assert len(a) > 100
    assert [(x.o_cell, x.d_cell, x.vehicle, x.patience_s) for x in a] == [(x.o_cell, x.d_cell, x.vehicle, x.patience_s) for x in b]
    for trip in a:
        assert haversine_np(trip.o_lat, trip.o_lng, trip.d_lat, trip.d_lng) >= MIN_TRIP_KM * 1000 * 0.3
        assert trip.vehicle in ("bike", "cng", "car", "premium")
        assert not (trip.women_only and trip.vehicle == "bike")


def test_eid_exodus_trips_head_for_terminals(graph):
    sc = PRESETS["eid-exodus"]
    t = at("2027-03-08", "10:00")
    cond = conditions_at(t, sc)
    assert cond.rates_per_hour["exodus"] > 0
    only = type(cond)(when=t, rates_per_hour={"exodus": 2000.0})
    trips = DemandModel(graph, np.random.default_rng(1)).generate(t, 3600, only)
    hubs = places_in("terminal") + places_in("airport")
    near = 0
    for trip in trips:
        d = min(haversine_np(trip.d_lat, trip.d_lng, h.lat, h.lng) for h in hubs)
        near += d < 2500
    assert near / len(trips) > 0.85


def test_scenario_json_round_trip():
    from dhaka_twin.scenario import Scenario

    sc = PRESETS["cricket-mirpur"].with_overrides(events=PRESETS["cricket-mirpur"].events
                                                  + (Event("rain", at("2026-10-08", "15:00"), at("2026-10-08", "16:00"), 0.5),))
    again = Scenario.from_json(sc.to_json())
    assert again == sc
