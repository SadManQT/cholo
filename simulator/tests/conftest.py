import asyncio

import pytest

from dhaka_twin.backends.local import LocalPlatform
from dhaka_twin.engine import World
from dhaka_twin.roads.skeleton import build_skeleton_graph
from dhaka_twin.scenario import PRESETS


@pytest.fixture(scope="session")
def graph():
    return build_skeleton_graph()


def run_world(graph, scenario, policy="cholo-v1", hours=0.5, recorder=None, drivers=None, demand_source=None):
    world = World(scenario, graph, LocalPlatform(policy), dt_s=2.0, recorder=recorder, drivers=drivers)
    if demand_source is not None:
        world.demand_source = demand_source
    metrics = asyncio.run(world.run(duration_s=hours * 3600))
    return world, metrics


@pytest.fixture
def small_weekday():
    return PRESETS["weekday"].with_overrides(drivers=200, daily_requests=2400, seed=7)
