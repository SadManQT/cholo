import numpy as np
import pytest

from dhaka_twin.geo import haversine_m
from dhaka_twin.roads import RoadGraph
from dhaka_twin.roads.osm import highway_class
from dhaka_twin.roads.skeleton import WAYPOINTS


def test_skeleton_keeps_every_waypoint_in_one_strongly_connected_graph(graph):
    for name, (lat, lng) in WAYPOINTS.items():
        node = graph.nearest_node(lat, lng)
        assert haversine_m(lat, lng, graph.node_lat[node], graph.node_lng[node]) < 1, name


def test_route_follows_edges_end_to_end(graph):
    a = graph.nearest_node(*WAYPOINTS["abdullahpur"])
    b = graph.nearest_node(*WAYPOINTS["sadarghat"])
    route = graph.route(a, b)
    assert route is not None and len(route) > 10
    assert graph.edge_src[route.edges[0]] == a
    assert graph.edge_dst[route.edges[-1]] == b
    assert np.all(graph.edge_dst[route.edges[:-1]] == graph.edge_src[route.edges[1:]])
    # Uttara to Sadarghat is roughly 20-25 km by road.
    assert 17_000 < route.length_m < 30_000
    assert graph.route(a, a).length_m == 0


def test_edge_position_interpolates_along_geometry(graph):
    e = 0
    start = graph.edge_position(e, 0.0)
    end = graph.edge_position(e, float(graph.edge_len_m[e]))
    mid = graph.edge_position(e, float(graph.edge_len_m[e]) / 2)
    assert start == pytest.approx((graph.node_lat[graph.edge_src[e]], graph.node_lng[graph.edge_src[e]]))
    assert end == pytest.approx((graph.node_lat[graph.edge_dst[e]], graph.node_lng[graph.edge_dst[e]]))
    assert haversine_m(*start, *mid) == pytest.approx(haversine_m(*mid, *end), rel=0.01)


def test_polyline_edges_interpolate_on_their_bends():
    # One edge from (0,0) to (0.01,0) that bends through (0.005, 0.005).
    g = RoadGraph(
        np.array([23.0, 23.01]), np.array([90.0, 90.0]), np.array([0]), np.array([1]), np.array([1570.0]),
        np.array([2]), geom_offsets=np.array([0, 3]), geom_lat=np.array([23.0, 23.005, 23.01]),
        geom_lng=np.array([90.0, 90.005, 90.0]),
    )
    lat, lng = g.edge_position(0, 785.0)
    assert lat == pytest.approx(23.005, abs=1e-4)
    assert lng == pytest.approx(90.005, abs=1e-4)


def test_largest_component_drops_islands_and_save_load_round_trips(tmp_path):
    g = RoadGraph(
        np.array([23.0, 23.001, 23.002, 23.5]), np.array([90.0, 90.0, 90.0, 90.5]),
        np.array([0, 1, 1, 2, 3]), np.array([1, 0, 2, 1, 3]), np.array([100.0, 100, 100, 100, 1]),
        np.array([5, 5, 5, 5, 5]),
    ).largest_component()
    assert g.n_nodes == 3 and g.n_edges == 4
    path = tmp_path / "g.npz"
    g.save(path)
    loaded = RoadGraph.load(path)
    assert loaded.n_nodes == 3
    assert np.allclose(loaded.edge_len_m, g.edge_len_m)
    assert loaded.route(0, 2).length_m == pytest.approx(200)


def test_highway_tags_map_to_road_classes():
    assert highway_class("motorway_link") == 0
    assert highway_class(["secondary", "primary"]) == 2
    assert highway_class("residential") == 5
    assert highway_class("unclassified") == 5


def test_osmnx_graphs_convert_with_geometry_and_classes():
    nx = pytest.importorskip("networkx")
    shapely_geometry = pytest.importorskip("shapely.geometry")
    from dhaka_twin.roads.osm import graph_from_networkx

    g = nx.MultiDiGraph()
    g.add_node(10, y=23.780, x=90.400)
    g.add_node(11, y=23.790, x=90.400)
    g.add_node(12, y=23.790, x=90.410)
    g.add_node(99, y=23.700, x=90.300)  # unreachable island
    curve = shapely_geometry.LineString([(90.400, 23.780), (90.402, 23.785), (90.400, 23.790)])
    g.add_edge(10, 11, length=1150.0, highway="primary", geometry=curve)
    g.add_edge(11, 10, length=1150.0, highway="primary")
    g.add_edge(11, 12, length=1020.0, highway=["residential", "tertiary"])
    g.add_edge(12, 11, length=1020.0, highway="residential")
    g.add_edge(99, 10, length=100.0, highway="service")

    graph = graph_from_networkx(g)
    assert graph.source == "osm"
    assert graph.n_nodes == 3 and graph.n_edges == 4
    curved = next(e for e in range(graph.n_edges) if graph.geom_offsets[e + 1] - graph.geom_offsets[e] == 3)
    assert graph.edge_class[curved] == 2
    lat, lng = graph.edge_position(curved, 575.0)
    assert lng > 90.4015  # follows the bend rather than the straight chord
    assert sorted(graph.edge_class.tolist()) == [2, 2, 4, 5]
    assert graph.route(graph.nearest_node(23.78, 90.40), graph.nearest_node(23.79, 90.41)).length_m == pytest.approx(2170)
