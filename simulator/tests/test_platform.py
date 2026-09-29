"""The local platform must follow Cholo's production rules."""

import asyncio
from types import SimpleNamespace

import numpy as np
import pytest

from dhaka_twin.backends.local import LDriver, LocalPlatform, cholo_fare
from dhaka_twin.demand.model import TripSpec
from dhaka_twin.dispatch.policies import CholoV1
from dhaka_twin.messages import (
    Arrived,
    CancelRequest,
    CommandFailed,
    CompleteTrip,
    ConfirmPickup,
    GoOnline,
    OfferAnswered,
    OfferMade,
    RequestEnded,
    RequestPlaced,
    RequestRide,
    RespondOffer,
    StartTrip,
    TripUpdate,
)
from dhaka_twin.scenario import at


def test_fares_match_the_server_fare_math():
    # Same cases as server/tests/unit/fareMath.test.js (Car tariff).
    assert cholo_fare("car", 9.21, 9) == 295
    assert cholo_fare("car", 0.5, 2) == 130
    assert cholo_fare("car", 9.21, 9, surge=1.5) == round((60 + 202.62 + 22.5) * 1.5 + 10)
    assert cholo_fare("bike", 0, 0) == 45  # minimum 40 + booking 5


class FakeWorld:
    def __init__(self, graph, drivers):
        self.graph = graph
        self.now_s = 0.0
        self.drivers = drivers
        self.demand = SimpleNamespace(cells=["x"], cell_nodes=[np.arange(graph.n_nodes)], res=8)
        self.cond = SimpleNamespace(speed_factor=1.0)

    @property
    def now(self):
        return at("2026-09-29", "09:00")


def trip(graph, o=0, d=40, vehicle="car", women_only=False):
    return TripSpec(
        id=1, created_at=at("2026-09-29", "09:00"), purpose="errand", origin_node=o, dest_node=d,
        o_lat=float(graph.node_lat[o]), o_lng=float(graph.node_lng[o]), d_lat=float(graph.node_lat[d]),
        d_lng=float(graph.node_lng[d]), o_cell="x", d_cell="x", vehicle=vehicle, payment="cash",
        women_only=women_only, gender="female", patience_s=300, pickup_tolerance_s=900, walk_s=30,
        changes_mind=False, rating=5, pickup_label="Near A", dropoff_label="Near B",
    )


@pytest.fixture
def platform(graph):
    drivers = [SimpleNamespace(id=i, vehicle="car", gender="male" if i != 3 else "female") for i in (1, 2, 3)]
    p = LocalPlatform("cholo-v1")
    world = FakeWorld(graph, drivers)
    p.world = world
    for d in drivers:
        p.drivers[d.id] = LDriver(d.id, d.vehicle, d.gender)
    p.matrix = SimpleNamespace(cell_of=lambda lat, lng: 0, seconds=np.zeros((1, 1)))
    lat, lng = float(graph.node_lat[1]), float(graph.node_lng[1])
    for d in drivers:
        p.submit(GoOnline(d.id, lat, lng))
    p.drain()
    return p


def of_type(events, cls):
    return [e for e in events if isinstance(e, cls)]


def test_full_trip_lifecycle_with_rider_confirmation(graph, platform):
    p = platform
    t = trip(graph)
    p.submit(RequestRide(10, t))
    events = p.drain()
    placed = of_type(events, RequestPlaced)[0]
    offers = of_type(events, OfferMade)
    # Broadcast: every eligible car within 5 km gets the offer at once.
    assert {o.driver_id for o in offers} == {1, 2, 3}

    p.submit(RespondOffer(2, offers[1].offer_id, True))
    events = p.drain()
    answered = of_type(events, OfferAnswered)[0]
    assert answered.ok and answered.pickup == pytest.approx((t.o_lat, t.o_lng))
    code = answered.trip_code
    assert code.startswith("JT-2026-")
    assert {(e.role, e.status) for e in of_type(events, TripUpdate)} == {("rider", "assigned"), ("driver", "assigned")}

    # The other drivers' offers were withdrawn silently: accepting now loses the race.
    p.submit(RespondOffer(1, offers[0].offer_id, True))
    assert of_type(p.drain(), CommandFailed)[0].error == "ALREADY_TAKEN"

    far = graph.nearest_node(23.85, 90.40)
    p.submit(Arrived(2, float(graph.node_lat[far]), float(graph.node_lng[far])))
    assert of_type(p.drain(), CommandFailed)[0].error == "TOO_FAR_FROM_PICKUP"

    p.submit(Arrived(2, t.o_lat, t.o_lng))
    p.drain()
    p.submit(StartTrip(2))
    started = of_type(p.drain(), TripUpdate)
    assert all(e.status == "arrived" and e.info.get("start_requested") for e in started)
    p.submit(ConfirmPickup(10))
    assert {e.status for e in of_type(p.drain(), TripUpdate)} == {"in_progress"}

    p.submit(CompleteTrip(2, t.d_lat, t.d_lng))
    done = of_type(p.drain(), TripUpdate)
    assert {e.status for e in done} == {"completed"}
    assert done[0].info["fare"] == p.requests[placed.request_id].est_fare
    assert p.drivers[2].status == "online"
    assert p.drivers[2].balance == pytest.approx(-round(done[0].info["fare"] * 0.15, 2))


