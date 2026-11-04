"""
Model inference service. Evaluates exactly the same exported model files that the
mobile app ships for offline use (models/soh_xgb.json, models/iforest.json), so
cloud and on-device results are identical.
"""
from __future__ import annotations

import json
import math
import struct
from pathlib import Path


def f32(v: float) -> float:
    """Round to IEEE float32 - XGBoost compares features and thresholds in float32."""
    return struct.unpack("f", struct.pack("f", v))[0]

MODEL_DIR = Path(__file__).resolve().parents[1] / "models"
SOH = json.loads((MODEL_DIR / "soh_xgb.json").read_text())
IFOREST = json.loads((MODEL_DIR / "iforest.json").read_text())
SOH_CARD = json.loads((MODEL_DIR / "soh_model_card.json").read_text())
IF_CARD = json.loads((MODEL_DIR / "iforest_model_card.json").read_text())


def _tree(node: dict, x: list[float | None]) -> float:
    while "l" not in node:
        v = x[node["f"]]
        if v is None or (isinstance(v, float) and math.isnan(v)):
            node = node["y"] if node["m"] == 0 else node["n"]
        else:
            node = node["y"] if f32(v) < f32(node["t"]) else node["n"]
    return node["l"]


def predict_soh(features: dict) -> dict:
    x = [features.get(f) for f in SOH["features"]]
    out = list(SOH["base_scores"]) if len(SOH["base_scores"]) == len(SOH["quantiles"]) else [SOH["base_scores"][0]] * len(SOH["quantiles"])
    for t in SOH["trees"]:
        out[t["g"]] = f32(out[t["g"]] + _tree(t["r"], x))
    lo, mid, hi = sorted(out)
    clamp = lambda v: max(0.0, min(100.0, v))
    return {"p05": round(clamp(lo), 1), "p50": round(clamp(mid), 1), "p95": round(clamp(hi), 1), "model": SOH["version"]}


def _c(n: float) -> float:
    if n <= 1:
        return 0.0
    if n == 2:
        return 1.0
    return 2.0 * (math.log(n - 1.0) + 0.5772156649) - 2.0 * (n - 1.0) / n


def _median(v: list[float]) -> float:
    s = sorted(v)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def iforest_scores(cells: list[list[float]]) -> list[float]:
    """cells: raw deviation vectors [rest_dev_mv, sag_dev_pct, temp_dev_c, drift_dev_mv_d]."""
    floors = IFOREST["floors"]
    cols = list(zip(*cells))
    meds = [_median(list(c)) for c in cols]
    mads = [_median([abs(v - m) for v in c]) * 1.4826 for c, m in zip(cols, meds)]
    scale = [max(m, f) for m, f in zip(mads, floors)]
    cn = _c(IFOREST["max_samples"])
    scores = []
    for cell in cells:
        z = [abs(v - m) / s for v, m, s in zip(cell, meds, scale)]
        depth = 0.0
        for tr in IFOREST["trees"]:
            node, d = 0, 0
            while tr["l"][node] != -1:
                node = tr["l"][node] if z[tr["f"][node]] <= tr["t"][node] else tr["r"][node]
                d += 1
            depth += d + _c(tr["n"][node])
        scores.append(round(2 ** (-(depth / len(IFOREST["trees"])) / cn), 4))
    return scores


def safety(cells: list[list[float]]) -> dict:
    scores = iforest_scores(cells)
    meds = [_median(list(c)) for c in zip(*cells)]
    results = []
    for i, (cell, s) in enumerate(zip(cells, scores)):
        d = [v - m for v, m in zip(cell, meds)]
        hits, lvl = [], 0
        def rule(cond_a, cond_r, msg):
            nonlocal lvl
            if cond_r:
                lvl = max(lvl, 2); hits.append(msg)
            elif cond_a:
                lvl = max(lvl, 1); hits.append(msg)
        rule(abs(d[0]) > 30, abs(d[0]) > 60, "resting_voltage_deviation")
        rule(d[1] > 30, d[1] > 60, "voltage_sag")
        rule(d[2] > 4, d[2] > 7, "temperature_deviation")
        rule(d[3] < -8, d[3] < -20, "self_discharge")
        if_lvl = 2 if s >= IFOREST["threshold_red"] else 1 if s >= IFOREST["threshold_amber"] else 0
        results.append({"cell": i + 1, "score": s, "rule_level": lvl, "if_level": if_lvl, "rules": hits,
                        "level": max(lvl, if_lvl)})
    rest = [c[0] for c in cells]
    spread = max(rest) - min(rest)
    pack_level = 2 if spread > 100 else 1 if spread > 50 else 0
    level = max([pack_level] + [r["level"] for r in results])
    suspect = max(results, key=lambda r: (r["level"], r["score"])) if level > 0 else None
    return {
        "flag": ["GREEN", "AMBER", "RED"][level],
        "suspect_cell": suspect["cell"] if suspect else None,
        "spread_mv": round(spread, 1),
        "cells": results,
        "model": IFOREST["version"],
    }
