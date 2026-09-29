"""Command-line entry point: ``dhaka-twin <command>``."""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

from .geo import DHAKA_TZ
from .scenario import PRESETS, load_scenario, move_to_date

log = logging.getLogger("dhaka_twin")
ROOT = Path(__file__).resolve().parents[1]
RUNS = ROOT / "runs"
CACHE = ROOT / "data" / "cache"


# ---------------------------------------------------------------------- helpers
def _scenario_from_args(args):
    sc = load_scenario(args.scenario)
    if args.date:
        sc = move_to_date(sc, args.date)
    if args.start:
        hh, mm = (int(x) for x in args.start.split(":"))
        start = sc.start.replace(hour=hh, minute=mm)
        sc = sc.with_overrides(start=start)
    return sc.with_overrides(
        drivers=args.drivers,
        daily_requests=args.daily_requests,
        seed=args.seed,
        duration_s=args.hours * 3600 if args.hours else None,
    )


def _load_graph(args):
    from .roads import load_graph

    graph = load_graph(args.graph)
    log.info("road graph: %s (%d nodes, %d edges)", graph.source, graph.n_nodes, graph.n_edges)
    return graph


def _run_dir(args, scenario, policy: str) -> Path:
    if args.out:
        return Path(args.out)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return RUNS / f"{scenario.start.date()}_{scenario.name}_{policy}_{stamp}"


def _print_summary(summary: dict) -> None:
    def s(key):
        v = summary[key]
        return "–" if v["p50"] is None else f"median {v['p50']:.0f}s, p90 {v['p90']:.0f}s"

    rate = summary["completion_rate"]
    d = summary["drivers"]
    print(f"\n  requests {summary['requests']:,}   completed {summary['completed']:,}"
          f"   completion {'–' if rate is None else f'{rate:.1%}'}")
    print(f"  cancelled {summary['cancelled']:,}   expired (no driver) {summary['expired_no_driver']:,}   failed {summary['failed']:,}")
    print(f"  time to match: {s('time_to_match_s')}   pickup wait: {s('pickup_wait_s')}")
    if d:
        util = d.get("utilisation")
        print(f"  drivers worked {d['worked']:,}   utilisation {'–' if util is None else f'{util:.1%}'}"
              f"   offers/request {summary['offers_per_request'] or 0:.1f}   accept conflicts {d['accept_conflicts']:,}")
    if summary.get("wall_s"):
        print(f"  wall time {summary['wall_s']:.1f}s")


async def _simulate(args, scenario, graph, policy: str, *, record: bool = True, dashboard: bool = False, quiet=False):
    from .engine import World

    backend = _make_backend(args, policy)
    run_dir = _run_dir(args, scenario, policy if args.backend == "local" else "cholo-live") if record else None
    recorder = None
    if run_dir is not None:
        from .recorder import Recorder

        recorder = Recorder(run_dir, frame_every_s=args.frame_every, gps_every_s=args.gps_every)
    world = World(scenario, graph, backend, dt_s=args.dt, recorder=recorder)
    if args.demand_from:
        from .recorder import RecordedDemand

        demand_source = RecordedDemand(_resolve_run(args.demand_from), scenario.start, graph)
        world.demand_source = demand_source
        log.info("replaying %d recorded ride requests from %s", len(demand_source), args.demand_from)
    if recorder is not None:
        recorder.begin(world, policy=policy, backend=args.backend)

    board = None
    speed = args.speed
    if dashboard:
        from .dashboard.server import Dashboard, LiveSource

        board = Dashboard(LiveSource(world, label=graph.source), port=args.port)
        url = await board.start()
        print(f"Dashboard: {url}")
        if speed is None:
            speed = 1.0 if backend.realtime else 30.0
    if backend.realtime and speed is None:
        speed = 1.0

    started = time.monotonic()
    progress = _progress_printer(world) if not quiet else None
    try:
        metrics = await world.run(speed=speed, on_tick=progress)
    finally:
        if board is not None and not args.keep_open:
            await board.stop()
    metrics.wall_s = time.monotonic() - started
    summary = metrics.summary()
    summary["series"] = metrics.series
    if recorder is not None:
        recorder.finish(world, summary)
        RUNS.mkdir(parents=True, exist_ok=True)
        (RUNS / "LATEST").write_text(str(run_dir.resolve()))
    if board is not None and args.keep_open:
        print("Run finished; dashboard stays open. Press Ctrl+C to exit.")
        try:
            while True:
                await asyncio.sleep(3600)
        finally:
            await board.stop()
    return summary, run_dir


def _progress_printer(world):
    state = {"next": time.monotonic() + 5}

    def tick(w):
        now = time.monotonic()
        if now >= state["next"]:
            state["next"] = now + 5
            k = w.metrics.snapshot(w)
            print(f"  {w.now:%a %H:%M}  online {k['online']:>5}  on trip {k['on_trip']:>5}  waiting {k['waiting_riders']:>4}"
                  f"  completed {k['completed']:>6}  {' | '.join(k['labels'])}", flush=True)

    return tick


