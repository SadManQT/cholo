"""A passenger with one trip in mind: request, wait, ride (or give up)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from ..demand.model import TripSpec
from ..messages import (
    CancelRequest,
    CancelTrip,
    CommandFailed,
    ConfirmPickup,
    RateTrip,
    RequestEnded,
    RequestPlaced,
    RequestRide,
    TripUpdate,
)

if TYPE_CHECKING:
    from ..engine import World

# Rider lifecycle
NEW = "new"
REQUESTING = "requesting"
SEARCHING = "searching"
MATCHED = "matched"
DRIVER_ARRIVED = "driver_arrived"
ON_TRIP = "on_trip"
COMPLETED = "completed"
CANCELLED = "cancelled"
EXPIRED = "expired"
FAILED = "failed"

FINAL = {COMPLETED, CANCELLED, EXPIRED, FAILED}
WAITING = {REQUESTING, SEARCHING}


class Rider:
    __slots__ = (
        "id", "trip", "state", "request_id", "trip_code", "driver_id", "est_fare", "fare",
        "requested_s", "matched_s", "arrived_s", "confirmed_s", "picked_up_s", "done_s",
        "cancel_sent", "confirm_sent", "outcome", "cancelled_by", "rain_at_request", "events_at_request",
    )

    def __init__(self, rider_id: int, trip: TripSpec) -> None:
        self.id = rider_id
        self.trip = trip
        self.state = NEW
        self.request_id: str | None = None
        self.trip_code: str | None = None
        self.driver_id: int | None = None
        self.est_fare: float | None = None
        self.fare: float | None = None
        self.requested_s = 0.0
        self.matched_s: float | None = None
        self.arrived_s: float | None = None
        self.confirmed_s: float | None = None
        self.picked_up_s: float | None = None
        self.done_s: float | None = None
        self.cancel_sent = False
        self.confirm_sent = False
        self.outcome: str | None = None
        self.cancelled_by: str | None = None
        self.rain_at_request = 0.0
        self.events_at_request = ""

    @property
    def finished(self) -> bool:
        return self.state in FINAL

    def start(self, world: "World") -> None:
        self.state = REQUESTING
        self.requested_s = world.now_s
        self.rain_at_request = world.cond.rain
        self.events_at_request = "|".join(world.cond.labels)
        world.submit(RequestRide(self.id, self.trip))
        world.record("request", rider=self.id, trip=self.trip.id, purpose=self.trip.purpose, vehicle=self.trip.vehicle,
                     lat=self.trip.o_lat, lng=self.trip.o_lng, dlat=self.trip.d_lat, dlng=self.trip.d_lng)

    def tick(self, world: "World") -> None:
        now = world.now_s
        if self.state in WAITING and not self.cancel_sent and now - self.requested_s >= self.trip.patience_s:
            self.cancel_sent = True
            self.outcome = "gave_up"
            world.submit(CancelRequest(self.id))
        elif self.state == MATCHED and not self.cancel_sent and self.matched_s is not None:
            waited = now - self.matched_s
            if self.trip.changes_mind and waited >= 45:
                self._cancel_trip(world, "changed_mind")
            elif waited >= self.trip.pickup_tolerance_s:
                self._cancel_trip(world, "driver_late")
        elif self.state == DRIVER_ARRIVED and not self.confirm_sent and self.arrived_s is not None:
            if now - self.arrived_s >= self.trip.walk_s:
                self.confirm_sent = True
                self.confirmed_s = now
                world.submit(ConfirmPickup(self.id))

    def _cancel_trip(self, world: "World", reason: str) -> None:
        self.cancel_sent = True
        self.outcome = reason
        world.submit(CancelTrip(self.id, "rider", reason))

    def _finish(self, world: "World", state: str, outcome: str) -> None:
        if self.finished:
            return
        self.state = state
        self.done_s = world.now_s
        self.outcome = self.outcome if state == CANCELLED and self.outcome else outcome
        world.rider_finished(self)

    def handle(self, world: "World", event) -> None:
        if self.finished:
            return
        if isinstance(event, RequestPlaced):
            if self.state == REQUESTING:
                self.state = SEARCHING
                self.request_id = event.request_id
                self.est_fare = event.est_fare
        elif isinstance(event, RequestEnded):
            if self.state in WAITING:
                self._finish(world, EXPIRED if event.status == "expired" else CANCELLED,
                             "no_driver" if event.status == "expired" else "gave_up")
        elif isinstance(event, CommandFailed):
            if event.command == "RequestRide":
                self._finish(world, FAILED, f"rejected:{event.error}")
            elif event.command == "CancelRequest" and event.error == "ALREADY_MATCHED":
                self.cancel_sent = False  # a driver is on the way after all
                self.outcome = None
            elif event.command == "CancelTrip":
                self.cancel_sent = False
        elif isinstance(event, TripUpdate):
            self._on_trip_update(world, event)

    def _on_trip_update(self, world: "World", event: TripUpdate) -> None:
        now = world.now_s
        status = event.status
        if status == "assigned":
            if self.state in WAITING or self.state == DRIVER_ARRIVED:
                if self.state in WAITING:
                    self.matched_s = now
                self.state = MATCHED
                self.trip_code = event.trip_code
                self.driver_id = event.info.get("driver_id", self.driver_id)
                if self.cancel_sent and self.outcome == "gave_up":
                    # We cancelled the search just as a driver accepted; keep the ride.
                    self.cancel_sent = False
                    self.outcome = None
        elif status == "arrived":
            if self.state == MATCHED:
                self.state = DRIVER_ARRIVED
                self.arrived_s = now
        elif status == "in_progress":
            if self.state in (MATCHED, DRIVER_ARRIVED):
                self.state = ON_TRIP
                self.picked_up_s = now
        elif status == "completed":
            self.fare = event.info.get("fare")
            if self.trip.rating is not None:
                world.submit(RateTrip(self.id, "rider", self.trip.rating))
            self._finish(world, COMPLETED, "completed")
        elif status == "cancelled":
            self.cancelled_by = event.info.get("cancelled_by")
            if self.cancelled_by == "driver":
                self.outcome = "driver_cancelled"
            self._finish(world, CANCELLED, self.outcome or "cancelled")
