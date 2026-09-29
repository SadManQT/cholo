"""Directed road graph with routing, snapping and position interpolation.

The graph is stored as flat numpy arrays so it loads quickly from a cached
``.npz`` file. Routing uses igraph's Dijkstra on free-flow travel time; the
engine scales traversal speed by a time-of-day congestion factor at run time.
"""

from __future__ import annotations

import math
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from ..geo import haversine_np

ROAD_CLASSES = ("motorway", "trunk", "primary", "secondary", "tertiary", "residential")

# Free-flow speeds in km/h. Dhaka's arterials rarely run faster than this even
# at night; congestion multipliers bring them down to walking pace at peak.
FREE_FLOW_KPH = np.array([60.0, 45.0, 36.0, 28.0, 22.0, 16.0], dtype=np.float32)


@dataclass(frozen=True)
class Route:
    """An ordered list of edge ids plus the cumulative length at each edge's end."""

    edges: np.ndarray
    cum_len: np.ndarray
    edge_list: list[int] | None = None

    def __post_init__(self) -> None:
        if self.edge_list is None:
            object.__setattr__(self, "edge_list", self.edges.tolist())

    @property
    def length_m(self) -> float:
        return float(self.cum_len[-1]) if len(self.cum_len) else 0.0

    def __len__(self) -> int:
        return len(self.edges)


EMPTY_ROUTE = Route(np.zeros(0, dtype=np.int32), np.zeros(0, dtype=np.float64))


class _GridIndex:
    """Uniform lat/lng bucket grid for nearest-node queries."""

    def __init__(self, lat: np.ndarray, lng: np.ndarray, cell_deg: float = 0.0025) -> None:
        self.lat = lat
        self.lng = lng
        self.cell = cell_deg
        self.lat0 = float(lat.min())
        self.lng0 = float(lng.min())
        self.cos = math.cos(math.radians(float(lat.mean())))
        ii = ((lat - self.lat0) / cell_deg).astype(np.int64)
        jj = ((lng - self.lng0) / cell_deg).astype(np.int64)
        self.width = int(jj.max()) + 1
        keys = ii * self.width + jj
        self.order = np.argsort(keys, kind="stable")
        sorted_keys = keys[self.order]
        uniq, starts = np.unique(sorted_keys, return_index=True)
        ends = np.append(starts[1:], len(sorted_keys))
        self.buckets = {int(k): (int(s), int(e)) for k, s, e in zip(uniq, starts, ends)}
        self.max_ring = int(max(ii.max(), jj.max())) + 1

    def _bucket(self, i: int, j: int) -> np.ndarray | None:
        if j < 0 or j >= self.width or i < 0:
            return None
        span = self.buckets.get(i * self.width + j)
        if span is None:
            return None
        return self.order[span[0]:span[1]]

    def nearest(self, lat: float, lng: float) -> int:
        ci = int((lat - self.lat0) / self.cell)
        cj = int((lng - self.lng0) / self.cell)
        best = -1
        best_d2 = math.inf
        for ring in range(self.max_ring + 1):
            # Anything outside this ring is at least (ring - 1) cells away.
            if best >= 0 and ((ring - 1) * self.cell) ** 2 > best_d2:
                break
            for i in range(ci - ring, ci + ring + 1):
                for j in range(cj - ring, cj + ring + 1):
                    if ring and abs(i - ci) != ring and abs(j - cj) != ring:
                        continue
                    ids = self._bucket(i, j)
                    if ids is None:
                        continue
                    dy = self.lat[ids] - lat
                    dx = (self.lng[ids] - lng) * self.cos
                    d2 = dy * dy + dx * dx
                    k = int(np.argmin(d2))
                    if d2[k] < best_d2:
                        best_d2 = float(d2[k])
                        best = int(ids[k])
        return best


