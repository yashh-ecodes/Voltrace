"""
Train the Voltrace State-of-Health model (XGBoost, multi-quantile regression) on the
NASA Prognostics Center of Excellence (PCoE) Li-ion battery ageing dataset.

    python -m ml.train_soh            (run from backend/)

Inputs : backend/data/raw/5. Battery Data Set/extracted/B00xx.mat
Outputs: backend/models/soh_xgb.json        (tree dump, consumed by API + app)
         backend/models/soh_model_card.json (metrics, split, feature importances)

Split  : by battery (GroupShuffle) - no cell appears in both train and test.
Target : SoH (%) = measured discharge capacity / 2.0 Ah rated capacity * 100.

Note on `bms_soh`: NASA lab data has no BMS. We synthesise the BMS capacity estimate
channel from the measured capacity with the optimistic bias and noise typical of
low-cost coulomb-counting BMS units (they rarely re-learn full capacity). This is a
documented simulation, not measured data. CALCE data can be added via `load_calce()`.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import scipy.io as sio
import xgboost as xgb

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ml.features import CHEMISTRY_REF, FEATURES  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "5. Battery Data Set" / "extracted"
OUT = ROOT / "models"
RATED_AH = 2.0
REF = CHEMISTRY_REF["NASA18650"]
QUANTILES = [0.05, 0.5, 0.95]
rng = np.random.default_rng(42)


def discharge_features(d: dict) -> dict | None:
    v = np.asarray(d["Voltage_measured"], float)
    i = np.asarray(d["Current_measured"], float)
    t = np.asarray(d["Time"], float)
    temp = np.asarray(d["Temperature_measured"], float)
    cap = float(np.asarray(d["Capacity"]).ravel()[0]) if np.size(d["Capacity"]) else np.nan
    if not np.isfinite(cap) or cap < 0.6 or cap > 2.4 or len(v) < 20:
        return None
    loaded = np.where(np.abs(i) > 0.5)[0]
    if len(loaded) < 10 or loaded[0] == 0:
        return None
    k0, k_end = loaded[0], loaded[-1]
    i_load = float(np.median(np.abs(i[loaded[: min(10, len(loaded))]])))
    if i_load < 0.5:
        return None
    c_rate = i_load / RATED_AH
    sag = float(v[k0 - 1] - v[k0])  # volts at load step
    if sag <= 0.005:
        return None
    r = sag / i_load  # ohms
    # early loaded slope: first ~60 s of load
    win = np.where((t >= t[k0]) & (t <= t[k0] + 60))[0]
    if len(win) < 2:
        win = loaded[:3]
    slope = (v[win[0]] - v[win[-1]]) / max(t[win[-1]] - t[win[0]], 1e-6) * 1000 / c_rate  # mV/s per C
    # recovery after load removal
    after = np.arange(k_end + 1, len(v))
    if len(after) == 0:
        return None
    recovery = float(v[after].max() - v[k_end])
    return {
        "capacity": cap,
        "r_mohm_ah": r * 1000 * RATED_AH,
        "recovery_ratio": float(np.clip(recovery / sag, 0, 5)),
        "slope": float(slope),
        "avg_temp_c": float(np.mean(temp)),
    }


def load_nasa() -> list[dict]:
    rows = []
    for f in sorted(RAW.glob("B00*.mat")):
        name = f.stem
        m = sio.loadmat(f, simplify_cells=True)
        cycles = m[name]["cycle"]
        n_dis = 0
        feats = []
        for c in cycles:
            if c["type"] != "discharge":
                continue
            n_dis += 1
            fe = discharge_features(c["data"])
            if fe is None:
                continue
            fe["cycle"] = n_dis
            feats.append(fe)
        if len(feats) < 15:
            continue
        r0 = np.median([x["r_mohm_ah"] for x in feats[:3]])
        s0 = np.median([x["slope"] for x in feats[:3]])
        for x in feats:
            soh = x["capacity"] / RATED_AH * 100
            # Synthetic BMS estimate: optimistic bias growing with fade, noise, capped at 100.
            bms = 100 - 0.55 * (100 - soh) + rng.normal(2.0, 3.0)
            rows.append({
                "battery": name,
                "soh": soh,
                "cycle_frac": x["cycle"] / REF["cycle_life"],
                # resistance growth expressed against the chemistry reference, using
                # this cell's own first cycles to remove fixture/contact offsets
                "r_growth": x["r_mohm_ah"] / r0,
                "recovery_ratio": x["recovery_ratio"],
                "slope_rel": x["slope"] / s0 if s0 > 0 else 1.0,
                "avg_temp_c": x["avg_temp_c"],
                "bms_soh": float(np.clip(bms, 40, 100)),
            })
    return rows


def load_calce() -> list[dict]:
    """Integration point for CALCE CS2/CX2 data (requires registration to download)."""
    return []


def dump_trees(booster: xgb.Booster) -> dict:
    raw = json.loads(booster.save_raw("json").decode())
    learner = raw["learner"]
    tree_info = learner["gradient_booster"]["model"]["tree_info"]
    base = learner["learner_model_param"]["base_score"]
    base_scores = [float(x) for x in json.loads(base)] if base.strip().startswith("[") else [float(base)]
    dumps = [json.loads(s) for s in booster.get_dump(dump_format="json")]

    def compact(node):
        if "leaf" in node:
            return {"l": round(node["leaf"], 7)}
        feat = int(node["split"][1:]) if node["split"].startswith("f") else FEATURES.index(node["split"])
        kids = {c["nodeid"]: c for c in node["children"]}
        return {
            "f": feat,
            "t": node["split_condition"],
            "m": 0 if node["missing"] == node["yes"] else 1,
            "y": compact(kids[node["yes"]]),
            "n": compact(kids[node["no"]]),
        }

    return {
        "features": FEATURES,
        "quantiles": QUANTILES,
        "base_scores": base_scores,
        "trees": [{"g": int(g), "r": compact(t)} for g, t in zip(tree_info, dumps)],
    }


def main():
    rows = load_nasa() + load_calce()
    batteries = sorted({r["battery"] for r in rows})
    X = np.array([[r[f] for f in FEATURES] for r in rows], dtype=np.float32)
    y = np.array([r["soh"] for r in rows], dtype=np.float32)
    groups = np.array([r["battery"] for r in rows])

    # battery-wise split: hold out ~25% of cells
    perm = np.random.default_rng(7).permutation(batteries)
    n_test = max(4, len(batteries) // 4)
    test_b = set(perm[:n_test])
    te = np.array([g in test_b for g in groups])
    tr = ~te

    params = dict(
        objective="reg:quantileerror",
        quantile_alpha=np.array(QUANTILES),
        tree_method="hist",
        max_depth=3,
        learning_rate=0.08,
        n_estimators=0,
        subsample=0.85,
        colsample_bytree=0.9,
        min_child_weight=4,
        seed=42,
    )
    dtr = xgb.QuantileDMatrix(X[tr], y[tr])
    dte = xgb.DMatrix(X[te], y[te])
    p = {k: v for k, v in params.items() if k != "n_estimators"}
    booster = xgb.train(p, dtr, num_boost_round=200)
    pred = booster.predict(dte)  # (n, 3)
    med = pred[:, 1]
    mae = float(np.mean(np.abs(med - y[te])))
    rmse = float(np.sqrt(np.mean((med - y[te]) ** 2)))
    coverage = float(np.mean((y[te] >= pred[:, 0]) & (y[te] <= pred[:, 2])))
    width = float(np.mean(pred[:, 2] - pred[:, 0]))

    # baseline: trusting the (simulated) BMS figure
    bms_mae = float(np.mean(np.abs(X[te][:, FEATURES.index("bms_soh")] - y[te])))

    # ablation without the BMS channel (pure physics features)
    Xn = np.delete(X, FEATURES.index("bms_soh"), axis=1)
    b2 = xgb.train(p, xgb.QuantileDMatrix(Xn[tr], y[tr]), num_boost_round=200)
    mae_no_bms = float(np.mean(np.abs(b2.predict(xgb.DMatrix(Xn[te]))[:, 1] - y[te])))

    gain = booster.get_score(importance_type="gain")
    imp = {FEATURES[int(k[1:])] if k.startswith("f") else k: v for k, v in gain.items()}
    tot = sum(imp.values()) or 1
    imp = {k: round(v / tot, 4) for k, v in sorted(imp.items(), key=lambda kv: -kv[1])}

    OUT.mkdir(exist_ok=True)
    model = dump_trees(booster)
    model["version"] = "xgb-soh-q 1.0"
    (OUT / "soh_xgb.json").write_text(json.dumps(model, separators=(",", ":")))

    # parity vectors so the TypeScript evaluator can be checked against xgboost
    sample = X[te][:: max(1, te.sum() // 25)][:25]
    parity = {"X": sample.tolist(), "pred": booster.predict(xgb.DMatrix(sample)).tolist()}
    (OUT / "soh_parity.json").write_text(json.dumps(parity))

    card = {
        "model": "xgb-soh-q 1.0",
        "algorithm": "XGBoost gradient-boosted trees, multi-quantile regression (5th / 50th / 95th percentile)",
        "dataset": "NASA PCoE Li-ion Battery Aging Dataset (18650 cells, 2.0 Ah)",
        "cells_total": len(batteries),
        "cells_train": len(batteries) - len(test_b),
        "cells_test": len(test_b),
        "test_cells": sorted(test_b),
        "samples_train": int(tr.sum()),
        "samples_test": int(te.sum()),
        "split": "Battery-wise hold-out: no cell appears in both train and test sets",
        "mae_pct_points": round(mae, 2),
        "rmse_pct_points": round(rmse, 2),
        "interval_coverage_90": round(coverage, 3),
        "mean_interval_width": round(width, 2),
        "baseline_bms_only_mae": round(bms_mae, 2),
        "mae_without_bms_feature": round(mae_no_bms, 2),
        "features": FEATURES,
        "feature_importance_gain": imp,
        "notes": [
            "bms_soh is a synthetic channel (optimistic bias + noise) because NASA lab data has no BMS.",
            "Features are chemistry-normalised for transfer to EV packs; transfer accuracy on Indian packs is unvalidated until field trials.",
            "CALCE data loader is an integration point (dataset requires registration).",
        ],
    }
    (OUT / "soh_model_card.json").write_text(json.dumps(card, indent=2))
    print(json.dumps(card, indent=2))


if __name__ == "__main__":
    main()
