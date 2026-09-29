"""Serve the live map: road network, demand hexagons, every car, and KPIs.

The page is plain HTML + canvas (no CDN or map tiles), so it works offline.
Sources: a running :class:`~dhaka_twin.engine.World` or a recorded run.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from pathlib import Path

import h3
import numpy as np
from aiohttp import WSMsgType, web

from ..demand.places import PLACES
from ..recorder import build_frame, load_meta, read_jsonl_gz

log = logging.getLogger(__name__)
STATIC = Path(__file__).parent / "static"
PUSH_EVERY_S = 0.25


def roads_payload(graph) -> dict:
    """Road polylines grouped by class, two-way roads sent once, coords as 1e-5 ints."""
    seen: set[tuple[int, int]] = set()
    by_class: dict[int, list[list[int]]] = {}
    for e in range(graph.n_edges):
        u = int(graph.edge_src[e])
        v = int(graph.edge_dst[e])
        key = (u, v) if u < v else (v, u)
        if key in seen:
            continue
        seen.add(key)
        s = int(graph.geom_offsets[e])
        t = int(graph.geom_offsets[e + 1])
        flat = np.empty(2 * (t - s), dtype=np.int64)
        flat[0::2] = np.round(graph.geom_lat[s:t] * 1e5)
        flat[1::2] = np.round(graph.geom_lng[s:t] * 1e5)
        by_class.setdefault(int(graph.edge_class[e]), []).append(flat.tolist())
    return {str(k): v for k, v in sorted(by_class.items())}


def cells_payload(cells: list[str]) -> list[list[int]]:
    out = []
    for c in cells:
        ring = h3.cell_to_boundary(c)
        out.append([v for lat, lng in ring for v in (round(lat * 1e5), round(lng * 1e5))])
    return out


class LiveSource:
    mode = "live"

    def __init__(self, world, label: str = "") -> None:
        self.world = world
        self.label = label
        self._last_heat = 0.0
        self._roads = None
        self._cells = None

    def init_payload(self) -> dict:
        w = self.world
        return {
            "mode": "simulation" if not w.backend.realtime else "live",
            "label": self.label,
            "scenario": w.scenario.to_json(),
            "backend": w.backend.stats(),
            "bounds": w.graph.bounds(),
            "roads": self._roads or self._cache_static(),
            "cells": self._cells,
            "places": [{"name": p.name, "lat": p.lat, "lng": p.lng, "cat": p.category} for p in PLACES
                       if p.category in ("terminal", "airport", "stadium", "office", "retail") and p.weight >= 0.8],
            "drivers": [d.vehicle for d in self.world.drivers],
            "speed": w.speed,
            "canControl": True,
            "series": [{"sim_s": p["sim_s"], "online": p["online"], "busy": p["busy"], "waiting": p["waiting_riders"]}
                       for p in w.metrics.series],
        }

    def _cache_static(self):
        self._roads = roads_payload(self.world.graph)
        self._cells = cells_payload(self.world.demand.cells)
        return self._roads

    def frame(self) -> dict:
        f = build_frame(self.world)
        now = time.monotonic()
        if now - self._last_heat > 2.0:
            self._last_heat = now
            f["heat"] = [round(float(x), 1) for x in self.world._expected]
        f["speed"] = self.world.speed
        f["paused"] = self.world.paused
        return f

    def control(self, msg: dict) -> None:
        cmd = msg.get("cmd")
        if cmd == "pause":
            self.world.paused = True
        elif cmd == "resume":
            self.world.paused = False
        elif cmd == "speed" and not self.world.backend.realtime:
            value = msg.get("value")
            self.world.set_speed(None if value in (None, "max") else float(value))


class ReplaySource:
    """Plays a recorded run's frames back at a chosen speed."""

    mode = "replay"

    def __init__(self, run_dir: str | Path, graph, speed: float = 2.0) -> None:
        self.run_dir = Path(run_dir)
        self.meta = load_meta(run_dir)
        self.graph = graph
        self.speed = speed
        self.paused = False
        self._frames = read_jsonl_gz(self.run_dir / "frames.jsonl.gz")
        self._current = next(self._frames, None)
        self._upcoming = next(self._frames, None)
        self._clock_s = self._current["t"] if self._current else 0.0
        self._wall = time.monotonic()
        self._heat = None
        self._payload: dict | None = None
        from ..demand.model import DemandModel

        self._cells = DemandModel(graph, np.random.default_rng(0)).cells

    def init_payload(self) -> dict:
        if self._payload is None:
            self._payload = self._build_payload()
        return self._payload

    def _build_payload(self) -> dict:
        return {
            "mode": "replay",
            "label": f"Replay of {self.run_dir.name}",
            "scenario": self.meta["scenario"],
            "backend": {"policy": self.meta.get("policy"), "backend": self.meta.get("backend")},
            "bounds": self.graph.bounds(),
            "roads": roads_payload(self.graph),
            "cells": cells_payload(self._cells),
            "places": [{"name": p.name, "lat": p.lat, "lng": p.lng, "cat": p.category} for p in PLACES
                       if p.category in ("terminal", "airport", "stadium", "office", "retail") and p.weight >= 0.8],
            "drivers": [d["vehicle"] for d in self.meta["drivers"]],
            "speed": self.speed,
            "canControl": True,
        }

    def frame(self) -> dict | None:
        now = time.monotonic()
        if not self.paused:
            self._clock_s += (now - self._wall) * self.speed
        self._wall = now
        while self._upcoming is not None and self._upcoming["t"] <= self._clock_s:
            self._current = self._upcoming
            self._upcoming = next(self._frames, None)
            if "heat" in self._current:
                self._heat = self._current["heat"]
        if self._current is None:
            return None
        f = dict(self._current)
        if self._heat is not None:
            f["heat"] = self._heat
        f["speed"] = self.speed
        f["paused"] = self.paused
        f["ended"] = self._upcoming is None
        return f

    def control(self, msg: dict) -> None:
        cmd = msg.get("cmd")
        if cmd == "pause":
            self.paused = True
        elif cmd == "resume":
            self.paused = False
        elif cmd == "speed" and msg.get("value") not in (None, "max"):
            self.speed = float(msg["value"])