def _make_backend(args, policy: str):
    if args.backend == "local":
        from .backends.local import LocalPlatform

        return LocalPlatform(policy, matrix_cache=CACHE)
    if args.backend == "cholo":
        from .backends.cholo import CholoBackend

        return CholoBackend(
            api_url=args.api,
            password=args.sim_password,
            city_id=args.city_id,
            max_concurrency=args.max_concurrency,
            rider_accounts=args.rider_accounts,
        )
    raise SystemExit(f"unknown backend {args.backend!r}")


def _resolve_run(value: str) -> Path:
    if value == "latest":
        path = Path((RUNS / "LATEST").read_text().strip())
    elif value in ("yesterday", "today"):
        day = datetime.now(DHAKA_TZ).date() - timedelta(days=1 if value == "yesterday" else 0)
        # Newest recording of that simulated day, by the wall-clock stamp at the end of the name.
        candidates = sorted((p for p in RUNS.glob(f"{day.isoformat()}_*") if (p / "frames.jsonl.gz").exists()),
                            key=lambda p: p.name.rsplit("_", 1)[-1])
        if not candidates:
            raise SystemExit(f"no recorded run for {day} in {RUNS}; run one with --date {day}")
        path = candidates[-1]
    else:
        path = Path(value)
    if not (path / "meta.json").exists():
        raise SystemExit(f"{path} is not a recorded run (no meta.json)")
    return path


# ---------------------------------------------------------------------- commands
def cmd_run(args) -> int:
    scenario = _scenario_from_args(args)
    graph = _load_graph(args)
    print(f"{scenario.name}: {scenario.start:%a %d %b %Y %H:%M} for {scenario.duration_s / 3600:g} h, "
          f"{scenario.drivers:,} drivers, ~{scenario.daily_requests:,.0f} requests/day, seed {scenario.seed}, "
          f"backend {args.backend}{'' if args.backend != 'local' else ', dispatch ' + args.policy}")
    summary, run_dir = asyncio.run(
        _simulate(args, scenario, graph, args.policy, record=not args.no_record, dashboard=args.dashboard)
    )
    _print_summary(summary)
    if run_dir is not None:
        print(f"\n  recorded to {run_dir}")
    return 0


def cmd_compare(args) -> int:
    from .compare import comparison_table, render_text, write_report

    scenario = _scenario_from_args(args)
    graph = _load_graph(args)
    policies = [p.strip() for p in args.policies.split(",") if p.strip()]
    print(f"Comparing {', '.join(policies)} on {scenario.name} ({scenario.start:%a %d %b %H:%M}, "
          f"{scenario.duration_s / 3600:g} h, {scenario.drivers:,} drivers, seed {scenario.seed})")
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    out = Path(args.out) if args.out else RUNS / f"compare_{scenario.start.date()}_{scenario.name}_{stamp}"
    results = {}
    for policy in policies:
        print(f"\n== {policy}")
        run_args = argparse.Namespace(**{**vars(args), "out": str(out / policy)})
        summary, _ = asyncio.run(_simulate(run_args, scenario, graph, policy, record=not args.no_record, quiet=True))
        _print_summary(summary)
        results[policy] = summary
    table = comparison_table(results)
    print("\n" + render_text(table))
    report = write_report(out, results, f"Scenario `{scenario.name}`, {scenario.start:%A %d %B %Y %H:%M} Dhaka time, "
                                        f"{scenario.duration_s / 3600:g} h, {scenario.drivers:,} drivers, seed {scenario.seed}. "
                                        "Every policy saw exactly the same riders and drivers.")
    print(f"\nReport: {report}")
    return 0


def cmd_replay(args) -> int:
    from .dashboard.server import Dashboard, ReplaySource
    from .roads import load_graph
    from .recorder import load_meta

    run_dir = _resolve_run(args.run)
    meta = load_meta(run_dir)
    graph = load_graph("skeleton" if meta.get("graph_source") == "skeleton" else "auto")

    async def main():
        board = Dashboard(ReplaySource(run_dir, graph, speed=args.speed), port=args.port)
        url = await board.start()
        print(f"Replaying {run_dir.name} at {args.speed:g}x: {url}  (Ctrl+C to stop)")
        try:
            while True:
                await asyncio.sleep(3600)
        finally:
            await board.stop()

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    return 0


def cmd_fetch_graph(args) -> int:
    from .roads.osm import DEFAULT_CACHE, fetch_osm_graph

    out = Path(args.out) if args.out else DEFAULT_CACHE
    print("Downloading Dhaka's drive network from OpenStreetMap (Overpass API)…")
    graph = fetch_osm_graph(place=args.place)
    graph.save(out)
    print(f"Saved {graph.n_nodes:,} nodes and {graph.n_edges:,} edges to {out}")
    return 0


def cmd_presets(args) -> int:
    for name, sc in PRESETS.items():
        events = ", ".join(e.kind for e in sc.all_events()) or "none"
        print(f"{name:<16} {sc.start:%a %d %b %Y %H:%M}, {sc.duration_s / 3600:g} h. {sc.description} Events: {events}")
    return 0


