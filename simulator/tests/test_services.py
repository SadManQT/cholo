"""OSRM stand-in, dashboard server and Cholo client helpers."""

import asyncio
import json

import pytest
from aiohttp.test_utils import TestClient, TestServer

from dhaka_twin.backends.cholo import CholoBackend, seeded_gender, seeded_vehicle
from dhaka_twin.backends.local import LocalPlatform
from dhaka_twin.dashboard.server import Dashboard, LiveSource, roads_payload
from dhaka_twin.engine import World
from dhaka_twin.messages import TripUpdate
from dhaka_twin.osrm import make_app, parse_coordinates, route_response
from dhaka_twin.scenario import PRESETS


def test_osrm_response_has_the_shape_cholo_parses(graph):
    body = route_response(graph, [(90.4078, 23.7925), (90.3742, 23.7461)])
    assert body["code"] == "Ok"
    route = body["routes"][0]
    assert route["distance"] > 5000 and route["duration"] > 300
    coords = route["geometry"]["coordinates"]
    assert len(coords) >= 2 and all(88 < lng < 93 and 20 < lat < 27 for lng, lat in coords)
    with_stop = route_response(graph, [(90.4078, 23.7925), (90.40, 23.76), (90.3742, 23.7461)])
    assert len(with_stop["routes"][0]["legs"]) == 2
    with pytest.raises(ValueError):
        parse_coordinates("90.4,23.8")


def test_osrm_http_endpoint(graph):
    async def go():
        async with TestClient(TestServer(make_app(graph))) as client:
            r = await client.get("/route/v1/driving/90.4078,23.7925;90.3742,23.7461?overview=full&geometries=geojson")
            assert r.status == 200
            assert (await r.json())["code"] == "Ok"
            bad = await client.get("/route/v1/driving/nonsense")
            assert bad.status == 400

    asyncio.run(go())


def test_dashboard_serves_init_and_streams_frames(graph):
    async def go():
        world = World(PRESETS["weekday"].with_overrides(drivers=50), graph, LocalPlatform())
        board = Dashboard(LiveSource(world, label="skeleton"))
        from aiohttp import web

        app = web.Application()
        app.router.add_get("/", board._index)
        app.router.add_get("/api/init", board._init)
        app.router.add_get("/ws", board._ws)
        async with TestClient(TestServer(app)) as client:
            assert (await client.get("/")).status == 200
            init = await (await client.get("/api/init")).json()
            assert len(init["drivers"]) == 50 and init["roads"] and init["cells"]
            ws = await client.ws_connect("/ws")
            frame = json.loads((await ws.receive()).data)
            assert len(frame["lat"]) == 50 and "kpi" in frame
            await ws.send_str(json.dumps({"cmd": "speed", "value": "60"}))
            await ws.send_str(json.dumps({"cmd": "pause"}))
            await asyncio.sleep(0.05)
            assert world.speed == 60 and world.paused
            await ws.close()

    asyncio.run(go())


def test_roads_payload_sends_two_way_roads_once(graph):
    payload = roads_payload(graph)
    total = sum(len(v) for v in payload.values())
    assert total == graph.n_edges // 2


def test_seeded_vehicle_mix_matches_the_sql_formula():
    kinds = [seeded_vehicle(i) for i in range(1, 1001)]
    share = {k: kinds.count(k) / len(kinds) for k in set(kinds)}
    assert share == pytest.approx({"bike": 0.45, "cng": 0.15, "car": 0.33, "premium": 0.07}, abs=0.01)
    assert all(seeded_gender(i) == "male" for i in range(1, 200) if seeded_vehicle(i) == "bike")


def test_socket_trip_status_maps_to_agent_events():
    backend = CholoBackend()
    from dhaka_twin.backends.cholo import Account

    rider = Account("01300000001", "rider", agent_id=5)
    backend.riders[5] = rider
    backend.trip_driver["JT-2026-000001"] = 9
    backend._on_trip_status(rider, {"status": "assigned", "tripCode": "JT-2026-000001"})
    backend._on_trip_status(rider, {"status": "arrived", "arrivedAt": "x"})
    driver = Account("01400000009", "driver", agent_id=9, trip_code="JT-2026-000001")
    backend._on_trip_status(driver, {"status": "completed", "fare": {"total": "280.00"}})
    events = backend.drain()
    assert [(e.agent_id, e.role, e.status) for e in events] == [(5, "rider", "assigned"), (5, "rider", "arrived"),
                                                               (9, "driver", "completed")]
    assert all(isinstance(e, TripUpdate) and e.trip_code == "JT-2026-000001" for e in events)
    assert events[0].info["driver_id"] == 9 and events[2].info["fare"] == 280.0
    assert driver.trip_code is None
    assert CholoBackend._route_key("POST", "/trips/JT-2026-000123/arrived") == "POST /trips/:code/arrived"
    assert CholoBackend._route_key("POST", "/driver/offers/42/respond") == "POST /driver/offers/:n/respond"
