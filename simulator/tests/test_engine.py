import csv
import json

from conftest import run_world

from dhaka_twin.compare import comparison_table, render_markdown
from dhaka_twin.recorder import RecordedDemand, Recorder, read_jsonl_gz


def test_a_short_run_completes_trips_and_is_reproducible(graph, small_weekday):
    sc = small_weekday.with_overrides(start=small_weekday.start.replace(hour=8))
    _, first = run_world(graph, sc, hours=0.75)
    _, second = run_world(graph, sc, hours=0.75)
    a, b = first.summary(), second.summary()
    assert a["requests"] > 50
    assert a["completed"] > 0
    for key in ("requests", "completed", "cancelled", "expired_no_driver", "offers_made"):
        assert a[key] == b[key], key
    assert a["drivers"]["deadhead_km"] == b["drivers"]["deadhead_km"]


def test_every_policy_sees_the_same_riders(graph, small_weekday, tmp_path):
    sc = small_weekday.with_overrides(start=small_weekday.start.replace(hour=8))
    logs = {}
    results = {}
    for policy in ("cholo-v1", "batched-eta"):
        rec = Recorder(tmp_path / policy, frame_every_s=60)
        world, metrics = run_world(graph, sc, policy=policy, hours=0.5, recorder=rec)
        rec.finish(world, metrics.summary())
        logs[policy] = [(r["id"], r["o_cell"], r["d_cell"], r["vehicle"]) for r in read_jsonl_gz(tmp_path / policy / "requests.jsonl.gz")]
        results[policy] = metrics.summary()
    assert logs["cholo-v1"] == logs["batched-eta"]
    assert results["cholo-v1"]["offers_per_request"] > results["batched-eta"]["offers_per_request"]
    table = comparison_table(results)
    assert table[0] == ["Metric", "cholo-v1", "batched-eta", "batched-eta vs cholo-v1"]
    assert "| Completed trips |" in render_markdown(table)


def test_recording_writes_ml_tables_and_replays_demand(graph, small_weekday, tmp_path):
    sc = small_weekday.with_overrides(start=small_weekday.start.replace(hour=17))
    rec = Recorder(tmp_path / "run", frame_every_s=30, gps_every_s=30)
    world, metrics = run_world(graph, sc, hours=0.5, recorder=rec)
    rec.begin(world, policy="cholo-v1", backend="local")
    summary = metrics.summary()
    rec.finish(world, summary)

    run = tmp_path / "run"
    for name in ("meta.json", "events.jsonl.gz", "frames.jsonl.gz", "requests.jsonl.gz", "trips.csv", "gps.csv.gz",
                 "demand_hex.csv", "summary.json"):
        assert (run / name).exists(), name
    with open(run / "trips.csv") as f:
        rows = list(csv.DictReader(f))
    assert len(rows) == summary["finished"]
    assert {r["state"] for r in rows} <= {"completed", "cancelled", "expired", "failed"}
    frames = list(read_jsonl_gz(run / "frames.jsonl.gz"))
    assert len(frames) >= 55
    assert len(frames[0]["lat"]) == len(world.drivers) == len(frames[0]["s"])
    assert "heat" in frames[0]
    kinds = {e["k"] for e in read_jsonl_gz(run / "events.jsonl.gz")}
    assert {"request", "accept", "rider_done", "online"} <= kinds
    assert json.loads((run / "meta.json").read_text())["policy"] == "cholo-v1"

    replay = RecordedDemand(run, sc.start, graph)
    assert len(replay) == summary["requests"]
    _, again = run_world(graph, sc, hours=0.5, demand_source=replay)
    assert again.summary()["requests"] == summary["requests"]


def test_replay_run_names_resolve_yesterday_and_latest(tmp_path, monkeypatch):
    from datetime import datetime, timedelta

    from dhaka_twin import cli
    from dhaka_twin.geo import DHAKA_TZ

    monkeypatch.setattr(cli, "RUNS", tmp_path)
    yesterday = (datetime.now(DHAKA_TZ).date() - timedelta(days=1)).isoformat()
    older = tmp_path / f"{yesterday}_weekday_cholo-v1_20260101-000000"
    newer = tmp_path / f"{yesterday}_weekday_batched-eta_20260101-010000"
    for run in (older, newer):
        run.mkdir()
        (run / "meta.json").write_text("{}")
        (run / "frames.jsonl.gz").write_bytes(b"")
    (tmp_path / "LATEST").write_text(str(older))
    assert cli._resolve_run("yesterday") == newer
    assert cli._resolve_run("latest") == older