def cmd_osrm(args) -> int:
    from .osrm import serve_osrm

    graph = _load_graph(args)
    asyncio.run(serve_osrm(graph, host=args.host, port=args.port))
    return 0


def cmd_seed(args) -> int:
    from .accounts import seed_accounts

    counts = seed_accounts(args.database_url, drivers=args.drivers, riders=args.riders, password=args.sim_password,
                           seed=args.seed or 42)
    print(json.dumps(counts, indent=1))
    return 0


# ---------------------------------------------------------------------- parser
def _add_sim_args(p: argparse.ArgumentParser) -> None:
    p.add_argument("--scenario", default="weekday", help=f"preset ({', '.join(PRESETS)}) or path to a scenario JSON")
    p.add_argument("--date", help="move the scenario to this date (YYYY-MM-DD)")
    p.add_argument("--start", help="start time of day, HH:MM (Dhaka)")
    p.add_argument("--hours", type=float, help="simulated duration in hours")
    p.add_argument("--drivers", type=int, help="fleet size")
    p.add_argument("--daily-requests", type=float, help="requests on a normal working day (scales all demand)")
    p.add_argument("--seed", type=int, help="random seed")
    p.add_argument("--graph", default="auto", help="auto | osm | skeleton | path to a saved .npz graph")
    p.add_argument("--dt", type=float, default=2.0, help="simulation tick in seconds")
    p.add_argument("--backend", default="local", choices=["local", "cholo"],
                   help="local: in-process platform model; cholo: call a running Cholo API and socket server")
    p.add_argument("--speed", type=float, help="simulated seconds per wall second (default: as fast as possible)")
    p.add_argument("--out", help="run directory")
    p.add_argument("--no-record", action="store_true", help="do not write a run directory")
    p.add_argument("--frame-every", type=float, default=10.0, help="seconds between recorded replay frames")
    p.add_argument("--gps-every", type=float, help="also write driver GPS traces every N seconds")
    p.add_argument("--demand-from", help="replay the ride requests of a recorded run (path, 'latest' or 'yesterday')")
    p.add_argument("--port", type=int, default=8765, help="dashboard port")
    p.add_argument("--api", default="http://127.0.0.1:3000", help="Cholo API origin (cholo backend)")
    p.add_argument("--sim-password", default="DhakaTwin#2026", help="password of the seeded simulator accounts")
    p.add_argument("--rider-accounts", type=int, default=3000, help="number of seeded rider accounts (cholo backend)")
    p.add_argument("--city-id", type=int, default=1, help="Cholo city id for Dhaka")
    p.add_argument("--max-concurrency", type=int, default=200, help="max in-flight HTTP requests (cholo backend)")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="dhaka-twin", description="Dhaka Digital Twin: agent-based simulator for Cholo")
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="simulate a scenario")
    _add_sim_args(run)
    run.add_argument("--policy", default="cholo-v1", help="dispatch policy for the local backend")
    run.add_argument("--dashboard", action="store_true", help="serve the live map while running")
    run.add_argument("--keep-open", action="store_true", help="keep the dashboard up after the run ends")
    run.set_defaults(func=cmd_run)

    cmp_ = sub.add_parser("compare", help="compare dispatch policies on the same seed")
    _add_sim_args(cmp_)
    cmp_.add_argument("--policies", default="cholo-v1,batched-eta")
    cmp_.set_defaults(func=cmd_compare, dashboard=False, keep_open=False)

    rep = sub.add_parser("replay", help="play a recorded run back on the dashboard")
    rep.add_argument("run", help="run directory, 'latest', 'yesterday' or 'today'")
    rep.add_argument("--speed", type=float, default=2.0, help="playback speed (2 = twice as fast as real time)")
    rep.add_argument("--port", type=int, default=8765)
    rep.set_defaults(func=cmd_replay)

    fetch = sub.add_parser("fetch-graph", help="download Dhaka's road network from OpenStreetMap")
    fetch.add_argument("--place", help="osmnx place query instead of the Dhaka bounding box")
    fetch.add_argument("--out", help="output .npz path")
    fetch.set_defaults(func=cmd_fetch_graph)

    pre = sub.add_parser("presets", help="list built-in scenarios")
    pre.set_defaults(func=cmd_presets)

    osrm = sub.add_parser("osrm", help="serve OSRM-compatible routes from the twin's road graph")
    osrm.add_argument("--graph", default="auto")
    osrm.add_argument("--host", default="127.0.0.1")
    osrm.add_argument("--port", type=int, default=5005)
    osrm.set_defaults(func=cmd_osrm)

    seed = sub.add_parser("seed-accounts", help="create simulator riders and approved drivers in Cholo's database")
    seed.add_argument("--database-url", required=True)
    seed.add_argument("--drivers", type=int, default=1000)
    seed.add_argument("--riders", type=int, default=3000)
    seed.add_argument("--sim-password", default="DhakaTwin#2026")
    seed.add_argument("--seed", type=int)
    seed.set_defaults(func=cmd_seed)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    try:
        return args.func(args)
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())
