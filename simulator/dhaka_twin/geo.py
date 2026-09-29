"""Small geodesy helpers shared by the road graph, demand model and agents."""

from __future__ import annotations

import math
from datetime import timedelta, timezone

import numpy as np

EARTH_RADIUS_M = 6_371_008.8

# Asia/Dhaka is UTC+6 all year (no daylight saving).
DHAKA_TZ = timezone(timedelta(hours=6), name="Asia/Dhaka")

# south, west, north, east — Uttara/Abdullahpur down to Jatrabari/Sadarghat,
# Gabtoli across to Badda/Bashundhara.
DHAKA_BBOX = (23.685, 90.330, 23.885, 90.475)
DHAKA_CENTER = (23.7806, 90.4000)


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(a)))


def haversine_np(lat1, lng1, lat2, lng2) -> np.ndarray:
    lat1 = np.radians(np.asarray(lat1, dtype=np.float64))
    lat2 = np.radians(np.asarray(lat2, dtype=np.float64))
    dl = np.radians(np.asarray(lng2, dtype=np.float64) - np.asarray(lng1, dtype=np.float64))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * np.arcsin(np.minimum(1.0, np.sqrt(a)))


def offset_m(lat: float, lng: float, north_m: float, east_m: float) -> tuple[float, float]:
    """Move a point by a local north/east offset in metres."""
    dlat = north_m / EARTH_RADIUS_M
    dlng = east_m / (EARTH_RADIUS_M * math.cos(math.radians(lat)))
    return lat + math.degrees(dlat), lng + math.degrees(dlng)


def in_bbox(lat: float, lng: float, bbox: tuple[float, float, float, float] = DHAKA_BBOX) -> bool:
    south, west, north, east = bbox
    return south <= lat <= north and west <= lng <= east
