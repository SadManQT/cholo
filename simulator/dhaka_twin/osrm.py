"""A minimal OSRM-compatible route server backed by the twin's road graph.

Cholo calls ``/route/v1/driving/{lng,lat;lng,lat...}`` for every quote,
booking and completion. Pointing ``OSRM_BASE_URL`` here keeps load tests off
the public OSRM demo server and makes the server's distances and fares agree
with the simulator's roads.
"""

from __future__ import annotations

import logging

from aiohttp import web

from .roads import RoadGraph

log = logging.getLogger(__name__)


def route_response(graph: RoadGraph, coords: list[tuple[float, float]]) -> dict:
    """Build an OSRM ``route`` response for ``coords`` given as (lng, lat) pairs."""
    nodes = [graph.nearest_node(lat, lng) for lng, lat in coords]
    geometry: list[list[float]] = []
    legs = []
    distance = 0.0
    duration = 0.0
    for a, b in zip(nodes, nodes[1:]):
        route = graph.route(a, b)
        if route is None:
            return {"code": "NoRoute", "message": "No route found between points"}
        leg_distance = route.length_m
        leg_duration = graph.route_freeflow_s(route)
        points = graph.route_polyline(route) if len(route) else [(float(graph.node_lat[a]), float(graph.node_lng[a]))] * 2
        for lat, lng in points if not geometry else points[1:]:
            geometry.append([round(lng, 6), round(lat, 6)])
        legs.append({"distance": leg_distance, "duration": leg_duration, "steps": [], "summary": ""})
        distance += leg_distance
        duration += leg_duration
    if len(geometry) < 2:
        geometry = geometry * 2 if geometry else [[coords[0][0], coords[0][1]]] * 2
    return {
        "code": "Ok",
        "routes": [{
            "distance": round(distance, 1),
            "duration": round(duration, 1),
            "weight": round(duration, 1),
            "weight_name": "duration",
            "geometry": {"type": "LineString", "coordinates": geometry},
            "legs": legs,
        }],
        "waypoints": [
            {"location": [float(graph.node_lng[n]), float(graph.node_lat[n])], "name": "", "hint": ""} for n in nodes
        ],
    }


def parse_coordinates(text: str) -> list[tuple[float, float]]:
    coords = []
    for pair in text.split(";"):
        lng, lat = pair.split(",")
        coords.append((float(lng), float(lat)))
    if len(coords) < 2:
        raise ValueError("need at least two coordinates")
    return coords


def make_app(graph: RoadGraph) -> web.Application:
    async def route(request: web.Request) -> web.Response:
        raw = request.match_info["coords"].removesuffix(".json")
        try:
            coords = parse_coordinates(raw)
        except ValueError:
            return web.json_response({"code": "InvalidQuery", "message": "Query string malformed"}, status=400)
        return web.json_response(route_response(graph, coords))

    async def health(_request: web.Request) -> web.Response:
        return web.json_response({"ok": True, "graph": graph.source})

    app = web.Application()
    app.router.add_get("/route/v1/{profile}/{coords}", route)
    app.router.add_get("/health", health)
    return app


async def serve_osrm(graph: RoadGraph, host: str = "127.0.0.1", port: int = 5005) -> None:
    import asyncio

    runner = web.AppRunner(make_app(graph), access_log=None)
    await runner.setup()
    await web.TCPSite(runner, host, port).start()
    print(f"OSRM-compatible routing on http://{host}:{port} ({graph.source} graph, {graph.n_nodes:,} nodes). "
          f"Start Cholo with OSRM_BASE_URL=http://{host}:{port}")
    try:
        while True:
            await asyncio.sleep(3600)
    finally:
        await runner.cleanup()