def test_offers_expire_after_15_seconds_and_requests_after_5_minutes(graph, platform):
    p = platform
    p.submit(RequestRide(10, trip(graph)))
    offers = of_type(p.drain(), OfferMade)
    p.world.now_s = 16.0
    p.submit(RespondOffer(1, offers[0].offer_id, True))
    assert of_type(p.drain(), CommandFailed)[0].error == "OFFER_EXPIRED"
    p.world.now_s = 301.0
    p.step(301.0)
    assert of_type(p.drain(), RequestEnded)[0].status == "expired"


def test_women_only_requests_reach_only_women_drivers(graph, platform):
    p = platform
    p.submit(RequestRide(10, trip(graph, women_only=True)))
    assert {o.driver_id for o in of_type(p.drain(), OfferMade)} == {3}


def test_cancel_while_searching_and_after_match(graph, platform):
    p = platform
    p.submit(RequestRide(10, trip(graph)))
    p.drain()
    p.submit(CancelRequest(10))
    assert of_type(p.drain(), RequestEnded)[0].status == "cancelled"

    p.submit(RequestRide(11, trip(graph)))
    offers = of_type(p.drain(), OfferMade)
    p.submit(RespondOffer(offers[0].driver_id, offers[0].offer_id, True))
    p.drain()
    p.submit(CancelRequest(11))
    assert of_type(p.drain(), CommandFailed)[0].error == "ALREADY_MATCHED"


def test_v1_radius_grows_only_after_a_round_that_made_offers(graph):
    policy = CholoV1()
    assert [policy.radius_for_round(r) for r in (1, 2, 3, 4)] == [5.0, 7.5, 10.0, 10.0]
    far = LocalPlatform("cholo-v1")
    drivers = [SimpleNamespace(id=1, vehicle="car", gender="male")]
    far.world = FakeWorld(graph, drivers)
    far.drivers[1] = LDriver(1, "car", "male")
    uttara = graph.nearest_node(23.8795, 90.4005)
    far.submit(GoOnline(1, float(graph.node_lat[uttara]), float(graph.node_lng[uttara])))
    old_dhaka = graph.nearest_node(23.7080, 90.4090)
    far.submit(RequestRide(10, trip(graph, o=old_dhaka)))
    far.drain()
    req = next(iter(far.requests.values()))
    for now in (20.0, 40.0, 60.0):
        far.world.now_s = now
        far.step(now)
    # The only driver is ~19 km away: every redispatch repeats round 1.
    assert req.max_round == 0 and not far.offers


def test_batched_eta_sends_one_offer_per_request(graph):
    p = LocalPlatform("batched-eta")
    drivers = [SimpleNamespace(id=i, vehicle="car", gender="male") for i in (1, 2, 3)]
    p.world = FakeWorld(graph, drivers)
    for d in drivers:
        p.drivers[d.id] = LDriver(d.id, "car", "male")
    p.matrix = SimpleNamespace(cell_of=lambda lat, lng: 0, seconds=np.zeros((1, 1)))
    for i, d in enumerate(drivers):
        n = graph.nearest_node(23.78 + i * 0.01, 90.40)
        p.submit(GoOnline(d.id, float(graph.node_lat[n]), float(graph.node_lng[n])))
    p.submit(RequestRide(10, trip(graph, o=graph.nearest_node(23.78, 90.40))))
    p.submit(RequestRide(11, trip(graph, o=graph.nearest_node(23.80, 90.40))))
    p.drain()
    p.world.now_s = 5.0
    p.step(5.0)
    offers = of_type(p.drain(), OfferMade)
    assert len(offers) == 2
    assert len({o.driver_id for o in offers}) == 2
    assert len({o.request_id for o in offers}) == 2


def test_run_loop_rejects_fast_mode_for_real_servers(graph):
    from dhaka_twin.engine import World
    from dhaka_twin.scenario import PRESETS

    backend = LocalPlatform()
    backend.realtime = True
    world = World(PRESETS["weekday"].with_overrides(drivers=5), graph, backend)
    with pytest.raises(ValueError):
        asyncio.run(world.run(duration_s=10))
