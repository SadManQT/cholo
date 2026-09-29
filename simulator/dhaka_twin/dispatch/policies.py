"""Dispatch policies for the local platform.

``cholo-v1`` reproduces Cholo's production dispatcher (server/src/services/
dispatch.service.js): every eligible driver within the round's radius gets the
offer at once, the first to accept wins, and a job every 5 s widens the search.

``batched-eta`` is an alternative: every 5 s it matches waiting requests to
free drivers by road travel time, sending each request to one driver at a time.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np

from ..geo import haversine_np

if TYPE_CHECKING:
    from ..backends.local import LocalPlatform, LRequest

JOB_EVERY_S = 5.0
OFFER_TIMEOUT_S = 15.0


class DispatchPolicy:
    name = "base"

    def on_request(self, p: "LocalPlatform", req: "LRequest", now: float) -> None:
        pass

    def on_tick(self, p: "LocalPlatform", now: float) -> None:
        pass


class CholoV1(DispatchPolicy):
    """Broadcast to every eligible driver within 5 km, then 7.5 km, then 10 km."""

    name = "cholo-v1"
    radius_km = 5.0
    step_km = 2.5
    max_radius_km = 10.0

    def __init__(self) -> None:
        self._next_job_s = JOB_EVERY_S

    def radius_for_round(self, round_: int) -> float:
        return min(self.radius_km + self.step_km * (round_ - 1), self.max_radius_km)

    def on_request(self, p, req, now):
        self.fan_out(p, req, 1, now)

    def fan_out(self, p, req, round_, now) -> int:
        ids, lat, lng = p.eligible_drivers(req)
        if not ids:
            return 0
        d_km = haversine_np(lat, lng, req.trip.o_lat, req.trip.o_lng) / 1000
        within = d_km <= self.radius_for_round(round_)
        order = np.argsort(d_km[within], kind="stable")
        chosen = np.asarray(ids)[within][order]
        dists = d_km[within][order]
        for driver_id, dist in zip(chosen.tolist(), dists.tolist()):
            p.make_offer(req, driver_id, dist, round_, now)
        if len(chosen):
            req.max_round = round_
            req.last_offer_s = now
        return len(chosen)

    def on_tick(self, p, now):
        if now < self._next_job_s:
            return
        self._next_job_s = now + JOB_EVERY_S
        p.timeout_offers(now, OFFER_TIMEOUT_S)
        for req in p.searching():
            if req.pending:
                continue
            last = req.last_offer_s if req.last_offer_s is not None else req.requested_s
            if now - last >= OFFER_TIMEOUT_S:
                self.fan_out(p, req, req.max_round + 1, now)


class BatchedEta(DispatchPolicy):
    """Every 5 s, greedily pair waiting requests and free drivers by road ETA.

    Each request is offered to exactly one driver at a time, so drivers never
    race each other for the same passenger.
    """

    name = "batched-eta"
    search_km = 8.0
    max_eta_s = 20 * 60.0

    def __init__(self) -> None:
        self._next_job_s = JOB_EVERY_S

    def on_tick(self, p, now):
        if now < self._next_job_s:
            return
        self._next_job_s = now + JOB_EVERY_S
        p.timeout_offers(now, OFFER_TIMEOUT_S)
        waiting = [r for r in p.searching() if not r.pending]
        if not waiting:
            return
        speed = max(p.world.cond.speed_factor, 0.15)
        matrix = p.matrix
        pairs: list[tuple[float, int, int, float]] = []
        for qi, req in enumerate(waiting):
            ids, lat, lng = p.eligible_drivers(req, free_only=True)
            if not ids:
                continue
            d_km = haversine_np(lat, lng, req.trip.o_lat, req.trip.o_lng) / 1000
            pickup_cell = matrix.cell_of(req.trip.o_lat, req.trip.o_lng)
            for driver_id, la, ln, dk in zip(ids, lat.tolist(), lng.tolist(), d_km.tolist()):
                if dk > self.search_km:
                    continue
                eta = matrix.seconds[matrix.cell_of(la, ln), pickup_cell] / speed + 60.0
                if eta <= self.max_eta_s:
                    pairs.append((eta, qi, driver_id, dk))
        pairs.sort()
        used_req: set[int] = set()
        used_driver: set[int] = set()
        for _eta, qi, driver_id, dk in pairs:
            if qi in used_req or driver_id in used_driver:
                continue
            used_req.add(qi)
            used_driver.add(driver_id)
            req = waiting[qi]
            p.make_offer(req, driver_id, dk, req.max_round + 1, now)
            req.max_round += 1
            req.last_offer_s = now


POLICIES = {cls.name: cls for cls in (CholoV1, BatchedEta)}


def make_policy(name: str) -> DispatchPolicy:
    try:
        return POLICIES[name]()
    except KeyError:
        raise ValueError(f"unknown dispatch policy {name!r}; choose from {', '.join(POLICIES)}") from None
