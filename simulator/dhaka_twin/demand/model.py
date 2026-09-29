"""Trip generation: a spatiotemporal Poisson process over H3 hexagons.

Each purpose (commute, shopping, airport, after-prayer, ...) has an hourly
rate from :mod:`patterns`. Origins are drawn from that purpose's weight over
H3 cells, destinations from a gravity model (attraction x distance decay).
All rider attributes (patience, vehicle type, payment) are drawn here from the
demand random stream so every dispatch policy sees exactly the same riders.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime

import h3
import numpy as np

from ..geo import haversine_np
from ..roads import RoadGraph
from .patterns import EVENT_PURPOSES, PURPOSES, VEHICLE_KINDS, Conditions
from .places import CATEGORIES, PLACES

H3_RES = 8
MIN_TRIP_KM = 0.8

VEHICLE_MIX = {
    "default": (0.42, 0.15, 0.36, 0.07),
    "commute_to_work": (0.55, 0.12, 0.29, 0.04),
    "commute_home": (0.55, 0.12, 0.29, 0.04),
    "airport_out": (0.05, 0.15, 0.60, 0.20),
    "airport_in": (0.05, 0.15, 0.60, 0.20),
    "exodus": (0.15, 0.35, 0.45, 0.05),
    "cricket_in": (0.50, 0.20, 0.27, 0.03),
    "cricket_out": (0.50, 0.20, 0.27, 0.03),
}


@dataclass
class TripSpec:
    id: int
    created_at: datetime
    purpose: str
    origin_node: int
    dest_node: int
    o_lat: float
    o_lng: float
    d_lat: float
    d_lng: float
    o_cell: str
    d_cell: str
    vehicle: str
    payment: str
    women_only: bool
    gender: str
    patience_s: float
    pickup_tolerance_s: float
    walk_s: float
    changes_mind: bool
    rating: int | None
    pickup_label: str
    dropoff_label: str

    def to_json(self) -> dict:
        d = dict(self.__dict__)
        d["created_at"] = self.created_at.isoformat()
        return d


class DemandModel:
    def __init__(self, graph: RoadGraph, rng: np.random.Generator, res: int = H3_RES) -> None:
        self.graph = graph
        self.rng = rng
        self.res = res
        self._next_id = 1

        node_cells = [h3.latlng_to_cell(la, ln, res) for la, ln in zip(graph.node_lat, graph.node_lng)]
        self.cells = sorted(set(node_cells))
        self.cell_index = {c: i for i, c in enumerate(self.cells)}
        buckets: list[list[int]] = [[] for _ in self.cells]
        for node, cell in enumerate(node_cells):
            buckets[self.cell_index[cell]].append(node)
        self.cell_nodes = [np.asarray(b, dtype=np.int64) for b in buckets]
        self.node_cell_idx = np.asarray([self.cell_index[c] for c in node_cells], dtype=np.int32)
        centers = np.array([h3.cell_to_latlng(c) for c in self.cells])
        self.cell_lat = centers[:, 0]
        self.cell_lng = centers[:, 1]
        counts = np.array([len(b) for b in buckets], dtype=np.float64)
        self.density = np.sqrt(counts) / np.sqrt(counts).sum()
        self.dist_km = (
            haversine_np(self.cell_lat[:, None], self.cell_lng[:, None], self.cell_lat[None, :], self.cell_lng[None, :]) / 1000
        ).astype(np.float32)
        self.category = {cat: self._category_weight(cat) for cat in CATEGORIES}
        self.category["stadium_mirpur"] = self._place_weight([p for p in PLACES if p.name.startswith("Sher-e-Bangla National Cricket")])
        self._vectors: dict[str, np.ndarray] = {}
        self._origin_mult_key = None
        self._origin_mult = np.ones(len(self.cells))

    # ---------------------------------------------------------------- weights
    def _place_weight(self, places) -> np.ndarray:
        w = np.zeros(len(self.cells))
        for p in places:
            d = haversine_np(self.cell_lat, self.cell_lng, p.lat, p.lng)
            w += p.weight * np.exp(-0.5 * (d / p.radius_m) ** 2)
        return w

    def _category_weight(self, category: str) -> np.ndarray:
        w = self._place_weight([p for p in PLACES if p.category == category])
        if category == "residential":
            # Road density stands in for population where no named neighbourhood is close.
            w = w / max(w.sum(), 1e-12) + 0.35 * self.density
        total = w.sum()
        return w / total if total > 0 else np.full(len(self.cells), 1 / len(self.cells))

    def weights(self, spec: str) -> np.ndarray:
        """Combined weight for a spec like ``"retail+leisure"`` (normalised)."""
        if spec not in self._vectors:
            w = sum(self.category[part] for part in spec.split("+"))
            self._vectors[spec] = w / w.sum()
        return self._vectors[spec]

    def expected_origin_rate(self, cond: Conditions) -> np.ndarray:
        """Expected requests per hour starting in each cell (for heatmaps and repositioning)."""
        rate = np.zeros(len(self.cells))
        for purpose, r in cond.rates_per_hour.items():
            if r > 0:
                rate += r * self.weights(self._spec(purpose)["origin"])
        return rate * self._origin_multiplier(cond)

    def _spec(self, purpose: str) -> dict:
        return PURPOSES.get(purpose) or EVENT_PURPOSES[purpose]

    def _origin_multiplier(self, cond: Conditions) -> np.ndarray:
        key = tuple((z.lat, z.lng, z.radius_m, z.origin) for z in cond.zones if z.origin != 1.0)
        if key != self._origin_mult_key:
            mult = np.ones(len(self.cells))
            for lat, lng, radius, factor in key:
                inside = haversine_np(self.cell_lat, self.cell_lng, lat, lng) <= radius
                mult[inside] *= factor
            self._origin_mult_key = key
            self._origin_mult = mult
        return self._origin_mult

    # ---------------------------------------------------------------- sampling
    def generate(self, t: datetime, dt_s: float, cond: Conditions) -> list[TripSpec]:
        trips: list[TripSpec] = []
        origin_mult = self._origin_multiplier(cond)
        for purpose in sorted(cond.rates_per_hour):
            rate = cond.rates_per_hour[purpose]
            if rate <= 0:
                continue
            n = int(self.rng.poisson(rate * dt_s / 3600.0))
            if n == 0:
                continue
            spec = self._spec(purpose)
            wo = self.weights(spec["origin"]) * origin_mult
            wo = wo / wo.sum()
            wd = self.weights(spec["dest"])
            origins = self.rng.choice(len(self.cells), size=n, p=wo)
            for o in origins:
                d = self._destination(int(o), wd, spec["decay_km"])
                if d is None:
                    continue
                trips.append(self._make_trip(t, purpose, int(o), d, cond))
        return trips

    def _destination(self, o: int, wd: np.ndarray, decay_km: float) -> int | None:
        dist = self.dist_km[o]
        w = wd * (dist >= MIN_TRIP_KM)
        if decay_km > 0:
            w = w * np.exp(-dist / decay_km)
        total = w.sum()
        if total <= 0:
            return None
        return int(self.rng.choice(len(self.cells), p=w / total))

    def _pick_node(self, cell: int) -> int:
        nodes = self.cell_nodes[cell]
        return int(nodes[self.rng.integers(len(nodes))])

    def _make_trip(self, t: datetime, purpose: str, o: int, d: int, cond: Conditions) -> TripSpec:
        rng = self.rng
        g = self.graph
        on = self._pick_node(o)
        dn = self._pick_node(d)
        trip_km = float(self.dist_km[o, d])
        mix = np.array(VEHICLE_MIX.get(purpose, VEHICLE_MIX["default"]), dtype=np.float64)
        if trip_km > 12:
            mix = mix * np.array([0.5, 0.8, 1.3, 1.3])
        if cond.rain > 0:
            mix = mix * np.array([1 - 0.6 * cond.rain, 1 + 0.2 * cond.rain, 1 + 0.3 * cond.rain, 1 + 0.3 * cond.rain])
        vehicle = VEHICLE_KINDS[int(rng.choice(4, p=mix / mix.sum()))]
        gender = "female" if rng.random() < 0.35 else "male"
        women_only = gender == "female" and vehicle != "bike" and rng.random() < 0.08
        patience = float(np.clip(rng.lognormal(math.log(240), 0.5), 60, 900)) * (1 + 0.3 * cond.rain)
        trip = TripSpec(
            id=self._next_id,
            created_at=t,
            purpose=purpose,
            origin_node=on,
            dest_node=dn,
            o_lat=float(g.node_lat[on]),
            o_lng=float(g.node_lng[on]),
            d_lat=float(g.node_lat[dn]),
            d_lng=float(g.node_lng[dn]),
            o_cell=self.cells[o],
            d_cell=self.cells[d],
            vehicle=vehicle,
            payment="wallet" if rng.random() < 0.2 else "cash",
            women_only=bool(women_only),
            gender=gender,
            patience_s=patience,
            pickup_tolerance_s=float(np.clip(rng.lognormal(math.log(900), 0.45), 300, 2400)),
            walk_s=float(rng.uniform(20, 120)),
            changes_mind=bool(rng.random() < 0.03),
            rating=int(rng.choice([5, 5, 5, 4, 4, 3])) if rng.random() < 0.55 else None,
            pickup_label=nearest_place_label(g.node_lat[on], g.node_lng[on]),
            dropoff_label=nearest_place_label(g.node_lat[dn], g.node_lng[dn]),
        )
        self._next_id += 1
        return trip


_PLACE_LAT = np.array([p.lat for p in PLACES])
_PLACE_LNG = np.array([p.lng for p in PLACES])


def nearest_place_label(lat: float, lng: float) -> str:
    d = haversine_np(_PLACE_LAT, _PLACE_LNG, lat, lng)
    i = int(np.argmin(d))
    return f"Near {PLACES[i].name}" if d[i] < 1500 else f"{lat:.4f}, {lng:.4f}"
