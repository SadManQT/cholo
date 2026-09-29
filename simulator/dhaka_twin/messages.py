"""Commands agents send to the platform and events the platform sends back.

Agents never call a backend directly: they submit commands and react to
events. The local backend answers in-process; the Cholo backend turns the same
commands into real HTTP and Socket.io traffic.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .demand.model import TripSpec


# ---------------------------------------------------------------- commands
@dataclass(frozen=True)
class RequestRide:
    rider_id: int
    trip: TripSpec


@dataclass(frozen=True)
class CancelRequest:
    rider_id: int


@dataclass(frozen=True)
class CancelTrip:
    agent_id: int
    role: str  # "rider" | "driver"
    reason: str


@dataclass(frozen=True)
class ConfirmPickup:
    rider_id: int


@dataclass(frozen=True)
class RateTrip:
    agent_id: int
    role: str
    score: int


@dataclass(frozen=True)
class GoOnline:
    driver_id: int
    lat: float
    lng: float


@dataclass(frozen=True)
class GoOffline:
    driver_id: int


@dataclass(frozen=True)
class PingLocation:
    driver_id: int
    lat: float
    lng: float
    heading: float | None
    speed_kmh: float


@dataclass(frozen=True)
class RespondOffer:
    driver_id: int
    offer_id: str
    accept: bool


@dataclass(frozen=True)
class Arrived:
    driver_id: int
    lat: float
    lng: float


@dataclass(frozen=True)
class StartTrip:
    driver_id: int


@dataclass(frozen=True)
class CompleteTrip:
    driver_id: int
    lat: float
    lng: float


Command = (
    RequestRide | CancelRequest | CancelTrip | ConfirmPickup | RateTrip | GoOnline | GoOffline
    | PingLocation | RespondOffer | Arrived | StartTrip | CompleteTrip
)


# ---------------------------------------------------------------- events
@dataclass(frozen=True)
class RequestPlaced:
    rider_id: int
    request_id: str
    est_fare: float


@dataclass(frozen=True)
class RequestEnded:
    rider_id: int
    status: str  # "expired" | "cancelled"


@dataclass(frozen=True)
class OfferMade:
    driver_id: int
    offer_id: str
    request_id: str
    distance_km: float


@dataclass(frozen=True)
class OfferAnswered:
    driver_id: int
    offer_id: str
    ok: bool
    trip_code: str | None = None
    pickup: tuple[float, float] | None = None
    dropoff: tuple[float, float] | None = None
    error: str | None = None


@dataclass(frozen=True)
class TripUpdate:
    agent_id: int
    role: str
    trip_code: str
    status: str  # assigned | arrived | in_progress | completed | cancelled
    info: dict = field(default_factory=dict)


@dataclass(frozen=True)
class DriverStatus:
    driver_id: int
    online: bool
    error: str | None = None


@dataclass(frozen=True)
class CommandFailed:
    agent_id: int
    role: str
    command: str
    error: str


Event = RequestPlaced | RequestEnded | OfferMade | OfferAnswered | TripUpdate | DriverStatus | CommandFailed