class Dashboard:
    def __init__(self, source, host: str = "127.0.0.1", port: int = 8765) -> None:
        self.source = source
        self.host = host
        self.port = port
        self._runner: web.AppRunner | None = None

    async def _index(self, request: web.Request) -> web.FileResponse:
        return web.FileResponse(STATIC / "index.html")

    async def _init(self, request: web.Request) -> web.Response:
        body = json.dumps(self.source.init_payload(), separators=(",", ":")).encode()
        response = web.Response(body=body, content_type="application/json")
        response.enable_compression()
        return response

    async def _ws(self, request: web.Request) -> web.WebSocketResponse:
        ws = web.WebSocketResponse(heartbeat=20, compress=True)
        await ws.prepare(request)

        async def pump() -> None:
            last_t = None
            while not ws.closed:
                frame = self.source.frame()
                if frame is not None and (frame["t"] != last_t or frame.get("paused")):
                    last_t = frame["t"]
                    await ws.send_str(json.dumps(frame, separators=(",", ":")))
                await asyncio.sleep(PUSH_EVERY_S)

        task = asyncio.create_task(pump())
        try:
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    try:
                        self.source.control(json.loads(msg.data))
                    except (ValueError, TypeError):
                        log.debug("ignoring malformed control message")
        finally:
            task.cancel()
        return ws

    async def start(self) -> str:
        app = web.Application()
        app.router.add_get("/", self._index)
        app.router.add_get("/api/init", self._init)
        app.router.add_get("/ws", self._ws)
        app.router.add_static("/static", STATIC)
        self._runner = web.AppRunner(app)
        await self._runner.setup()
        site = web.TCPSite(self._runner, self.host, self.port)
        await site.start()
        url = f"http://{self.host}:{self.port}/"
        log.info("dashboard at %s", url)
        return url

    async def stop(self) -> None:
        if self._runner is not None:
            await self._runner.cleanup()
