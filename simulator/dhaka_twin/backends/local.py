"""An in-process model of the Cholo platform for fast, deterministic runs.

It follows the production rules the simulator cares about: request expiry
after 5 minutes, 15 s offers, one offer per driver per request, the rider
pickup confirmation handshake, the 300 m arrival check, Cholo's fare formula
and 15% commission. Dispatch is pluggable (see :mod:`dhaka_twin.dispatch`).
"""

from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

import numpy as np

from ..dispatch.policies import DispatchPolicy, make_policy
from ..geo import haversine_m
from ..messages import (
    Arrived,
    CancelRequest,
    CancelTrip,
    CommandFailed,
    CompleteTrip,
    ConfirmPickup,
    DriverStatus,
    GoOffline,
    GoOnline,
    OfferAnswered,
    OfferMade,
    PingLocation,
    RateTrip,
    RequestEnded,
    RequestPlaced,
    RequestRide,
    RespondOffer,
    StartTrip,
    TripUpdate,
)
from ..roads.matrix import TravelTimeMatrix

if TYPE_CHECKING:
    from ..demand.model import TripSpec
    from ..engine import World

REQUEST_EXPIRY_S = 5 * 60.0
EXPIRY_JOB_EVERY_S = 60.0
COMMISSION_RATE = 0.15

# base, per km, per min, minimum, booking fee (database/seeds/seed.reference.sql)
TARIFFS = {
    "bike": (25.0, 12.0, 1.0, 40.0, 5.0),
    "cng": (40.0, 15.0, 1.5, 70.0, 5.0),
    "car": (60.0, 22.0, 2.5, 120.0, 10.0),
    "premium": (90.0, 30.0, 3.5, 200.0, 10.0),
}


def _js_round(x: float) -> float:
    """``Math.round`` semantics (half up), unlike Python's banker's rounding."""
    return float(math.floor(x + 0.5))


def _round2(x: float) -> float:
    return _js_round(x * 100) / 100


def cholo_fare(vehicle: str, km: float, minutes: float, surge: float = 1.0) -> float:
    """Mirror of ``quote`` in server/src/utils/fareMath.js (no promos or waiting time)."""
    base, per_km, per_min, minimum, booking = TARIFFS[vehicle]
    time_fare = _round2(minutes * per_min)
    distance = _round2(km * per_km)
    ride = _round2(base + distance + time_fare)
    if ride < minimum:
        distance = _round2(distance + (minimum - ride))
        ride = minimum
    surge_amount = _round2(ride * (surge - 1))
    return _js_round(_round2(base + distance + time_fare + surge_amount + booking))


@dataclass
class LRequest:
    id: str
    rider_id: int
    trip: "TripSpec"
    requested_s: float
    expires_s: float
    est_km: float
    est_min: float
    est_fare: float
    status: str = "searching"
    offered: set[int] = field(default_factory=set)
    pending: set[str] = field(default_factory=set)
    max_round: int = 0
    last_offer_s: float | None = None
    trip_code: str | None = None


@dataclass
class LOffer:
    id: str
    request_id: str
    driver_id: int
    offered_s: float
    distance_km: float
    round: int
    status: str = "pending"


@dataclass
class LDriver:
    id: int
    vehicle: str
    gender: str
    status: str = "offline"
    lat: float | None = None
    lng: float | None = None
    last_ping_s: float | None = None
    balance: float = 0.0
    pending: set[str] = field(default_factory=set)
    trip_code: str | None = None


@dataclass
class LTrip:
    code: str
    request_id: str
    rider_id: int
    driver_id: int
    assigned_s: float
    status: str = "assigned"
    arrived_s: float | None = None
    start_requested: bool = False
    confirmed: bool = False
    started_s: float | None = None
    completed_s: float | None = None
    fare: float | None = None


