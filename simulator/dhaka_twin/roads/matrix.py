"""Hexagon-to-hexagon free-flow travel times, used for fast dispatch ETAs."""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path

import h3
import numpy as np

from .graph import RoadGraph

log = logging.getLogger(__name__)


class TravelTimeMatrix:
    """Travel time in seconds between the representative road nodes of H3 cells."""

    def __init__(self, cells: list[str], cell_lat: np.ndarray, cell_lng: np.ndarray, seconds: np.ndarray, res: int) -> None:
        self.cells = cells
        self.index = {c: i for i, c in enumerate(cells)}
        self.cell_lat = cell_lat
        self.cell_lng = cell_lng
        self.seconds = seconds
        self.res = res

    @classmethod
    def build(cls, graph: RoadGraph, cells: list[str], cell_nodes: list[np.ndarray], res: int,
              cache_dir: Path | None = None) -> "TravelTimeMatrix":
        centers = np.array([h3.cell_to_latlng(c) for c in cells])
        reps = []
        for (lat, lng), nodes in zip(centers, cell_nodes):
            d = (graph.node_lat[nodes] - lat) ** 2 + (graph.node_lng[nodes] - lng) ** 2
            reps.append(int(nodes[int(np.argmin(d))]))
        key = hashlib.sha1(
            np.asarray(reps, dtype=np.int64).tobytes() + graph.freeflow_s.astype(np.float32).tobytes()
        ).hexdigest()[:16]
        path = cache_dir / f"ttm_{graph.source}_{key}.npy" if cache_dir else None
        if path is not None and path.exists():
            seconds = np.load(path)
        else:
            log.info("computing %dx%d hexagon travel-time matrix", len(reps), len(reps))
            seconds = graph.travel_matrix_s(reps, reps).astype(np.float32)
            seconds[~np.isfinite(seconds)] = 3600.0 * 3
            if path is not None:
                path.parent.mkdir(parents=True, exist_ok=True)
                np.save(path, seconds)
        return cls(cells, centers[:, 0], centers[:, 1], seconds, res)

    def cell_of(self, lat: float, lng: float) -> int:
        idx = self.index.get(h3.latlng_to_cell(lat, lng, self.res))
        if idx is not None:
            return idx
        d = (self.cell_lat - lat) ** 2 + (self.cell_lng - lng) ** 2
        return int(np.argmin(d))

    def eta_s(self, from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> float:
        return float(self.seconds[self.cell_of(from_lat, from_lng), self.cell_of(to_lat, to_lng)])
