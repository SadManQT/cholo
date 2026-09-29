"""A driver: works shifts, answers offers, drives the road network."""

from __future__ import annotations

import math
import random
from typing import TYPE_CHECKING

from ..messages import (
    Arrived,
    CommandFailed,
    CompleteTrip,
    DriverStatus,
    GoOffline,
    GoOnline,
    OfferAnswered,
    OfferMade,
    PingLocation,
    RateTrip,
    RespondOffer,
    StartTrip,
    TripUpdate,
)
from ..roads import EMPTY_ROUTE, Route

if TYPE_CHECKING:
    from ..engine import World

OFFLINE = "offline"
GOING_ONLINE = "going_online"
IDLE = "idle"
ACCEPTING = "accepting"
TO_PICKUP = "to_pickup"
AT_PICKUP = "at_pickup"
ON_TRIP = "on_trip"
COMPLETING = "completing"
GOING_OFFLINE = "going_offline"

BUSY = {ACCEPTING, TO_PICKUP, AT_PICKUP, ON_TRIP, COMPLETING}
ONLINE = {IDLE} | BUSY

OFFER_TTL_S = 15.0
PING_IDLE_S = 10.0
PING_BUSY_S = 3.5


def accept_probability(distance_km: float) -> float:
    """Drivers happily take pickups under 2 km; beyond 5 km most decline."""
    return 1.0 / (1.0 + math.exp(1.1 * (distance_km - 3.5)))


