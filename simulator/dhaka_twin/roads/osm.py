"""Fetch Dhaka's drivable road network from OpenStreetMap with osmnx and cache it."""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np

from ..geo import DHAKA_BBOX
from .graph import RoadGraph
from .skeleton import build_skeleton_graph

log = logging.getLogger(__name__)

DEFAULT_CACHE = Path(__file__).resolve().parents[2] / "data" / "cache" / "dhaka_drive.npz"

_HIGHWAY_CLASS = {
    "motorway": 0,
    "motorway_link": 0,
    "trunk": 1,
    "trunk_link": 1,
    "primary": 2,
    "primary_link": 2,
    "secondary": 3,
    "secondary_link": 3,
    "tertiary": 4,
    "tertiary_link": 4,
}


def highway_class(value) -> int:
    """Map an OSM ``highway`` tag (string or list) to our road class index."""
    values = value if isinstance(value, (list, tuple)) else [value]
    classes = [_HIGHWAY_CLASS.get(str(v), 5) for v in values]
    return min(classes) if classes else 5


def fetch_osm_graph(bbox: tuple[float, float, float, float] = DHAKA_BBOX, place: str | None = None) -> RoadGraph:
    """Download the OSM drive network. Needs internet access to the Overpass API."""
    try:
        import osmnx as ox
    except ImportError as exc:  # pragma: no cover - exercised only without the extra
        raise RuntimeError("osmnx is not installed; run `pip install -e .[osm]`") from exc

    south, west, north, east = bbox
    if place:
        g = ox.graph_from_place(place, network_type="drive", simplify=True)
    elif int(ox.__version__.split(".")[0]) >= 2:
        g = ox.graph_from_bbox((west, south, east, north), network_type="drive", simplify=True)
    else:  # osmnx 1.x signature
        g = ox.graph_from_bbox(north, south, east, west, network_type="drive", simplify=True)
    return graph_from_networkx(g)


def graph_from_networkx(g) -> RoadGraph:
    """Convert an osmnx MultiDiGraph into a :class:`RoadGraph`."""
    node_ids = list(g.nodes)
    index = {n: i for i, n in enumerate(node_ids)}
    node_lat = np.array([g.nodes[n]["y"] for n in node_ids], dtype=np.float64)
    node_lng = np.array([g.nodes[n]["x"] for n in node_ids], dtype=np.float64)

    src, dst, length, cls = [], [], [], []
    offsets = [0]
    geom_lat: list[float] = []
    geom_lng: list[float] = []
    for u, v, data in g.edges(data=True):
        src.append(index[u])
        dst.append(index[v])
        length.append(float(data.get("length", 0.0)))
        cls.append(highway_class(data.get("highway", "residential")))
        geometry = data.get("geometry")
        if geometry is not None:
            xs, ys = geometry.xy
            geom_lng.extend(float(x) for x in xs)
            geom_lat.extend(float(y) for y in ys)
        else:
            geom_lat.extend([node_lat[index[u]], node_lat[index[v]]])
            geom_lng.extend([node_lng[index[u]], node_lng[index[v]]])
        offsets.append(len(geom_lat))

    graph = RoadGraph(
        node_lat,
        node_lng,
        np.array(src),
        np.array(dst),
        np.array(length),
        np.array(cls),
        geom_offsets=np.array(offsets),
        geom_lat=np.array(geom_lat),
        geom_lng=np.array(geom_lng),
        source="osm",
    )
    return graph.largest_component()


def load_graph(source: str = "auto", cache: str | Path | None = None) -> RoadGraph:
    """Load the road graph.

    ``auto`` uses the cached OSM graph when present and the built-in skeleton
    otherwise; ``osm`` fetches from OpenStreetMap when the cache is missing;
    ``skeleton`` always uses the offline corridor map. Any other value is
    treated as a path to a saved ``.npz`` graph.
    """
    cache_path = Path(cache) if cache else DEFAULT_CACHE
    if source == "skeleton":
        return build_skeleton_graph()
    if source in ("auto", "osm"):
        if cache_path.exists():
            log.info("loading cached road graph from %s", cache_path)
            return RoadGraph.load(cache_path)
        if source == "osm":
            log.info("fetching Dhaka drive network from OpenStreetMap (this takes a few minutes)")
            graph = fetch_osm_graph()
            graph.save(cache_path)
            return graph
        log.warning(
            "no cached OSM graph at %s; using the offline Dhaka corridor skeleton. "
            "Run `dhaka-twin fetch-graph` with internet access for the full road network.",
            cache_path,
        )
        return build_skeleton_graph()
    return RoadGraph.load(source)
