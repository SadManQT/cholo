"""Policy comparison: run the same scenario and seed under several dispatch policies."""

from __future__ import annotations

import json
from pathlib import Path

ROWS = [
    ("Ride requests", lambda s: s["requests"], "{:,.0f}", 0),
    ("Completed trips", lambda s: s["completed"], "{:,.0f}", 1),
    ("Completion rate", lambda s: s["completion_rate"], "{:.1%}", 1),
    ("Expired, no driver", lambda s: s["expired_no_driver"], "{:,.0f}", -1),
    ("Rider cancellations", lambda s: s["cancelled"], "{:,.0f}", -1),
    ("Median time to match (s)", lambda s: s["time_to_match_s"]["p50"], "{:.0f}", -1),
    ("Median pickup wait (s)", lambda s: s["pickup_wait_s"]["p50"], "{:.0f}", -1),
    ("P90 wait until pickup (s)", lambda s: s["total_wait_s"]["p90"], "{:.0f}", -1),
    ("Offers per request", lambda s: s["offers_per_request"], "{:.2f}", -1),
    ("Accepts that lost the race", lambda s: s["drivers"]["accept_conflicts"], "{:,.0f}", -1),
    ("Empty (deadhead) share of km", lambda s: s["drivers"]["deadhead_share"], "{:.1%}", -1),
    ("Driver utilisation", lambda s: s["drivers"]["utilisation"], "{:.1%}", 1),
    ("Trips per active driver", lambda s: s["drivers"]["trips_per_active_driver"], "{:.2f}", 1),
    ("Gross fares (BDT)", lambda s: s["gross_fare_bdt"], "{:,.0f}", 1),
    ("Driver earnings (BDT)", lambda s: s["drivers"]["earnings_bdt"], "{:,.0f}", 1),
]


def _value(fn, summary):
    try:
        return fn(summary)
    except (KeyError, TypeError):
        return None


def comparison_table(results: dict[str, dict]) -> list[list[str]]:
    names = list(results)
    base = results[names[0]]
    header = ["Metric", *names] + ([f"{n} vs {names[0]}" for n in names[1:]] if len(names) > 1 else [])
    table = [header]
    for label, fn, fmt, better in ROWS:
        row = [label]
        values = [_value(fn, results[n]) for n in names]
        row += ["–" if v is None else fmt.format(v) for v in values]
        b = _value(fn, base)
        for v in values[1:]:
            if v is None or b in (None, 0):
                row.append("–")
                continue
            change = (v - b) / abs(b)
            mark = ""
            if better and abs(change) >= 0.005:
                mark = " better" if (change > 0) == (better > 0) else " worse"
            row.append(f"{change:+.1%}{mark}")
        table.append(row)
    return table


def render_text(table: list[list[str]]) -> str:
    widths = [max(len(r[i]) for r in table) for i in range(len(table[0]))]
    lines = []
    for k, row in enumerate(table):
        lines.append("  ".join(c.ljust(widths[i]) if i == 0 else c.rjust(widths[i]) for i, c in enumerate(row)))
        if k == 0:
            lines.append("  ".join("-" * w for w in widths))
    return "\n".join(lines)


def render_markdown(table: list[list[str]]) -> str:
    out = ["| " + " | ".join(table[0]) + " |", "|" + "|".join(["---"] + ["---:"] * (len(table[0]) - 1)) + "|"]
    out += ["| " + " | ".join(r) + " |" for r in table[1:]]
    return "\n".join(out)


def write_report(out_dir: Path, results: dict[str, dict], scenario_line: str) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    table = comparison_table(results)
    (out_dir / "compare.json").write_text(json.dumps(results, indent=1, default=str))
    md = f"# Dispatch policy comparison\n\n{scenario_line}\n\n{render_markdown(table)}\n"
    path = out_dir / "compare.md"
    path.write_text(md)
    return path