class Driver:
    __slots__ = (
        "id", "vehicle", "gender", "home_node", "shifts", "base_accept", "reaction_s", "reposition_rate",
        "supply_u", "rng", "state", "node", "lat", "lng", "heading", "speed_kmh", "route", "route_i",
        "route_off", "offers", "offer_id", "trip_code", "rider_id", "pickup_node", "dropoff_node",
        "start_at_s", "start_sent", "next_ping_s", "next_idle_check_s", "blocked_until_s", "retry_at_s",
        "retry_cmd", "cancelled_codes", "online_since_s", "online_s", "busy_s", "busy_since_s", "trips",
        "deadhead_m", "paid_m", "offers_seen", "offers_accepted", "accept_conflicts", "earnings",
        "repositioning",
    )

    def __init__(self, driver_id: int, vehicle: str, gender: str, home_node: int, shifts: list[tuple[float, float]],
                 base_accept: float, reaction_s: float, reposition_rate: float, supply_u: float, seed: int) -> None:
        self.id = driver_id
        self.vehicle = vehicle
        self.gender = gender
        self.home_node = home_node
        self.shifts = shifts
        self.base_accept = base_accept
        self.reaction_s = reaction_s
        self.reposition_rate = reposition_rate
        self.supply_u = supply_u
        self.rng = random.Random(seed)
        self.state = OFFLINE
        self.node = home_node
        self.lat = 0.0
        self.lng = 0.0
        self.heading: float | None = None
        self.speed_kmh = 0.0
        self.route: Route = EMPTY_ROUTE
        self.route_i = 0
        self.route_off = 0.0
        self.offers: dict[str, tuple[str, float, float, float, str]] = {}
        self.offer_id: str | None = None
        self.trip_code: str | None = None
        self.rider_id: int | None = None
        self.pickup_node: int | None = None
        self.dropoff_node: int | None = None
        self.start_at_s = 0.0
        self.start_sent = False
        self.next_ping_s = 0.0
        self.next_idle_check_s = 0.0
        self.blocked_until_s = 0.0
        self.retry_at_s: float | None = None
        self.retry_cmd = None
        self.cancelled_codes: set[str] = set()
        self.online_since_s: float | None = None
        self.online_s = 0.0
        self.busy_s = 0.0
        self.busy_since_s: float | None = None
        self.trips = 0
        self.deadhead_m = 0.0
        self.paid_m = 0.0
        self.offers_seen = 0
        self.offers_accepted = 0
        self.accept_conflicts = 0
        self.earnings = 0.0
        self.repositioning = False

    # ---------------------------------------------------------------- helpers
    def place_at_node(self, world: "World", node: int) -> None:
        self.node = node
        self.lat = float(world.graph.node_lat[node])
        self.lng = float(world.graph.node_lng[node])

    def in_shift(self, tod_s: float) -> bool:
        for start, end in self.shifts:
            if start <= tod_s < end or (end > 86400 and tod_s < end - 86400):
                return True
        return False

    @property
    def moving(self) -> bool:
        return self.route_i < len(self.route)

    def set_route(self, world: "World", target: int) -> bool:
        g = world.graph
        if self.moving and self.route_off > 0:
            e = int(self.route.edges[self.route_i])
            head = int(g.edge_dst[e])
            tail = g.route(head, target)
            if tail is None:
                return False
            import numpy as np

            edges = np.concatenate([[e], tail.edges]).astype(np.int32)
            self.route = Route(edges, np.cumsum(g.edge_len_m[edges]), edges.tolist())
            self.route_i = 0
            return True
        route = g.route(self.node, target)
        if route is None:
            return False
        self.route = route
        self.route_i = 0
        self.route_off = 0.0
        return True

    def stop(self) -> None:
        self.route = EMPTY_ROUTE
        self.route_i = 0
        self.route_off = 0.0
        self.repositioning = False
        self.speed_kmh = 0.0

    def _move(self, world: "World", dt: float) -> bool:
        """Advance along the route. Returns True when the route's end is reached."""
        g = world.graph
        lengths = g.len_list
        speeds = g.speed_ms_list
        mult = world.edge_mult
        remaining = dt
        travelled = 0.0
        edges = self.route.edge_list
        n = len(edges)
        while remaining > 1e-9 and self.route_i < n:
            e = edges[self.route_i]
            v = speeds[e] * mult[e]
            left = lengths[e] - self.route_off
            step = v * remaining
            if step < left:
                self.route_off += step
                travelled += step
                remaining = 0.0
            else:
                travelled += left
                remaining -= left / v
                self.route_i += 1
                self.route_off = 0.0
                self.node = g.dst_list[e]
        old_lat, old_lng = self.lat, self.lng
        if self.route_i < n:
            self.lat, self.lng = g.edge_position(edges[self.route_i], self.route_off)
        else:
            self.lat = float(g.node_lat[self.node])
            self.lng = float(g.node_lng[self.node])
        if travelled > 1:
            dy = self.lat - old_lat
            dx = (self.lng - old_lng) * math.cos(math.radians(self.lat))
            self.heading = (math.degrees(math.atan2(dx, dy)) + 360) % 360
        self.speed_kmh = travelled / dt * 3.6 if dt > 0 else 0.0
        if self.state == ON_TRIP:
            self.paid_m += travelled
        else:
            self.deadhead_m += travelled
        return self.route_i >= n

    def _ping(self, world: "World", force: bool = False) -> None:
        if not force and world.now_s < self.next_ping_s:
            return
        if not force and not world.idle_pings and self.speed_kmh == 0 and world.now_s < self.next_ping_s + 50:
            # Parked: the local platform already knows where we are.
            return
        world.submit(PingLocation(self.id, self.lat, self.lng, self.heading, min(self.speed_kmh, 200.0)))
        self.next_ping_s = world.now_s + (PING_BUSY_S if self.state in BUSY else PING_IDLE_S)

    # ---------------------------------------------------------------- tick
    def tick(self, world: "World", dt: float) -> None:
        now = world.now_s
        should_work = (
            now >= self.blocked_until_s
            and self.in_shift(world.tod_s)
            and self.supply_u < world.cond.supply.get(self.vehicle, 1.0)
        )
        if self.retry_cmd is not None and self.retry_at_s is not None and now >= self.retry_at_s:
            cmd, self.retry_cmd, self.retry_at_s = self.retry_cmd, None, None
            world.submit(cmd)

        state = self.state
        if state == OFFLINE:
            if should_work:
                self.state = GOING_ONLINE
                world.submit(GoOnline(self.id, self.lat, self.lng))
            return
        if state in (GOING_ONLINE, GOING_OFFLINE, COMPLETING):
            return

        if state == IDLE:
            if not should_work:
                self.stop()
                self.offers.clear()
                self.state = GOING_OFFLINE
                world.submit(GoOffline(self.id))
                return
            self._decide_offers(world)
            if self.state == IDLE:
                if self.moving:
                    if self._move(world, dt):
                        self.stop()
                elif now >= self.next_idle_check_s:
                    self.next_idle_check_s = now + 60.0
                    self._maybe_reposition(world)
        elif state == TO_PICKUP:
            if self._move(world, dt):
                self.stop()
                self.state = AT_PICKUP
                self.start_at_s = now + self.rng.uniform(5, 20)
                self.start_sent = False
                world.submit(Arrived(self.id, self.lat, self.lng))
                world.record("arrived", driver=self.id, trip=self.trip_code)
        elif state == AT_PICKUP:
            if not self.start_sent and now >= self.start_at_s:
                self.start_sent = True
                world.submit(StartTrip(self.id))
        elif state == ON_TRIP:
            if self._move(world, dt):
                self.stop()
                self.state = COMPLETING
                world.submit(CompleteTrip(self.id, self.lat, self.lng))
        self._ping(world)

    def _decide_offers(self, world: "World") -> None:
        now = world.now_s
        for offer_id in list(self.offers):
            request_id, distance_km, offered_s, decide_at, answer = self.offers[offer_id]
            if now >= offered_s + OFFER_TTL_S:
                del self.offers[offer_id]
                continue
            if now < decide_at:
                continue
            del self.offers[offer_id]
            if answer == "accept":
                self.state = ACCEPTING
                self.offer_id = offer_id
                self.offers_accepted += 1
                self.busy_since_s = now
                world.submit(RespondOffer(self.id, offer_id, True))
                world.record("accept", driver=self.id, offer=offer_id, request=request_id)
                return
            if answer == "reject":
                world.submit(RespondOffer(self.id, offer_id, False))

    def _maybe_reposition(self, world: "World") -> None:
        if self.rng.random() >= self.reposition_rate * 0.2:
            return
        target = world.reposition_target(self)
        if target is not None and target != self.node and self.set_route(world, target):
            self.repositioning = True

    # ---------------------------------------------------------------- events
    def handle(self, world: "World", event) -> None:
        now = world.now_s
        if isinstance(event, OfferMade):
            self.offers_seen += 1
            if self.state not in (IDLE, ACCEPTING):
                return
            pickup = world.pickup_of(event.request_id)
            p = self.base_accept * accept_probability(event.distance_km) * world.cond.accept_factor
            if pickup is not None:
                p *= world.zone_accept(*pickup)
            r = self.rng.random()
            answer = "accept" if r < p else ("reject" if self.rng.random() < 0.6 else "ignore")
            reaction = min(max(self.rng.lognormvariate(math.log(self.reaction_s), 0.5), 1.5), 12.0)
            self.offers[event.offer_id] = (event.request_id, event.distance_km, now, now + reaction, answer)

        elif isinstance(event, OfferAnswered):
            if self.state != ACCEPTING or event.offer_id != self.offer_id:
                return
            self.offer_id = None
            if not event.ok or event.trip_code in self.cancelled_codes:
                if not event.ok:
                    self.accept_conflicts += event.error == "ALREADY_TAKEN"
                self._to_idle(now)
                return
            self.trip_code = event.trip_code
            self.pickup_node = world.graph.nearest_node(*event.pickup)
            self.dropoff_node = world.graph.nearest_node(*event.dropoff) if event.dropoff else None
            self.offers.clear()
            self.state = TO_PICKUP
            self.repositioning = False
            if not self.set_route(world, self.pickup_node):
                self.place_at_node(world, self.pickup_node)
            self._ping(world, force=True)

        elif isinstance(event, TripUpdate):
            self._on_trip_update(world, event)

        elif isinstance(event, DriverStatus):
            if event.error:
                self.state = OFFLINE
                # Locked out (commission debt, missing vehicle): try again later.
                self.blocked_until_s = now + 1800
                world.record("driver_blocked", driver=self.id, error=event.error)
            elif event.online and self.state == GOING_ONLINE:
                self.state = IDLE
                self.online_since_s = now
                self.next_idle_check_s = now + self.rng.uniform(0, 60)
                self._ping(world, force=True)
                world.record("online", driver=self.id)
            elif not event.online and self.state == GOING_OFFLINE:
                self.state = OFFLINE
                if self.online_since_s is not None:
                    self.online_s += now - self.online_since_s
                    self.online_since_s = None
                world.record("offline", driver=self.id)

        elif isinstance(event, CommandFailed):
            self._on_failure(world, event)

    def _on_trip_update(self, world: "World", event: TripUpdate) -> None:
        now = world.now_s
        status = event.status
        if status == "cancelled":
            self.cancelled_codes.add(event.trip_code)
            if event.trip_code == self.trip_code:
                self.stop()
                self._to_idle(now)
            return
        if event.trip_code != self.trip_code:
            return
        if status == "in_progress" and self.state == AT_PICKUP:
            self.state = ON_TRIP
            if self.dropoff_node is None or not self.set_route(world, self.dropoff_node):
                self.stop()
            self._ping(world, force=True)
        elif status == "assigned" and self.state == AT_PICKUP:
            # The rider disputed our arrival: drive to the pickup point again.
            self.state = TO_PICKUP
            if self.pickup_node is not None:
                self.set_route(world, self.pickup_node)
        elif status == "completed":
            fare = event.info.get("fare") or 0.0
            self.trips += 1
            self.earnings += float(fare) * 0.85
            if self.rng.random() < 0.4:
                world.submit(RateTrip(self.id, "driver", self.rng.choice([5, 5, 5, 4])))
            self._to_idle(now)

    def _on_failure(self, world: "World", event: CommandFailed) -> None:
        now = world.now_s
        world.record("driver_error", driver=self.id, command=event.command, error=event.error)
        if event.command == "RespondOffer" and self.state == ACCEPTING:
            self.accept_conflicts += event.error == "ALREADY_TAKEN"
            self.offer_id = None
            self._to_idle(now)
        elif event.command == "GoOnline":
            self.state = OFFLINE
            self.blocked_until_s = now + 600
        elif event.command == "GoOffline":
            self.state = IDLE if self.trip_code is None else self.state
        elif event.command in ("Arrived", "CompleteTrip", "StartTrip"):
            if event.error in ("BAD_TRANSITION", "TRIP_NOT_FOUND", "NOT_FOUND"):
                self.stop()
                self._to_idle(now)
                return
            cmd = {
                "Arrived": lambda: Arrived(self.id, self.lat, self.lng),
                "CompleteTrip": lambda: CompleteTrip(self.id, self.lat, self.lng),
                "StartTrip": lambda: StartTrip(self.id),
            }[event.command]()
            self.retry_cmd = cmd
            self.retry_at_s = now + 10.0

    def _to_idle(self, now: float) -> None:
        if self.busy_since_s is not None:
            self.busy_s += now - self.busy_since_s
            self.busy_since_s = None
        self.trip_code = None
        self.rider_id = None
        self.pickup_node = None
        self.dropoff_node = None
        self.offer_id = None
        self.start_sent = False
        self.state = IDLE
        self.next_idle_check_s = now + 30.0

    def finalize(self, now: float) -> None:
        if self.online_since_s is not None:
            self.online_s += now - self.online_since_s
            self.online_since_s = now
        if self.busy_since_s is not None:
            self.busy_s += now - self.busy_since_s
            self.busy_since_s = now
