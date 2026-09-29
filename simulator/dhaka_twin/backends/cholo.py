"""Drive a running Cholo server: every simulated rider and driver is a real API client.

Each agent logs in with a seeded account (see :mod:`dhaka_twin.accounts`), opens
its own Socket.io connection with ``auth.token``, and turns simulator commands
into the same HTTP calls the web app makes:

======================  ==============================================
command                 Cholo API
======================  ==============================================
RequestRide             POST   /ride-requests
CancelRequest           DELETE /ride-requests/:publicId
GoOnline / GoOffline    PUT    /driver/availability
PingLocation            socket ``location:update``
RespondOffer            POST   /driver/offers/:id/respond (+ GET /trips/:code)
Arrived                 POST   /trips/:code/arrived
StartTrip               POST   /trips/:code/start
ConfirmPickup           POST   /trips/:code/pickup/confirm
CompleteTrip            POST   /trips/:code/complete
CancelTrip              POST   /trips/:code/cancel
RateTrip                POST   /trips/:code/rating
======================  ==============================================

Offers (``offer:new``) and trip transitions (``trip:status``) arrive over each
agent's socket. Request expiry is silent on the server, so waiting riders poll
``GET /ride-requests/:publicId`` every 30 s, as the web app does.
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from collections import Counter, defaultdict, deque
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

import aiohttp
import numpy as np

from ..accounts import CATEGORY_KINDS, driver_phone, rider_phone
from ..messages import (
    Arrived,
    CancelRequest,
    CancelTrip,
    CommandFailed,
    CompleteTrip,
    ConfirmPickup,
    DriverStatus,
    GoOffline,
    GoOnline,
    OfferAnswered,
    OfferMade,
    PingLocation,
    RateTrip,
    RequestEnded,
    RequestPlaced,
    RequestRide,
    RespondOffer,
    StartTrip,
    TripUpdate,
)

if TYPE_CHECKING:
    from ..engine import World

log = logging.getLogger(__name__)

API_PREFIX = "/api/v1"
POLL_EVERY_S = 30.0
RELEASE_AFTER_S = 20.0
_ID_PATTERNS = [
    (re.compile(r"JT-\d{4}-\d{6}"), ":code"),
    (re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"), ":id"),
    (re.compile(r"/\d+(?=/|$)"), "/:n"),
]


def seeded_vehicle(i: int) -> str:
    """Vehicle kind of seeded driver ``i`` (mirrors ``accounts.VEHICLE_CASE``)."""
    bucket = (i * 37) % 100
    if bucket < 45:
        return "bike"
    if bucket < 60:
        return "cng"
    if bucket < 93:
        return "car"
    return "premium"


def seeded_gender(i: int) -> str:
    return "female" if seeded_vehicle(i) != "bike" and i % 17 == 0 else "male"


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str = "") -> None:
        super().__init__(f"{status} {code} {message}".strip())
        self.status = status
        self.code = code


@dataclass
class Account:
    phone: str
    role: str
    agent_id: int | None = None
    token: str | None = None
    sio: object | None = None
    trip_code: str | None = None
    last_trip_code: str | None = None
    request_id: str | None = None
    online: bool = False
    active: bool = False
    ended: bool = False
    next_poll_s: float = 0.0
    polling: bool = False
    extra: dict = field(default_factory=dict)


class CholoBackend:
    name = "cholo"
    realtime = True

    def __init__(self, api_url: str = "http://127.0.0.1:3000", password: str = "DhakaTwin#2026", *,
                 city_id: int = 1, max_concurrency: int = 200, rider_accounts: int = 3000) -> None:
        self.base = api_url.rstrip("/")
        self.password = password
        self.city_id = city_id
        self.max_concurrency = max_concurrency
        self.rider_accounts = rider_accounts
        self.world: "World | None" = None
        self.session: aiohttp.ClientSession | None = None
        self.ws_session: aiohttp.ClientSession | None = None
        self.categories: dict[str, int] = {}
        self.drivers: dict[int, Account] = {}
        self.riders: dict[int, Account] = {}
        self.free_riders: deque[int] = deque()
        self.rider_slot: dict[int, int] = {}
        self.trip_driver: dict[str, int] = {}
        self._inbox: list = []
        self._locks: dict[tuple[str, int], asyncio.Lock] = {}
        self._tasks: set[asyncio.Task] = set()
        self.http = Counter()
        self.latency_ms: dict[str, list[float]] = defaultdict(list)
        self.errors = Counter()
        self.socket = Counter()
        self._closing = False

    # ---------------------------------------------------------------- lifecycle
    async def start(self, world: "World") -> None:
        self.world = world
        self.session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(limit=self.max_concurrency),
            timeout=aiohttp.ClientTimeout(total=30),
        )
        # Each Socket.io connection holds its TCP connection for its whole life, so
        # sockets get their own unbounded pool instead of starving HTTP calls.
        self.ws_session = aiohttp.ClientSession(connector=aiohttp.TCPConnector(limit=0))
        try:
            async with self.session.get(f"{self.base}/health") as r:
                if r.status != 200:
                    raise RuntimeError(f"Cholo API at {self.base} is not healthy (HTTP {r.status})")
        except aiohttp.ClientError as exc:
            await self.session.close()
            await self.ws_session.close()
            raise RuntimeError(f"cannot reach the Cholo API at {self.base}: {exc}") from exc
        cats = await self._call("GET", "/vehicle-categories")
        self.categories = {CATEGORY_KINDS[c["name"]]: int(c["id"]) for c in cats if c["name"] in CATEGORY_KINDS}
        cities = await self._call("GET", "/cities")
        dhaka = next((c for c in cities if c["name"] == "Dhaka"), None)
        if dhaka is not None:
            self.city_id = int(dhaka["id"])
        for d in world.drivers:
            # Match the simulated fleet to the seeded accounts' vehicles.
            d.vehicle = seeded_vehicle(d.id)
            d.gender = seeded_gender(d.id)
            self.drivers[d.id] = Account(driver_phone(d.id), "driver", agent_id=d.id)
        self.free_riders.extend(range(1, self.rider_accounts + 1))
        await self._reset_drivers()
        log.info("cholo backend ready: %s, city %s, categories %s", self.base, self.city_id, self.categories)

    async def _reset_drivers(self) -> None:
        """Start from a clean slate: close leftover trips and set every simulator driver offline.

        Otherwise drivers left online by an earlier run keep receiving offers they never answer.
        This also logs every driver in up front, so going online later is a single call.
        """
        started = time.monotonic()
        gate = asyncio.Semaphore(self.max_concurrency)

        async def reset(acct: Account) -> None:
            async with gate:
                try:
                    await self._clean_driver(acct)
                    await self._call("PUT", "/driver/availability", acct, {"status": "offline"})
                except ApiError as exc:
                    self.errors[f"reset_{exc.code}"] += 1

        await asyncio.gather(*(reset(a) for a in self.drivers.values()))
        log.info("reset %d simulator drivers in %.1fs", len(self.drivers), time.monotonic() - started)

    async def close(self) -> None:
        self._closing = True
        pending = [t for t in self._tasks if not t.done()]
        if pending:
            await asyncio.wait(pending, timeout=15)
        cleanup = []
        for acct in self.drivers.values():
            if acct.token and (acct.online or acct.trip_code):
                cleanup.append(self._quiet(self._sign_off(acct)))
        for acct in self.riders.values():
            if acct.token and acct.request_id and not acct.trip_code and not acct.ended:
                cleanup.append(self._quiet(self._call("DELETE", f"/ride-requests/{acct.request_id}", acct)))
        if cleanup:
            await asyncio.wait([asyncio.ensure_future(c) for c in cleanup], timeout=30)
        sockets = [a.sio for a in list(self.drivers.values()) + list(self.riders.values()) if a.sio is not None]
        if sockets:
            await asyncio.wait([asyncio.ensure_future(s.disconnect()) for s in sockets], timeout=15)
        if self.session is not None:
            await self.session.close()
            await self.ws_session.close()

    async def _sign_off(self, acct: Account) -> None:
        """Close the driver's open trip (so the next run starts clean) and go offline."""
        if acct.trip_code:
            await self._clean_driver(acct)
        await self._call("PUT", "/driver/availability", acct, {"status": "offline"})

    @staticmethod
    async def _quiet(coro) -> None:
        try:
            await coro
        except Exception:  # noqa: BLE001 - best-effort cleanup
            pass

    def drain(self) -> list:
        out, self._inbox = self._inbox, []
        return out

    def _emit(self, event) -> None:
        if not self._closing:
            self._inbox.append(event)

    def stats(self) -> dict:
        latency = {}
        for route, values in sorted(self.latency_ms.items()):
            a = np.asarray(values)
            latency[route] = {"n": int(a.size), "p50_ms": round(float(np.percentile(a, 50)), 1),
                              "p95_ms": round(float(np.percentile(a, 95)), 1), "max_ms": round(float(a.max()), 1)}
        return {
            "backend": self.name,
            "api": self.base,
            "policy": "cholo server dispatch",
            "http": dict(self.http),
            "latency": latency,
            "errors": dict(self.errors),
            "socket": dict(self.socket),
        }

    # ---------------------------------------------------------------- HTTP
    @staticmethod
    def _route_key(method: str, path: str) -> str:
        for pattern, repl in _ID_PATTERNS:
            path = pattern.sub(repl, path)
        return f"{method} {path}"

    async def _call(self, method: str, path: str, acct: Account | None = None, body: dict | None = None,
                    retry_auth: bool = True):
        headers = {"Accept": "application/json"}
        if acct is not None:
            if acct.token is None:
                await self._login(acct)
            headers["Authorization"] = f"Bearer {acct.token}"
        key = self._route_key(method, path)
        started = time.perf_counter()
        try:
            async with self.session.request(method, f"{self.base}{API_PREFIX}{path}", json=body, headers=headers) as r:
                status = r.status
                payload = await r.json(content_type=None) if status != 204 else None
        except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
            self.http[f"{key} network_error"] += 1
            self.errors["NETWORK"] += 1
            raise ApiError(0, "NETWORK", str(exc)) from exc
        self.latency_ms[key].append((time.perf_counter() - started) * 1000)
        self.http[f"{key} {status}"] += 1
        if status >= 400:
            err = (payload or {}).get("error", {}) if isinstance(payload, dict) else {}
            code = err.get("code", f"HTTP_{status}")
            if status == 401 and acct is not None and retry_auth:
                acct.token = None
                return await self._call(method, path, acct, body, retry_auth=False)
            self.errors[code] += 1
            raise ApiError(status, code, err.get("message", ""))
        return payload.get("data") if isinstance(payload, dict) else payload

    async def _login(self, acct: Account) -> None:
        data = await self._call("POST", "/auth/login", None, {"phone": acct.phone, "password": self.password})
        if not data or "accessToken" not in data:
            raise ApiError(401, "LOGIN_FAILED", "two-factor or unexpected login response")
        acct.token = data["accessToken"]

    # ---------------------------------------------------------------- sockets
    async def _connect(self, acct: Account) -> None:
        import socketio

        if acct.sio is not None and acct.sio.connected:
            return
        sio = socketio.AsyncClient(reconnection=False, http_session=self.ws_session)
        acct.sio = sio
        agent_id = acct.agent_id

        if acct.role == "driver":
            @sio.on("offer:new")
            async def on_offer(data):
                self.socket["offer:new"] += 1
                self._emit(OfferMade(agent_id, str(data["offerId"]), data["requestPublicId"], float(data.get("distanceKm") or 0)))

        @sio.on("trip:status")
        async def on_status(data):
            self.socket["trip:status"] += 1
            self._on_trip_status(acct, data)

        @sio.on("disconnect")
        async def on_disconnect(*_args):
            self.socket["disconnect"] += 1
            if not self._closing and acct.active:
                # Usually an expired access token: log in again and reconnect.
                self._spawn(("reconnect", id(acct)), lambda: self._reconnect(acct))

        if acct.token is None:
            await self._login(acct)
        await sio.connect(self.base, auth=lambda: {"token": acct.token}, transports=["websocket"], wait_timeout=10)
        self.socket["connect"] += 1

    async def _reconnect(self, acct: Account) -> None:
        await asyncio.sleep(1.0)
        if self._closing or not acct.active:
            return
        acct.token = None
        try:
            await self._login(acct)
            if acct.sio is not None:
                await acct.sio.connect(self.base, auth=lambda: {"token": acct.token}, transports=["websocket"],
                                       wait_timeout=10)
                self.socket["reconnect"] += 1
        except Exception as exc:  # noqa: BLE001
            self.socket["reconnect_failed"] += 1
            log.debug("reconnect failed for %s: %s", acct.phone, exc)

    async def _disconnect(self, acct: Account) -> None:
        acct.active = False
        if acct.sio is not None and acct.sio.connected:
            await acct.sio.disconnect()

    def _on_trip_status(self, acct: Account, data: dict) -> None:
        status = data.get("status")
        code = data.get("tripCode") or acct.trip_code
        if code is None or status is None:
            return
        if status == "assigned" and acct.role == "rider":
            acct.trip_code = code
            acct.last_trip_code = code
        info: dict = {}
        fare = data.get("fare")
        if isinstance(fare, dict) and fare.get("total") is not None:
            info["fare"] = float(fare["total"])
        if status == "cancelled":
            info["cancelled_by"] = "rider" if data.get("cancelledBy") == "passenger" else "driver"
        if acct.role == "rider":
            info["driver_id"] = self.trip_driver.get(code)
            self._emit(TripUpdate(acct.agent_id, "rider", code, status, info))
            if status in ("completed", "cancelled"):
                self._schedule_release(acct.agent_id)
        else:
            self._emit(TripUpdate(acct.agent_id, "driver", code, status, info))
            if status in ("completed", "cancelled"):
                acct.trip_code = None

    # ---------------------------------------------------------------- task plumbing
    def _spawn(self, key, factory) -> None:
        lock = self._locks.setdefault(key, asyncio.Lock())

        async def runner():
            async with lock:
                try:
                    await factory()
                except ApiError:
                    pass
                except Exception:  # noqa: BLE001 - keep the simulation running
                    self.errors["UNHANDLED"] += 1
                    log.exception("simulator command failed")

        task = asyncio.get_running_loop().create_task(runner())
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    def submit(self, cmd) -> None:
        if isinstance(cmd, PingLocation):
            acct = self.drivers.get(cmd.driver_id)
            if acct is not None and acct.sio is not None and acct.sio.connected:
                payload = {"lat": round(cmd.lat, 6), "lng": round(cmd.lng, 6), "speedKmh": round(min(cmd.speed_kmh, 200), 1)}
                if cmd.heading is not None:
                    payload["heading"] = round(cmd.heading % 360, 1)
                task = asyncio.get_running_loop().create_task(self._emit_ping(acct, payload))
                self._tasks.add(task)
                task.add_done_callback(self._tasks.discard)
            return
        role, agent_id = self._owner(cmd)
        handler = getattr(self, f"_do_{type(cmd).__name__}")
        self._spawn((role, agent_id), lambda: handler(cmd))

    async def _emit_ping(self, acct: Account, payload: dict) -> None:
        try:
            await acct.sio.emit("location:update", payload)
            self.socket["location:update sent"] += 1
        except Exception:  # noqa: BLE001
            self.socket["location:update failed"] += 1

    @staticmethod
    def _owner(cmd) -> tuple[str, int]:
        if isinstance(cmd, (RequestRide, CancelRequest, ConfirmPickup)):
            return "rider", cmd.rider_id
        if isinstance(cmd, (CancelTrip, RateTrip)):
            return cmd.role, cmd.agent_id
        return "driver", cmd.driver_id

    def step(self, now_s: float) -> None:
        for rider_id, acct in list(self.riders.items()):
            if acct.request_id and not acct.trip_code and not acct.ended and not acct.polling and now_s >= acct.next_poll_s:
                acct.next_poll_s = now_s + POLL_EVERY_S
                acct.polling = True
                self._spawn(("poll", rider_id), lambda rid=rider_id, a=acct: self._poll_request(rid, a))

    # ---------------------------------------------------------------- riders
    def _fail(self, agent_id: int, role: str, command: str, error: str) -> None:
        self._emit(CommandFailed(agent_id, role, command, error))

    def _schedule_release(self, rider_id: int) -> None:
        acct = self.riders.get(rider_id)
        if acct is None or acct.ended:
            return
        acct.ended = True

        async def release():
            await asyncio.sleep(RELEASE_AFTER_S)
            await self._disconnect(acct)
            slot = self.rider_slot.pop(rider_id, None)
            self.riders.pop(rider_id, None)
            for key in (("rider", rider_id), ("poll", rider_id)):
                lock = self._locks.get(key)
                if lock is not None and not lock.locked():
                    del self._locks[key]
            if slot is not None:
                self.free_riders.append(slot)

        task = asyncio.get_running_loop().create_task(release())
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _do_RequestRide(self, cmd: RequestRide) -> None:
        # An account can stay blocked by a ride still in progress from an earlier run
        # (only its driver can finish it); set such accounts aside and use another.
        for _attempt in range(3):
            if not self.free_riders:
                self._fail(cmd.rider_id, "rider", "RequestRide", "NO_FREE_RIDER_ACCOUNT")
                return
            outcome = await self._request_with_slot(cmd, self.free_riders.popleft())
            if outcome != "blocked":
                return
        self._fail(cmd.rider_id, "rider", "RequestRide", "ACTIVE_REQUEST_EXISTS")

    async def _request_with_slot(self, cmd: RequestRide, slot: int) -> str:
        acct = Account(rider_phone(slot), "rider", agent_id=cmd.rider_id, active=True)
        self.riders[cmd.rider_id] = acct
        self.rider_slot[cmd.rider_id] = slot
        t = cmd.trip
        body = {
            "cityId": self.city_id,
            "categoryId": self.categories[t.vehicle],
            "pickup": {"lat": round(t.o_lat, 6), "lng": round(t.o_lng, 6), "address": t.pickup_label[:255]},
            "dropoff": {"lat": round(t.d_lat, 6), "lng": round(t.d_lng, 6), "address": t.dropoff_label[:255]},
            "paymentIntent": t.payment,
            "womenOnly": t.women_only,
        }
        try:
            await self._connect(acct)
            try:
                data = await self._call("POST", "/ride-requests", acct, body)
            except ApiError as e:
                if e.code not in ("ACTIVE_REQUEST_EXISTS", "UNPAID_TRIP", "OUTSTANDING_BALANCE"):
                    raise
                # Left over from an interrupted run: clear it and try once more.
                await self._clean_rider(acct)
                data = await self._call("POST", "/ride-requests", acct, body)
        except (ApiError, Exception) as e:  # noqa: BLE001
            code = e.code if isinstance(e, ApiError) else type(e).__name__
            acct.ended = True
            self.riders.pop(cmd.rider_id, None)
            self.rider_slot.pop(cmd.rider_id, None)
            await self._disconnect(acct)
            self.free_riders.append(slot)
            if code in ("ACTIVE_REQUEST_EXISTS", "UNPAID_TRIP", "OUTSTANDING_BALANCE"):
                self.errors["rider_account_set_aside"] += 1
                return "blocked"
            self._fail(cmd.rider_id, "rider", "RequestRide", code)
            return "failed"
        acct.request_id = data["publicId"]
        acct.next_poll_s = self.world.now_s + POLL_EVERY_S if self.world else 0.0
        quote = data.get("quote") or {}
        self._emit(RequestPlaced(cmd.rider_id, acct.request_id, float(quote.get("estFare") or 0)))
        return "placed"

    async def _clean_rider(self, acct: Account) -> None:
        for req in await self._call("GET", "/ride-requests", acct) or []:
            await self._quiet(self._call("DELETE", f"/ride-requests/{req['publicId']}", acct))
        for trip in await self._call("GET", "/trips?status=active&role=passenger", acct) or []:
            if trip.get("publicCode") and trip.get("status") in ("assigned", "arrived"):
                await self._quiet(self._call("POST", f"/trips/{trip['publicCode']}/cancel", acct, {"reasonCode": "other"}))

    async def _poll_request(self, rider_id: int, acct: Account) -> None:
        try:
            if acct.ended or acct.request_id is None or acct.trip_code:
                return
            data = await self._call("GET", f"/ride-requests/{acct.request_id}", acct)
            status = data.get("status")
            if status == "expired":
                self._emit(RequestEnded(rider_id, "expired"))
                self._schedule_release(rider_id)
            elif status == "matched" and data.get("tripCode") and not acct.trip_code:
                self.socket["trip:status recovered by poll"] += 1
                self._on_trip_status(acct, {"status": "assigned", "tripCode": data["tripCode"]})
        finally:
            acct.polling = False

    async def _do_CancelRequest(self, cmd: CancelRequest) -> None:
        acct = self.riders.get(cmd.rider_id)
        if acct is None or acct.request_id is None:
            self._fail(cmd.rider_id, "rider", "CancelRequest", "NOT_FOUND")
            return
        try:
            await self._call("DELETE", f"/ride-requests/{acct.request_id}", acct)
        except ApiError as e:
            self._fail(cmd.rider_id, "rider", "CancelRequest", e.code)
            return
        self._emit(RequestEnded(cmd.rider_id, "cancelled"))
        self._schedule_release(cmd.rider_id)

    async def _rider_trip_code(self, acct: Account) -> str | None:
        if acct.trip_code is None and acct.request_id:
            data = await self._call("GET", f"/ride-requests/{acct.request_id}", acct)
            acct.trip_code = data.get("tripCode")
        return acct.trip_code

    async def _do_ConfirmPickup(self, cmd: ConfirmPickup) -> None:
        acct = self.riders.get(cmd.rider_id)
        code = await self._rider_trip_code(acct) if acct else None
        if code is None:
            self._fail(cmd.rider_id, "rider", "ConfirmPickup", "TRIP_NOT_FOUND")
            return
        try:
            await self._call("POST", f"/trips/{code}/pickup/confirm", acct)
        except ApiError as e:
            self._fail(cmd.rider_id, "rider", "ConfirmPickup", e.code)

    async def _do_CancelTrip(self, cmd: CancelTrip) -> None:
        acct = self.riders.get(cmd.agent_id) if cmd.role == "rider" else self.drivers.get(cmd.agent_id)
        code = None
        if acct is not None:
            code = await self._rider_trip_code(acct) if cmd.role == "rider" else acct.trip_code
        if code is None:
            self._fail(cmd.agent_id, cmd.role, "CancelTrip", "TRIP_NOT_FOUND")
            return
        reason = cmd.reason if cmd.reason in ("changed_mind", "driver_late", "no_show", "wrong_pickup", "vehicle_issue") else "other"
        try:
            await self._call("POST", f"/trips/{code}/cancel", acct, {"reasonCode": reason})
        except ApiError as e:
            self._fail(cmd.agent_id, cmd.role, "CancelTrip", e.code)

    async def _do_RateTrip(self, cmd: RateTrip) -> None:
        acct = self.riders.get(cmd.agent_id) if cmd.role == "rider" else self.drivers.get(cmd.agent_id)
        code = acct.last_trip_code if acct else None
        if code:
            await self._quiet(self._call("POST", f"/trips/{code}/rating", acct, {"score": int(cmd.score)}))

    # ---------------------------------------------------------------- drivers
    async def _do_GoOnline(self, cmd: GoOnline) -> None:
        acct = self.drivers[cmd.driver_id]
        acct.active = True
        body = {"status": "online", "currentLat": round(cmd.lat, 6), "currentLng": round(cmd.lng, 6)}
        try:
            await self._connect(acct)
            try:
                await self._call("PUT", "/driver/availability", acct, body)
            except ApiError as e:
                if e.code != "ON_TRIP":
                    raise
                await self._clean_driver(acct)
                await self._call("PUT", "/driver/availability", acct, body)
        except (ApiError, Exception) as e:  # noqa: BLE001
            code = e.code if isinstance(e, ApiError) else type(e).__name__
            acct.active = False
            await self._disconnect(acct)
            self._emit(DriverStatus(cmd.driver_id, False, code))
            return
        acct.online = True
        self._emit(DriverStatus(cmd.driver_id, True))

    async def _clean_driver(self, acct: Account) -> None:
        """Close trips left open by an interrupted run so the driver can go online again."""
        for trip in await self._call("GET", "/trips?status=active&role=driver", acct) or []:
            code = trip.get("publicCode")
            if not code:
                continue
            if trip.get("status") in ("assigned", "arrived"):
                await self._quiet(self._call("POST", f"/trips/{code}/cancel", acct, {"reasonCode": "other"}))
            elif trip.get("status") == "in_progress":
                detail = await self._call("GET", f"/trips/{code}", acct)
                d = (detail or {}).get("dropoff") or {}
                await self._quiet(self._call("POST", f"/trips/{code}/complete", acct,
                                             {"lat": float(d["lat"]), "lng": float(d["lng"])}))

    async def _do_GoOffline(self, cmd: GoOffline) -> None:
        acct = self.drivers[cmd.driver_id]
        try:
            await self._call("PUT", "/driver/availability", acct, {"status": "offline"})
        except ApiError as e:
            self._fail(cmd.driver_id, "driver", "GoOffline", e.code)
            return
        acct.online = False
        await self._disconnect(acct)
        self._emit(DriverStatus(cmd.driver_id, False))

    async def _do_RespondOffer(self, cmd: RespondOffer) -> None:
        acct = self.drivers[cmd.driver_id]
        response = "accepted" if cmd.accept else "rejected"
        try:
            data = await self._call("POST", f"/driver/offers/{cmd.offer_id}/respond", acct, {"response": response})
        except ApiError as e:
            if cmd.accept:
                self._emit(OfferAnswered(cmd.driver_id, cmd.offer_id, False, error=e.code))
            return
        if not cmd.accept:
            return
        trip = (data or {}).get("trip") or {}
        code = trip.get("publicCode")
        pickup = trip.get("pickup") or {}
        if not code:
            self._emit(OfferAnswered(cmd.driver_id, cmd.offer_id, False, error="NO_TRIP_IN_RESPONSE"))
            return
        acct.trip_code = code
        acct.last_trip_code = code
        self.trip_driver[code] = cmd.driver_id
        dropoff = None
        try:
            detail = await self._call("GET", f"/trips/{code}", acct)
            d = (detail or {}).get("dropoff") or {}
            if d.get("lat") is not None:
                dropoff = (float(d["lat"]), float(d["lng"]))
        except ApiError:
            pass
        self._emit(OfferAnswered(cmd.driver_id, cmd.offer_id, True, code, (float(pickup["lat"]), float(pickup["lng"])),
                                 dropoff))

    async def _driver_call(self, cmd, command: str, path_suffix: str, body: dict | None = None):
        acct = self.drivers[cmd.driver_id]
        if acct.trip_code is None:
            self._fail(cmd.driver_id, "driver", command, "TRIP_NOT_FOUND")
            return None
        try:
            return await self._call("POST", f"/trips/{acct.trip_code}/{path_suffix}", acct, body)
        except ApiError as e:
            self._fail(cmd.driver_id, "driver", command, e.code)
            return None

    async def _do_Arrived(self, cmd: Arrived) -> None:
        await self._driver_call(cmd, "Arrived", "arrived", {"lat": round(cmd.lat, 6), "lng": round(cmd.lng, 6)})

    async def _do_StartTrip(self, cmd: StartTrip) -> None:
        acct = self.drivers[cmd.driver_id]
        code = acct.trip_code
        data = await self._driver_call(cmd, "StartTrip", "start")
        if data and data.get("status") == "in_progress" and code:
            self._emit(TripUpdate(cmd.driver_id, "driver", code, "in_progress", {}))

    async def _do_CompleteTrip(self, cmd: CompleteTrip) -> None:
        acct = self.drivers[cmd.driver_id]
        code = acct.trip_code
        data = await self._driver_call(cmd, "CompleteTrip", "complete", {"lat": round(cmd.lat, 6), "lng": round(cmd.lng, 6)})
        if data and code:
            fare = (data.get("fare") or {}).get("total")
            acct.trip_code = None
            self._emit(TripUpdate(cmd.driver_id, "driver", code, "completed", {"fare": float(fare) if fare is not None else None}))
