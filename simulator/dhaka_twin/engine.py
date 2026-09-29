"""The simulation loop: clock, conditions, demand, agents and the platform backend."""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timedelta

import numpy as np

from .agents.driver import Driver
from .agents.fleet import build_fleet
from .agents.rider import Rider
from .backends.base import Backend
from .demand.model import DemandModel
from .demand.patterns import Conditions, conditions_at
from .geo import haversine_m, haversine_np
from .messages import OfferAnswered, OfferMade, RequestPlaced, TripUpdate
from .metrics import Metrics
from .roads import RoadGraph
from .scenario import Scenario

log = logging.getLogger(__name__)

CONDITIONS_EVERY_S = 60.0


class World:
    """Shared state that agents read and the only way they talk to the platform."""

    def __init__(
        self,
        scenario: Scenario,
        graph: RoadGraph,
        backend: Backend,
        *,
        dt_s: float = 2.0,
        demand_source=None,
        recorder=None,
        drivers: int | None = None,
    ) -> None:
        self.scenario = scenario
        self.graph = graph
        self.backend = backend
        self.dt_s = dt_s
        self.recorder = recorder
        self.events = scenario.all_events()
        streams = np.random.SeedSequence(scenario.seed).spawn(3)
        self.demand = DemandModel(graph, np.random.default_rng(streams[0]))
        self.demand_source = demand_source or self.demand
        n_drivers = drivers if drivers is not None else scenario.drivers
        self.drivers: list[Driver] = build_fleet(n_drivers, self.demand, np.random.default_rng(streams[1]), scenario.seed)
        for d in self.drivers:
            d.place_at_node(self, d.home_node)
        self.drivers_by_id = {d.id: d for d in self.drivers}
        self.riders: dict[int, Rider] = {}
        self.request_pickups: dict[str, tuple[float, float]] = {}
        self.metrics = Metrics(scenario)
        self.now_s = 0.0
        self._clock_s = -1.0
        self._now_dt = scenario.start
        self._tod = 0.0
        self.paused = False
        self.speed: float | None = None
        self._finished: list[Rider] = []
        self._edge_cell = self.demand.node_cell_idx[graph.edge_src]
        self.edge_mult: list[float] = [1.0] * graph.n_edges
        #: Local runs skip pings from parked drivers; the Cholo backend wants the app's cadence.
        self.idle_pings = getattr(backend, "wants_idle_pings", True)
        self.cond: Conditions = conditions_at(scenario.start, scenario, self.events)
        self._next_cond_s = 0.0
        self._expected = np.zeros(len(self.demand.cells))
        self._refresh_conditions()

    # ---------------------------------------------------------------- clock
    @property
    def now(self) -> datetime:
        if self._clock_s != self.now_s:
            self._sync_clock()
        return self._now_dt

    @property
    def tod_s(self) -> float:
        """Seconds since local midnight (cached per tick; drivers ask for it constantly)."""
        if self._clock_s != self.now_s:
            self._sync_clock()
        return self._tod

    def _sync_clock(self) -> None:
        t = self.scenario.start + timedelta(seconds=self.now_s)
        self._now_dt = t
        self._tod = t.hour * 3600 + t.minute * 60 + t.second + t.microsecond / 1e6
        self._clock_s = self.now_s

    # ---------------------------------------------------------------- services for agents
    def submit(self, command) -> None:
        self.backend.submit(command)

    def record(self, kind: str, **fields) -> None:
        if self.recorder is not None:
            self.recorder.event(self.now_s, kind, fields)

    def rider_finished(self, rider: Rider) -> None:
        self._finished.append(rider)
        self.metrics.rider_done(rider)
        self.record("rider_done", rider=rider.id, state=rider.state, outcome=rider.outcome,
                    driver=rider.driver_id, fare=rider.fare)
        if self.recorder is not None:
            self.recorder.trip(rider, self)

    def pickup_of(self, request_id: str) -> tuple[float, float] | None:
        return self.request_pickups.get(request_id)

    def edge_speed_mult(self, edge: int) -> float:
        return self.edge_mult[edge]

    def zone_accept(self, lat: float, lng: float) -> float:
        factor = 1.0
        for z in self.cond.zones:
            if z.accept != 1.0 and haversine_m(lat, lng, z.lat, z.lng) <= z.radius_m:
                factor *= z.accept
        return factor

    def reposition_target(self, driver: Driver) -> int | None:
        """Pick a busier nearby hexagon for an idle driver to drift towards."""
        dm = self.demand
        d = haversine_np(dm.cell_lat, dm.cell_lng, driver.lat, driver.lng)
        w = self._expected * np.exp(-d / 2000.0) * (d <= 4000)
        total = float(w.sum())
        if total <= 0:
            return None
        r = driver.rng.random() * total
        cell = int(np.searchsorted(np.cumsum(w), r))
        cell = min(cell, len(w) - 1)
        nodes = dm.cell_nodes[cell]
        return int(nodes[driver.rng.randrange(len(nodes))])

    # ---------------------------------------------------------------- loop
    def _refresh_conditions(self) -> None:
        self.cond = conditions_at(self.now, self.scenario, self.events)
        cell_speed = np.ones(len(self.demand.cells))
        for z in self.cond.zones:
            if z.speed != 1.0:
                inside = haversine_np(self.demand.cell_lat, self.demand.cell_lng, z.lat, z.lng) <= z.radius_m
                cell_speed[inside] = np.minimum(cell_speed[inside], z.speed)
        self.edge_mult = (self.cond.speed_factor * cell_speed[self._edge_cell]).tolist()
        self._expected = self.demand.expected_origin_rate(self.cond)
        self._next_cond_s = self.now_s + CONDITIONS_EVERY_S

    def _deliver(self, events) -> None:
        for ev in events:
            if isinstance(ev, (OfferMade, OfferAnswered)):
                agent = self.drivers_by_id.get(ev.driver_id)
                if agent is not None:
                    agent.handle(self, ev)
                if isinstance(ev, OfferMade):
                    self.metrics.offers_made += 1
                continue
            if isinstance(ev, RequestPlaced):
                rider = self.riders.get(ev.rider_id)
                if rider is not None:
                    self.request_pickups[ev.request_id] = (rider.trip.o_lat, rider.trip.o_lng)
                    rider.handle(self, ev)
                continue
            if isinstance(ev, TripUpdate):
                if ev.role == "rider":
                    rider = self.riders.get(ev.agent_id)
                    if rider is not None:
                        rider.handle(self, ev)
                else:
                    driver = self.drivers_by_id.get(ev.agent_id)
                    if driver is not None:
                        driver.handle(self, ev)
                continue
            role = getattr(ev, "role", None)
            if role == "rider" or (role is None and hasattr(ev, "rider_id")):
                rider = self.riders.get(getattr(ev, "rider_id", getattr(ev, "agent_id", None)))
                if rider is not None:
                    rider.handle(self, ev)
            else:
                driver = self.drivers_by_id.get(getattr(ev, "driver_id", getattr(ev, "agent_id", None)))
                if driver is not None:
                    driver.handle(self, ev)

    def step(self) -> None:
        dt = self.dt_s
        self.now_s += dt
        if self.now_s >= self._next_cond_s:
            self._refresh_conditions()
        self._deliver(self.backend.drain())

        for spec in self.demand_source.generate(self.now, dt, self.cond):
            if self.recorder is not None:
                self.recorder.request(spec)
            rider = Rider(spec.id, spec)
            self.riders[rider.id] = rider
            self.metrics.requests += 1
            rider.start(self)
        for rider in list(self.riders.values()):
            rider.tick(self)
        for driver in self.drivers:
            driver.tick(self, dt)

        self.backend.step(self.now_s)
        self._deliver(self.backend.drain())

        if self._finished:
            for rider in self._finished:
                self.riders.pop(rider.id, None)
                if rider.request_id:
                    self.request_pickups.pop(rider.request_id, None)
            self._finished.clear()
        self.metrics.sample(self)
        if self.recorder is not None:
            self.recorder.tick(self)

    async def run(self, duration_s: float | None = None, speed: float | None = None, on_tick=None) -> Metrics:
        """Run until ``duration_s`` of simulated time has passed.

        ``speed`` is simulated seconds per wall second; ``None`` runs as fast as
        possible (only allowed for backends that are not real-time).
        """
        self.speed = speed
        if self.backend.realtime and speed is None:
            raise ValueError(f"the {self.backend.name} backend runs against a real server; pass a speed such as 1")
        end_s = self.scenario.duration_s if duration_s is None else duration_s
        await self.backend.start(self)
        try:
            wall_start = time.monotonic()
            sim_start = self.now_s
            anchor_speed = self.speed
            ticks = 0
            while self.now_s < end_s:
                if self.paused:
                    await asyncio.sleep(0.1)
                    wall_start = time.monotonic()
                    sim_start = self.now_s
                    continue
                if self.speed != anchor_speed:
                    anchor_speed = self.speed
                    wall_start = time.monotonic()
                    sim_start = self.now_s
                self.step()
                ticks += 1
                if on_tick is not None:
                    on_tick(self)
                if self.speed is None:
                    if ticks % 20 == 0:
                        await asyncio.sleep(0)
                else:
                    target = wall_start + (self.now_s - sim_start) / self.speed
                    delay = target - time.monotonic()
                    if delay > 0:
                        await asyncio.sleep(delay)
                    else:
                        await asyncio.sleep(0)
                        if delay < -5:
                            # Too far behind: re-anchor instead of sprinting to catch up.
                            wall_start = time.monotonic()
                            sim_start = self.now_s
        finally:
            for d in self.drivers:
                d.finalize(self.now_s)
            await self.backend.close()
        self.metrics.finish(self)
        return self.metrics

    def set_speed(self, speed: float | None) -> None:
        self.speed = speed