class RoadGraph:
    def __init__(
        self,
        node_lat: np.ndarray,
        node_lng: np.ndarray,
        edge_src: np.ndarray,
        edge_dst: np.ndarray,
        edge_len_m: np.ndarray,
        edge_class: np.ndarray,
        edge_speed_kph: np.ndarray | None = None,
        geom_offsets: np.ndarray | None = None,
        geom_lat: np.ndarray | None = None,
        geom_lng: np.ndarray | None = None,
        source: str = "unknown",
        route_cache_size: int = 50_000,
    ) -> None:
        self.node_lat = np.asarray(node_lat, dtype=np.float64)
        self.node_lng = np.asarray(node_lng, dtype=np.float64)
        self.edge_src = np.asarray(edge_src, dtype=np.int32)
        self.edge_dst = np.asarray(edge_dst, dtype=np.int32)
        self.edge_len_m = np.maximum(np.asarray(edge_len_m, dtype=np.float64), 0.5)
        self.edge_class = np.asarray(edge_class, dtype=np.int8)
        if edge_speed_kph is None:
            edge_speed_kph = FREE_FLOW_KPH[self.edge_class]
        self.edge_speed_kph = np.asarray(edge_speed_kph, dtype=np.float32)
        self.source = source

        if geom_offsets is None:
            n = len(self.edge_src)
            geom_offsets = np.arange(0, 2 * n + 1, 2, dtype=np.int64)
            geom_lat = np.column_stack([self.node_lat[self.edge_src], self.node_lat[self.edge_dst]]).ravel()
            geom_lng = np.column_stack([self.node_lng[self.edge_src], self.node_lng[self.edge_dst]]).ravel()
        self.geom_offsets = np.asarray(geom_offsets, dtype=np.int64)
        self.geom_lat = np.asarray(geom_lat, dtype=np.float64)
        self.geom_lng = np.asarray(geom_lng, dtype=np.float64)
        self._geom_cum = self._polyline_cumulative()

        self.freeflow_s = self.edge_len_m / (self.edge_speed_kph.astype(np.float64) / 3.6)
        # Plain-Python copies for the per-tick hot path (numpy scalar indexing is slow).
        self.len_list: list[float] = self.edge_len_m.tolist()
        self.speed_ms_list: list[float] = (self.edge_speed_kph.astype(np.float64) / 3.6).tolist()
        self.dst_list: list[int] = self.edge_dst.tolist()
        self._straight: list[tuple[float, float, float, float] | None] = [None] * len(self.edge_src)
        counts = np.diff(self.geom_offsets)
        starts = self.geom_offsets[:-1]
        for e in np.nonzero(counts == 2)[0].tolist():
            i = int(starts[e])
            self._straight[e] = (float(self.geom_lat[i]), float(self.geom_lng[i]),
                                 float(self.geom_lat[i + 1]), float(self.geom_lng[i + 1]))
        self._ig = None
        self._route_cache: OrderedDict[tuple[int, int], Route] = OrderedDict()
        self._route_cache_size = route_cache_size
        self._index = _GridIndex(self.node_lat, self.node_lng)

    # ------------------------------------------------------------------ basics
    @property
    def n_nodes(self) -> int:
        return len(self.node_lat)

    @property
    def n_edges(self) -> int:
        return len(self.edge_src)

    def bounds(self) -> tuple[float, float, float, float]:
        return (
            float(self.node_lat.min()),
            float(self.node_lng.min()),
            float(self.node_lat.max()),
            float(self.node_lng.max()),
        )

    def _polyline_cumulative(self) -> np.ndarray:
        seg = np.zeros(len(self.geom_lat), dtype=np.float64)
        if len(self.geom_lat) > 1:
            seg[1:] = haversine_np(self.geom_lat[:-1], self.geom_lng[:-1], self.geom_lat[1:], self.geom_lng[1:])
        # Zero the first point of every edge so the running sum restarts per edge.
        seg[self.geom_offsets[:-1]] = 0.0
        cum = np.cumsum(seg)
        starts = self.geom_offsets[:-1]
        counts = np.diff(self.geom_offsets)
        cum -= np.repeat(cum[starts], counts)
        return cum

    # ------------------------------------------------------------------ routing
    def _igraph(self):
        if self._ig is None:
            import igraph as ig

            g = ig.Graph(n=self.n_nodes, edges=np.column_stack([self.edge_src, self.edge_dst]).tolist(), directed=True)
            g.es["w"] = self.freeflow_s.tolist()
            self._ig = g
        return self._ig

    def route(self, a: int, b: int) -> Route | None:
        """Fastest free-flow route between two nodes; ``None`` if unreachable."""
        if a == b:
            return EMPTY_ROUTE
        key = (a, b)
        cached = self._route_cache.get(key)
        if cached is not None:
            self._route_cache.move_to_end(key)
            return cached
        import warnings

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            path = self._igraph().get_shortest_path(a, to=b, weights="w", output="epath")
        if not path:
            return None
        edges = np.asarray(path, dtype=np.int32)
        result = Route(edges, np.cumsum(self.edge_len_m[edges]))
        self._route_cache[key] = result
        if len(self._route_cache) > self._route_cache_size:
            self._route_cache.popitem(last=False)
        return result

    def route_freeflow_s(self, route: Route) -> float:
        return float(self.freeflow_s[route.edges].sum()) if len(route) else 0.0

    def travel_matrix_s(self, sources: list[int], targets: list[int]) -> np.ndarray:
        """Free-flow travel time between node sets (seconds)."""
        d = self._igraph().distances(source=sources, target=targets, weights="w")
        return np.asarray(d, dtype=np.float64)

    # ------------------------------------------------------------------ geometry
    def nearest_node(self, lat: float, lng: float) -> int:
        return self._index.nearest(lat, lng)

    def edge_position(self, edge: int, offset_m: float) -> tuple[float, float]:
        """Point ``offset_m`` metres along an edge, following its geometry."""
        straight = self._straight[edge]
        if straight is not None:
            f = offset_m / self.len_list[edge]
            f = 0.0 if f < 0 else (1.0 if f > 1 else f)
            return straight[0] + (straight[2] - straight[0]) * f, straight[1] + (straight[3] - straight[1]) * f
        start = int(self.geom_offsets[edge])
        end = int(self.geom_offsets[edge + 1])
        cum = self._geom_cum[start:end]
        total = cum[-1]
        if total <= 0:
            return float(self.geom_lat[start]), float(self.geom_lng[start])
        d = min(max(offset_m / self.edge_len_m[edge], 0.0), 1.0) * total
        k = int(np.searchsorted(cum, d, side="right"))
        if k >= len(cum):
            return float(self.geom_lat[end - 1]), float(self.geom_lng[end - 1])
        k = max(k, 1)
        seg = cum[k] - cum[k - 1]
        f = 0.0 if seg <= 0 else (d - cum[k - 1]) / seg
        i = start + k
        lat = self.geom_lat[i - 1] + (self.geom_lat[i] - self.geom_lat[i - 1]) * f
        lng = self.geom_lng[i - 1] + (self.geom_lng[i] - self.geom_lng[i - 1]) * f
        return float(lat), float(lng)

    def edge_polyline(self, edge: int) -> list[tuple[float, float]]:
        s = int(self.geom_offsets[edge])
        e = int(self.geom_offsets[edge + 1])
        return list(zip(self.geom_lat[s:e].tolist(), self.geom_lng[s:e].tolist()))

    def route_polyline(self, route: Route) -> list[tuple[float, float]]:
        points: list[tuple[float, float]] = []
        for e in route.edges:
            pts = self.edge_polyline(int(e))
            points.extend(pts if not points else pts[1:])
        return points

    # ------------------------------------------------------------------ transforms
    def largest_component(self) -> "RoadGraph":
        """Restrict to the largest strongly connected component so every route exists."""
        import igraph as ig

        g = ig.Graph(n=self.n_nodes, edges=np.column_stack([self.edge_src, self.edge_dst]).tolist(), directed=True)
        giant = max(g.connected_components(mode="strong"), key=len)
        keep = np.zeros(self.n_nodes, dtype=bool)
        keep[giant] = True
        if keep.all():
            return self
        remap = -np.ones(self.n_nodes, dtype=np.int64)
        remap[keep] = np.arange(int(keep.sum()))
        emask = keep[self.edge_src] & keep[self.edge_dst]
        eids = np.nonzero(emask)[0]
        starts = self.geom_offsets[eids]
        ends = self.geom_offsets[eids + 1]
        counts = ends - starts
        idx = np.concatenate([np.arange(s, e) for s, e in zip(starts, ends)]) if len(eids) else np.zeros(0, dtype=np.int64)
        offsets = np.concatenate([[0], np.cumsum(counts)])
        return RoadGraph(
            self.node_lat[keep],
            self.node_lng[keep],
            remap[self.edge_src[eids]],
            remap[self.edge_dst[eids]],
            self.edge_len_m[eids],
            self.edge_class[eids],
            self.edge_speed_kph[eids],
            offsets,
            self.geom_lat[idx],
            self.geom_lng[idx],
            source=self.source,
        )

    # ------------------------------------------------------------------ persistence
    def save(self, path: str | Path) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(
            path,
            node_lat=self.node_lat,
            node_lng=self.node_lng,
            edge_src=self.edge_src,
            edge_dst=self.edge_dst,
            edge_len_m=self.edge_len_m,
            edge_class=self.edge_class,
            edge_speed_kph=self.edge_speed_kph,
            geom_offsets=self.geom_offsets,
            geom_lat=self.geom_lat,
            geom_lng=self.geom_lng,
            source=np.array(self.source),
        )

    @classmethod
    def load(cls, path: str | Path) -> "RoadGraph":
        with np.load(path, allow_pickle=False) as z:
            return cls(
                z["node_lat"],
                z["node_lng"],
                z["edge_src"],
                z["edge_dst"],
                z["edge_len_m"],
                z["edge_class"],
                z["edge_speed_kph"],
                z["geom_offsets"],
                z["geom_lat"],
                z["geom_lng"],
                source=str(z["source"]),
            )
