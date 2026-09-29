"""Write a run to disk: an event log, replay frames, and ML-ready tables.

A run directory contains:

* ``meta.json``        scenario, seed, policy, backend, fleet, road graph source
* ``events.jsonl.gz``  every agent event (request, accept, arrived, rider_done, ...)
* ``frames.jsonl.gz``  city snapshots for replay (driver positions and states)
* ``requests.jsonl.gz`` every generated ride request, for ``--demand-from`` replays
* ``trips.csv``        one row per ride request with its outcome and timings
* ``gps.csv.gz``       optional driver GPS traces (``gps_every_s``)
* ``demand_hex.csv``   requests and completions per H3 cell per 15 minutes
* ``summary.json``     KPIs and the 5-minute time series
"""

from __future__ import annotations

import csv
import gzip
import json
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING

from . import __version__
from .demand.model import TripSpec
from .scenario import Scenario

if TYPE_CHECKING:
    from .agents.rider import Rider
    from .engine import World

STATE_CODES = {
    "offline": "o",
    "going_online": "o",
    "going_offline": "o",
    "idle": "i",
    "accepting": "a",
    "to_pickup": "p",
    "at_pickup": "w",
    "on_trip": "t",
    "completing": "t",
}

TRIP_FIELDS = [
    "trip_id", "purpose", "vehicle", "payment", "women_only", "requested_at", "state", "outcome",
    "origin_lat", "origin_lng", "origin_h3", "dest_lat", "dest_lng", "dest_h3", "driver_id",
    "time_to_match_s", "pickup_wait_s", "ride_time_s", "est_fare", "fare", "rain", "events",
]


def build_frame(world: "World") -> dict:
    """A compact snapshot of the city: drivers in fleet order, waiting riders, KPIs."""
    lat = []
    lng = []
    states = []
    for d in world.drivers:
        lat.append(round(d.lat * 1e5))
        lng.append(round(d.lng * 1e5))
        states.append(STATE_CODES.get(d.state, "o"))
    waiting = []
    for r in world.riders.values():
        if r.state in ("requesting", "searching"):
            waiting.extend((round(r.trip.o_lat * 1e5), round(r.trip.o_lng * 1e5)))
    return {
        "t": round(world.now_s, 1),
        "clock": world.now.isoformat(timespec="seconds"),
        "lat": lat,
        "lng": lng,
        "s": "".join(states),
        "w": waiting,
        "kpi": world.metrics.snapshot(world),
    }


