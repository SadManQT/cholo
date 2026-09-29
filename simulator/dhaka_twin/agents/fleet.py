"""Generate the driver population: vehicles, homes, shift patterns and temperament."""

from __future__ import annotations

import numpy as np

from ..demand.model import DemandModel
from ..demand.patterns import VEHICLE_KINDS
from .driver import Driver

VEHICLE_SHARE = (0.45, 0.15, 0.33, 0.07)  # bike, cng, car, premium

# (name, share, [(start_h, end_h), ...]); end may pass midnight (> 24).
SHIFT_PATTERNS = [
    ("full_day", 0.35, [(8.0, 13.5), (14.25, 20.0)]),
    ("morning", 0.20, [(6.5, 14.5)]),
    ("evening", 0.25, [(15.0, 23.5)]),
    ("night", 0.08, [(20.0, 28.0)]),
    ("peak_only", 0.12, [(7.0, 11.0), (16.5, 21.5)]),
]


def build_fleet(n: int, demand: DemandModel, rng: np.random.Generator, seed: int) -> list[Driver]:
    residential = demand.weights("residential")
    homes = rng.choice(len(demand.cells), size=n, p=residential)
    vehicles = rng.choice(len(VEHICLE_KINDS), size=n, p=VEHICLE_SHARE)
    shares = np.array([s for _, s, _ in SHIFT_PATTERNS])
    patterns = rng.choice(len(SHIFT_PATTERNS), size=n, p=shares / shares.sum())
    fleet = []
    for i in range(n):
        nodes = demand.cell_nodes[int(homes[i])]
        home = int(nodes[rng.integers(len(nodes))])
        jitter_h = rng.normal(0, 0.6)
        length_jitter = rng.normal(0, 0.4)
        windows = []
        for start_h, end_h in SHIFT_PATTERNS[int(patterns[i])][2]:
            s = (start_h + jitter_h) * 3600
            e = (end_h + jitter_h + length_jitter) * 3600
            windows.append((max(s, 0.0), max(e, s + 1800)))
        vehicle = VEHICLE_KINDS[int(vehicles[i])]
        # Few women drive in Dhaka; none on bikes in this model.
        gender = "female" if vehicle != "bike" and rng.random() < 0.06 else "male"
        fleet.append(
            Driver(
                driver_id=i + 1,
                vehicle=vehicle,
                gender=gender,
                home_node=home,
                shifts=windows,
                base_accept=float(rng.beta(8, 2)),
                reaction_s=float(rng.uniform(3, 8)),
                reposition_rate=float(rng.uniform(0.2, 1.0)),
                supply_u=float(rng.random()),
                seed=seed * 1_000_003 + i,
            )
        )
    return fleet