class LocalPlatform:
    name = "local"
    realtime = False
    wants_idle_pings = False

    def __init__(self, policy: str | DispatchPolicy = "cholo-v1", arrival_radius_m: float = 300.0,
                 commission_debt_limit: float | None = None, matrix_cache=None) -> None:
        self.policy = make_policy(policy) if isinstance(policy, str) else policy
        self.arrival_radius_m = arrival_radius_m
        self.debt_limit = commission_debt_limit
        self.matrix_cache = matrix_cache
        self.world: "World | None" = None
        self.matrix: TravelTimeMatrix | None = None
        self.requests: dict[str, LRequest] = {}
        self.by_rider: dict[int, str] = {}
        self.offers: dict[str, LOffer] = {}
        self.drivers: dict[int, LDriver] = {}
        self.trips: dict[str, LTrip] = {}
        self.trip_of_rider: dict[int, str] = {}
        self._searching: dict[str, LRequest] = {}
        self.online_by_vehicle: dict[str, set[int]] = {}
        self._outbox: list = []
        self._seq = Counter()
        self._next_expiry_s = EXPIRY_JOB_EVERY_S
        self.counters: Counter[str] = Counter()

    # ---------------------------------------------------------------- lifecycle
    async def start(self, world: "World") -> None:
        self.world = world
        for d in world.drivers:
            self.drivers[d.id] = LDriver(d.id, d.vehicle, d.gender)
        dm = world.demand
        self.matrix = TravelTimeMatrix.build(world.graph, dm.cells, dm.cell_nodes, dm.res, self.matrix_cache)

    async def close(self) -> None:
        pass

    def drain(self) -> list:
        out, self._outbox = self._outbox, []
        return out

    def stats(self) -> dict:
        return {"backend": self.name, "policy": self.policy.name, **dict(self.counters)}

    # ---------------------------------------------------------------- helpers for policies
    def searching(self) -> list[LRequest]:
        return list(self._searching.values())

    def eligible_drivers(self, req: LRequest, free_only: bool = False) -> tuple[list[int], np.ndarray, np.ndarray]:
        ids, lat, lng = [], [], []
        women_only = req.trip.women_only
        for driver_id in sorted(self.online_by_vehicle.get(req.trip.vehicle, ())):
            d = self.drivers[driver_id]
            if d.lat is None:
                continue
            if women_only and d.gender != "female":
                continue
            if d.id in req.offered or (free_only and d.pending):
                continue
            ids.append(d.id)
            lat.append(d.lat)
            lng.append(d.lng)
        return ids, np.asarray(lat, dtype=np.float64), np.asarray(lng, dtype=np.float64)

    def make_offer(self, req: LRequest, driver_id: int, distance_km: float, round_: int, now: float) -> LOffer:
        self._seq["offer"] += 1
        offer = LOffer(str(self._seq["offer"]), req.id, driver_id, now, round(distance_km, 2), round_)
        self.offers[offer.id] = offer
        req.offered.add(driver_id)
        req.pending.add(offer.id)
        self.drivers[driver_id].pending.add(offer.id)
        self.counters["offers_created"] += 1
        self._emit(OfferMade(driver_id, offer.id, req.id, offer.distance_km))
        return offer

    def _close_offer(self, offer: LOffer, status: str) -> None:
        if offer.status != "pending":
            return
        offer.status = status
        self.counters[f"offers_{status}"] += 1
        req = self.requests.get(offer.request_id)
        if req is not None:
            req.pending.discard(offer.id)
        self.drivers[offer.driver_id].pending.discard(offer.id)

    def timeout_offers(self, now: float, ttl_s: float) -> None:
        for req in list(self._searching.values()):
            for oid in list(req.pending):
                offer = self.offers[oid]
                if now - offer.offered_s > ttl_s:
                    self._close_offer(offer, "timed_out")

    # ---------------------------------------------------------------- engine hooks
    def step(self, now: float) -> None:
        self.policy.on_tick(self, now)
        if now >= self._next_expiry_s:
            self._next_expiry_s = now + EXPIRY_JOB_EVERY_S
            for req in list(self._searching.values()):
                if now >= req.expires_s:
                    self._end_request(req, "expired")
                    self.counters["requests_expired"] += 1
                    self._emit(RequestEnded(req.rider_id, "expired"))

    def _emit(self, event) -> None:
        self._outbox.append(event)

    def _set_status(self, driver: LDriver, status: str) -> None:
        driver.status = status
        online = self.online_by_vehicle.setdefault(driver.vehicle, set())
        if status == "online":
            online.add(driver.id)
        else:
            online.discard(driver.id)

    def _fail(self, agent_id: int, role: str, command: str, error: str) -> None:
        self.counters[f"error_{command}_{error}"] += 1
        self._emit(CommandFailed(agent_id, role, command, error))

    def _end_request(self, req: LRequest, status: str) -> None:
        req.status = status
        self._searching.pop(req.id, None)
        for oid in list(req.pending):
            self._close_offer(self.offers[oid], "timed_out")

    def _both(self, trip: LTrip, status: str, **info) -> None:
        self._emit(TripUpdate(trip.rider_id, "rider", trip.code, status, {"driver_id": trip.driver_id, **info}))
        self._emit(TripUpdate(trip.driver_id, "driver", trip.code, status, info))

    def _now(self) -> float:
        return self.world.now_s

    # ---------------------------------------------------------------- commands
    def submit(self, cmd) -> None:
        handler = getattr(self, f"_on_{type(cmd).__name__}")
        handler(cmd)

    def _on_RequestRide(self, cmd: RequestRide) -> None:
        now = self._now()
        trip = cmd.trip
        g = self.world.graph
        route = g.route(trip.origin_node, trip.dest_node)
        if route is None:
            self._fail(cmd.rider_id, "rider", "RequestRide", "ROUTE_NOT_FOUND")
            return
        km = route.length_m / 1000
        minutes = max(1.0, math.ceil(g.route_freeflow_s(route) / 60))
        self._seq["request"] += 1
        req = LRequest(
            id=f"req-{self._seq['request']}",
            rider_id=cmd.rider_id,
            trip=trip,
            requested_s=now,
            expires_s=now + REQUEST_EXPIRY_S,
            est_km=km,
            est_min=minutes,
            est_fare=cholo_fare(trip.vehicle, km, minutes),
        )
        self.requests[req.id] = req
        self._searching[req.id] = req
        self.by_rider[cmd.rider_id] = req.id
        self.counters["requests"] += 1
        self._emit(RequestPlaced(cmd.rider_id, req.id, req.est_fare))
        self.policy.on_request(self, req, now)

    def _on_CancelRequest(self, cmd: CancelRequest) -> None:
        req = self.requests.get(self.by_rider.get(cmd.rider_id, ""))
        if req is None:
            self._fail(cmd.rider_id, "rider", "CancelRequest", "NOT_FOUND")
            return
        if req.status == "matched":
            self._fail(cmd.rider_id, "rider", "CancelRequest", "ALREADY_MATCHED")
            return
        if req.status != "searching":
            self._fail(cmd.rider_id, "rider", "CancelRequest", "BAD_TRANSITION")
            return
        self._end_request(req, "cancelled")
        self.counters["requests_cancelled"] += 1
        self._emit(RequestEnded(cmd.rider_id, "cancelled"))

    def _on_RespondOffer(self, cmd: RespondOffer) -> None:
        now = self._now()
        offer = self.offers.get(cmd.offer_id)
        if offer is None or offer.driver_id != cmd.driver_id:
            self._fail(cmd.driver_id, "driver", "RespondOffer", "OFFER_NOT_FOUND")
            return
        if offer.status != "pending":
            self.counters["accept_conflicts" if cmd.accept else "late_rejects"] += 1
            self._fail(cmd.driver_id, "driver", "RespondOffer", "ALREADY_TAKEN")
            return
        if now - offer.offered_s > 15.0:
            self._close_offer(offer, "timed_out")
            self._fail(cmd.driver_id, "driver", "RespondOffer", "OFFER_EXPIRED")
            return
        if not cmd.accept:
            self._close_offer(offer, "rejected")
            return
        driver = self.drivers[cmd.driver_id]
        if self.debt_limit and driver.balance < -self.debt_limit:
            self._fail(cmd.driver_id, "driver", "RespondOffer", "COMMISSION_DEBT_LIMIT")
            return
        req = self.requests[offer.request_id]
        if req.status != "searching":
            self.counters["accept_conflicts"] += 1
            self._fail(cmd.driver_id, "driver", "RespondOffer", "ALREADY_TAKEN")
            return
        self._close_offer(offer, "accepted")
        req.status = "matched"
        self._searching.pop(req.id, None)
        for oid in list(req.pending):
            self._close_offer(self.offers[oid], "withdrawn")
        for oid in list(driver.pending):
            self._close_offer(self.offers[oid], "withdrawn")
        self._seq["trip"] += 1
        code = f"JT-{self.world.now.year}-{self._seq['trip']:06d}"
        trip = LTrip(code, req.id, req.rider_id, driver.id, now)
        req.trip_code = code
        self.trips[code] = trip
        self.trip_of_rider[req.rider_id] = code
        self._set_status(driver, "on_trip")
        driver.trip_code = code
        self.counters["trips_assigned"] += 1
        t = req.trip
        self._emit(OfferAnswered(driver.id, offer.id, True, code, (t.o_lat, t.o_lng), (t.d_lat, t.d_lng)))
        self._both(trip, "assigned")

    def _driver_trip(self, driver_id: int, command: str) -> LTrip | None:
        driver = self.drivers[driver_id]
        trip = self.trips.get(driver.trip_code or "")
        if trip is None:
            self._fail(driver_id, "driver", command, "TRIP_NOT_FOUND")
        return trip

    def _on_Arrived(self, cmd: Arrived) -> None:
        trip = self._driver_trip(cmd.driver_id, "Arrived")
        if trip is None:
            return
        if trip.status != "assigned":
            self._fail(cmd.driver_id, "driver", "Arrived", "BAD_TRANSITION")
            return
        t = self.requests[trip.request_id].trip
        if self.arrival_radius_m and haversine_m(cmd.lat, cmd.lng, t.o_lat, t.o_lng) > self.arrival_radius_m:
            self._fail(cmd.driver_id, "driver", "Arrived", "TOO_FAR_FROM_PICKUP")
            return
        trip.status = "arrived"
        trip.arrived_s = self._now()
        trip.start_requested = False
        trip.confirmed = False
        self._both(trip, "arrived")

    def _start(self, trip: LTrip) -> None:
        trip.status = "in_progress"
        trip.started_s = self._now()
        self._both(trip, "in_progress")

    def _on_StartTrip(self, cmd: StartTrip) -> None:
        trip = self._driver_trip(cmd.driver_id, "StartTrip")
        if trip is None:
            return
        if trip.status != "arrived":
            self._fail(cmd.driver_id, "driver", "StartTrip", "BAD_TRANSITION")
            return
        if trip.confirmed:
            self._start(trip)
        else:
            trip.start_requested = True
            self._both(trip, "arrived", start_requested=True)

    def _on_ConfirmPickup(self, cmd: ConfirmPickup) -> None:
        trip = self.trips.get(self.trip_of_rider.get(cmd.rider_id, ""))
        if trip is None or trip.status != "arrived":
            self._fail(cmd.rider_id, "rider", "ConfirmPickup", "BAD_TRANSITION")
            return
        trip.confirmed = True
        if trip.start_requested:
            self._start(trip)
        else:
            self._both(trip, "arrived", pickup_confirmed=True)

    def _on_CompleteTrip(self, cmd: CompleteTrip) -> None:
        trip = self._driver_trip(cmd.driver_id, "CompleteTrip")
        if trip is None:
            return
        if trip.status != "in_progress":
            self._fail(cmd.driver_id, "driver", "CompleteTrip", "BAD_TRANSITION")
            return
        req = self.requests[trip.request_id]
        t = req.trip
        if self.arrival_radius_m and haversine_m(cmd.lat, cmd.lng, t.d_lat, t.d_lng) > self.arrival_radius_m:
            self._fail(cmd.driver_id, "driver", "CompleteTrip", "TOO_FAR_FROM_DROPOFF")
            return
        fare = cholo_fare(t.vehicle, req.est_km, req.est_min)
        commission = round(fare * COMMISSION_RATE, 2)
        driver = self.drivers[trip.driver_id]
        if t.payment == "cash":
            driver.balance -= commission
        else:
            driver.balance += fare - commission
        trip.status = "completed"
        trip.completed_s = self._now()
        trip.fare = fare
        self._set_status(driver, "online")
        driver.trip_code = None
        self.counters["trips_completed"] += 1
        self.counters["gross_fare_bdt"] += int(fare)
        self.counters["commission_bdt"] += int(round(commission))
        self._both(trip, "completed", fare=fare)

    def _on_CancelTrip(self, cmd: CancelTrip) -> None:
        if cmd.role == "rider":
            trip = self.trips.get(self.trip_of_rider.get(cmd.agent_id, ""))
        else:
            trip = self.trips.get(self.drivers[cmd.agent_id].trip_code or "")
        if trip is None or trip.status not in ("assigned", "arrived"):
            self._fail(cmd.agent_id, cmd.role, "CancelTrip", "BAD_TRANSITION")
            return
        trip.status = "cancelled"
        self.requests[trip.request_id].status = "cancelled"
        driver = self.drivers[trip.driver_id]
        self._set_status(driver, "online")
        driver.trip_code = None
        self.counters[f"trips_cancelled_by_{cmd.role}"] += 1
        self._both(trip, "cancelled", cancelled_by=cmd.role, reason=cmd.reason)

    def _on_GoOnline(self, cmd: GoOnline) -> None:
        driver = self.drivers[cmd.driver_id]
        if driver.status == "on_trip":
            self._fail(cmd.driver_id, "driver", "GoOnline", "ON_TRIP")
            return
        if self.debt_limit and driver.balance < -self.debt_limit:
            self.counters["debt_lockouts"] += 1
            self._emit(DriverStatus(cmd.driver_id, False, "COMMISSION_DEBT_LIMIT"))
            return
        self._set_status(driver, "online")
        driver.lat, driver.lng = cmd.lat, cmd.lng
        driver.last_ping_s = self._now()
        self._emit(DriverStatus(cmd.driver_id, True))

    def _on_GoOffline(self, cmd: GoOffline) -> None:
        driver = self.drivers[cmd.driver_id]
        if driver.status == "on_trip":
            self._fail(cmd.driver_id, "driver", "GoOffline", "ON_TRIP")
            return
        self._set_status(driver, "offline")
        self._emit(DriverStatus(cmd.driver_id, False))

    def _on_PingLocation(self, cmd: PingLocation) -> None:
        driver = self.drivers[cmd.driver_id]
        driver.lat, driver.lng = cmd.lat, cmd.lng
        driver.last_ping_s = self._now()

    def _on_RateTrip(self, cmd: RateTrip) -> None:
        self.counters[f"ratings_by_{cmd.role}"] += 1