class Recorder:
    def __init__(self, out_dir: str | Path, *, frame_every_s: float = 10.0, gps_every_s: float | None = None) -> None:
        self.dir = Path(out_dir)
        self.dir.mkdir(parents=True, exist_ok=True)
        self.frame_every_s = frame_every_s
        self.gps_every_s = gps_every_s
        self._events = gzip.open(self.dir / "events.jsonl.gz", "wt", encoding="utf-8")
        self._requests = gzip.open(self.dir / "requests.jsonl.gz", "wt", encoding="utf-8")
        self._frames = gzip.open(self.dir / "frames.jsonl.gz", "wt", encoding="utf-8")
        self._trips_file = open(self.dir / "trips.csv", "w", newline="", encoding="utf-8")
        self._trips = csv.DictWriter(self._trips_file, fieldnames=TRIP_FIELDS)
        self._trips.writeheader()
        self._gps = None
        if gps_every_s:
            self._gps_file = gzip.open(self.dir / "gps.csv.gz", "wt", newline="", encoding="utf-8")
            self._gps = csv.writer(self._gps_file)
            self._gps.writerow(["t", "driver_id", "lat", "lng", "heading", "speed_kmh", "state"])
        self._next_frame_s = 0.0
        self._next_heat_s = 0.0
        self._next_gps_s = 0.0
        self.hex_counts: Counter[tuple[str, str, str]] = Counter()
        self.listeners: list = []

    # ---------------------------------------------------------------- hooks
    def begin(self, world: "World", **meta) -> None:
        data = {
            "version": __version__,
            "scenario": world.scenario.to_json(),
            "graph_source": world.graph.source,
            "dt_s": world.dt_s,
            "frame_every_s": self.frame_every_s,
            "drivers": [{"id": d.id, "vehicle": d.vehicle} for d in world.drivers],
            **meta,
        }
        (self.dir / "meta.json").write_text(json.dumps(data, indent=1, default=str))

    def event(self, now_s: float, kind: str, fields: dict) -> None:
        self._events.write(json.dumps({"t": round(now_s, 1), "k": kind, **fields}, separators=(",", ":"), default=str))
        self._events.write("\n")
        for listener in self.listeners:
            listener(now_s, kind, fields)

    def request(self, spec: TripSpec) -> None:
        self._requests.write(json.dumps(spec.to_json(), separators=(",", ":")))
        self._requests.write("\n")

    def tick(self, world: "World") -> None:
        if world.now_s >= self._next_frame_s:
            self._next_frame_s = world.now_s + self.frame_every_s
            frame = build_frame(world)
            if world.now_s >= self._next_heat_s:
                self._next_heat_s = world.now_s + 60.0
                frame["heat"] = [round(float(x), 1) for x in world._expected]
            self._frames.write(json.dumps(frame, separators=(",", ":")))
            self._frames.write("\n")
        if self._gps is not None and world.now_s >= self._next_gps_s:
            self._next_gps_s = world.now_s + self.gps_every_s
            t = round(world.now_s, 1)
            for d in world.drivers:
                if d.state not in ("offline", "going_online", "going_offline"):
                    self._gps.writerow([t, d.id, f"{d.lat:.6f}", f"{d.lng:.6f}",
                                        "" if d.heading is None else round(d.heading), round(d.speed_kmh, 1), d.state])

    def trip(self, rider: "Rider", world: "World") -> None:
        t = rider.trip
        bin_start = t.created_at.replace(minute=t.created_at.minute // 15 * 15, second=0, microsecond=0)
        bin_key = bin_start.isoformat()
        self.hex_counts[(t.o_cell, bin_key, "requests")] += 1
        if rider.state == "completed":
            self.hex_counts[(t.o_cell, bin_key, "completed")] += 1
            self.hex_counts[(t.d_cell, bin_key, "dropoffs")] += 1
        elif rider.state in ("cancelled", "expired"):
            self.hex_counts[(t.o_cell, bin_key, "unserved")] += 1

        def delta(a, b):
            return "" if a is None or b is None else round(a - b, 1)

        self._trips.writerow({
            "trip_id": t.id,
            "purpose": t.purpose,
            "vehicle": t.vehicle,
            "payment": t.payment,
            "women_only": int(t.women_only),
            "requested_at": t.created_at.isoformat(),
            "state": rider.state,
            "outcome": rider.outcome,
            "origin_lat": round(t.o_lat, 6),
            "origin_lng": round(t.o_lng, 6),
            "origin_h3": t.o_cell,
            "dest_lat": round(t.d_lat, 6),
            "dest_lng": round(t.d_lng, 6),
            "dest_h3": t.d_cell,
            "driver_id": rider.driver_id or "",
            "time_to_match_s": delta(rider.matched_s, rider.requested_s),
            "pickup_wait_s": delta(rider.arrived_s, rider.matched_s),
            "ride_time_s": delta(rider.done_s, rider.picked_up_s) if rider.state == "completed" else "",
            "est_fare": rider.est_fare if rider.est_fare is not None else "",
            "fare": rider.fare if rider.fare is not None else "",
            "rain": round(rider.rain_at_request, 2),
            "events": rider.events_at_request,
        })

    def finish(self, world: "World", summary: dict) -> None:
        self._events.close()
        self._requests.close()
        self._frames.close()
        self._trips_file.close()
        if self._gps is not None:
            self._gps_file.close()
        rows: dict[tuple[str, str], Counter] = {}
        for (cell, bin_key, kind), n in self.hex_counts.items():
            rows.setdefault((cell, bin_key), Counter())[kind] += n
        with open(self.dir / "demand_hex.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["h3", "bin_start", "requests", "completed", "unserved", "dropoffs"])
            for (cell, bin_key) in sorted(rows, key=lambda k: (k[1], k[0])):
                c = rows[(cell, bin_key)]
                w.writerow([cell, bin_key, c["requests"], c["completed"], c["unserved"], c["dropoffs"]])
        (self.dir / "summary.json").write_text(json.dumps(summary, indent=1, default=str))


def read_jsonl_gz(path: str | Path):
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                yield json.loads(line)


def load_meta(run_dir: str | Path) -> dict:
    return json.loads((Path(run_dir) / "meta.json").read_text())


class RecordedDemand:
    """Replay the exact ride requests of an earlier run (same times, places, riders).

    Requests are shifted to the new scenario's start and snapped to the current
    road graph, so a run recorded on the skeleton can be replayed on OSM roads.
    """

    def __init__(self, run_dir: str | Path, scenario_start: datetime, graph) -> None:
        meta = load_meta(run_dir)
        offset = scenario_start - Scenario.from_json(meta["scenario"]).start
        self._specs: list[TripSpec] = []
        for row in read_jsonl_gz(Path(run_dir) / "requests.jsonl.gz"):
            row["created_at"] = datetime.fromisoformat(row["created_at"]) + offset
            row["origin_node"] = graph.nearest_node(row["o_lat"], row["o_lng"])
            row["dest_node"] = graph.nearest_node(row["d_lat"], row["d_lng"])
            row["o_lat"], row["o_lng"] = float(graph.node_lat[row["origin_node"]]), float(graph.node_lng[row["origin_node"]])
            row["d_lat"], row["d_lng"] = float(graph.node_lat[row["dest_node"]]), float(graph.node_lng[row["dest_node"]])
            self._specs.append(TripSpec(**row))
        self._specs.sort(key=lambda s: (s.created_at, s.id))
        self._i = 0

    def __len__(self) -> int:
        return len(self._specs)

    def generate(self, t: datetime, dt_s: float, cond) -> list[TripSpec]:
        out = []
        while self._i < len(self._specs) and self._specs[self._i].created_at <= t:
            out.append(self._specs[self._i])
            self._i += 1
        return out
