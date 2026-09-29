"""Run-level KPIs: service quality for riders, utilisation for drivers."""

from __future__ import annotations

from collections import Counter, defaultdict
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from .agents.rider import Rider
    from .engine import World
    from .scenario import Scenario

SERIES_EVERY_S = 300.0


def _stats(values: list[float]) -> dict:
    if not values:
        return {"n": 0, "mean": None, "p50": None, "p90": None}
    a = np.asarray(values, dtype=np.float64)
    return {"n": int(a.size), "mean": float(a.mean()), "p50": float(np.percentile(a, 50)), "p90": float(np.percentile(a, 90))}


class Metrics:
    def __init__(self, scenario: "Scenario") -> None:
        self.scenario = scenario
        self.requests = 0
        self.offers_made = 0
        self.outcomes: Counter[str] = Counter()
        self.states: Counter[str] = Counter()
        self.by_vehicle: dict[str, Counter] = defaultdict(Counter)
        self.time_to_match: list[float] = []
        self.pickup_wait: list[float] = []
        self.total_wait: list[float] = []
        self.ride_time: list[float] = []
        self.fares: list[float] = []
        self.series: list[dict] = []
        self._next_sample_s = 0.0
        self.drivers: dict = {}
        self.backend: dict = {}
        self.wall_s: float | None = None

    def rider_done(self, rider: "Rider") -> None:
        self.states[rider.state] += 1
        self.outcomes[rider.outcome or rider.state] += 1
        self.by_vehicle[rider.trip.vehicle][rider.state] += 1
        if rider.matched_s is not None:
            self.time_to_match.append(rider.matched_s - rider.requested_s)
        if rider.arrived_s is not None and rider.matched_s is not None:
            self.pickup_wait.append(rider.arrived_s - rider.matched_s)
        if rider.picked_up_s is not None:
            self.total_wait.append(rider.picked_up_s - rider.requested_s)
            if rider.state == "completed" and rider.done_s is not None:
                self.ride_time.append(rider.done_s - rider.picked_up_s)
        if rider.fare is not None:
            self.fares.append(float(rider.fare))

    def sample(self, world: "World") -> None:
        if world.now_s < self._next_sample_s:
            return
        self._next_sample_s = world.now_s + SERIES_EVERY_S
        self.series.append(self.snapshot(world))

    def snapshot(self, world: "World") -> dict:
        states = Counter(d.state for d in world.drivers)
        online = sum(v for k, v in states.items() if k not in ("offline", "going_online"))
        busy = sum(states[k] for k in ("accepting", "to_pickup", "at_pickup", "on_trip", "completing"))
        waiting = sum(1 for r in world.riders.values() if r.state in ("requesting", "searching"))
        return {
            "t": world.now.isoformat(),
            "sim_s": world.now_s,
            "online": online,
            "idle": states["idle"],
            "busy": busy,
            "to_pickup": states["to_pickup"],
            "on_trip": states["on_trip"],
            "waiting_riders": waiting,
            "active_riders": len(world.riders),
            "requests": self.requests,
            "completed": self.states["completed"],
            "cancelled": self.states["cancelled"],
            "expired": self.states["expired"],
            "failed": self.states["failed"],
            "demand_per_hour": round(world.cond.total_rate),
            "speed_factor": round(world.cond.speed_factor, 3),
            "labels": list(world.cond.labels),
        }

    def finish(self, world: "World") -> None:
        drivers = world.drivers
        online = np.array([d.online_s for d in drivers])
        busy = np.array([d.busy_s for d in drivers])
        trips = np.array([d.trips for d in drivers])
        deadhead = float(sum(d.deadhead_m for d in drivers))
        paid = float(sum(d.paid_m for d in drivers))
        worked = online > 0
        self.drivers = {
            "fleet": len(drivers),
            "worked": int(worked.sum()),
            "online_hours": float(online.sum() / 3600),
            "utilisation": float(busy.sum() / online.sum()) if online.sum() > 0 else None,
            "trips_per_active_driver": float(trips[worked].mean()) if worked.any() else None,
            "deadhead_km": deadhead / 1000,
            "paid_km": paid / 1000,
            "deadhead_share": deadhead / (deadhead + paid) if deadhead + paid > 0 else None,
            "offers_seen": int(sum(d.offers_seen for d in drivers)),
            "offers_accepted": int(sum(d.offers_accepted for d in drivers)),
            "accept_conflicts": int(sum(d.accept_conflicts for d in drivers)),
            "earnings_bdt": float(sum(d.earnings for d in drivers)),
        }
        self.backend = world.backend.stats()
        self.series.append(self.snapshot(world))

    def summary(self) -> dict:
        finished = sum(self.states.values())
        completed = self.states["completed"]
        return {
            "scenario": self.scenario.name,
            "seed": self.scenario.seed,
            "requests": self.requests,
            "finished": finished,
            "completed": completed,
            "completion_rate": completed / finished if finished else None,
            "cancelled": self.states["cancelled"],
            "expired_no_driver": self.states["expired"],
            "failed": self.states["failed"],
            "outcomes": dict(self.outcomes),
            "time_to_match_s": _stats(self.time_to_match),
            "pickup_wait_s": _stats(self.pickup_wait),
            "total_wait_s": _stats(self.total_wait),
            "ride_time_s": _stats(self.ride_time),
            "gross_fare_bdt": float(sum(self.fares)),
            "offers_made": self.offers_made,
            "offers_per_request": self.offers_made / self.requests if self.requests else None,
            "by_vehicle": {k: dict(v) for k, v in self.by_vehicle.items()},
            "drivers": self.drivers,
            "backend": self.backend,
            "wall_s": self.wall_s,
        }
