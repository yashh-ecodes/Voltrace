"""
Train the Voltrace cell-anomaly model (Isolation Forest) and validate it by synthetic
fault injection, as described in the proposal's validation plan.

    python -m ml.train_iforest        (run from backend/)

Each cell is described by its deviation from its own pack median, so the model is
brand-agnostic and needs no labelled fire dataset:

    rest_dev_mv      resting voltage - pack median (mV)
    sag_dev_pct      voltage sag under load vs pack median sag (%)
    temp_dev_c       cell / nearest-sensor temperature - pack median (deg C)
    drift_dev_mv_d   voltage drift between two scans - pack median drift (mV/day)

Training data: deviations of healthy cells from simulated packs with realistic
balance quality (sigma sampled per pack). Validation: inject faults (extra
self-discharge, resistance rise, hotspot) at three severities and measure detection
and false-alarm rates.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from sklearn.ensemble import IsolationForest

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "models"
FEATURES = ["z_rest", "z_sag", "z_temp", "z_drift"]
RAW_FEATURES = ["rest_dev_mv", "sag_dev_pct", "temp_dev_c", "drift_dev_mv_d"]
# Robust-scale floors: physical resolution below which deviations are not meaningful
FLOORS = np.array([4.0, 4.0, 0.5, 1.0])
rng = np.random.default_rng(2026)


def robust_z(P: np.ndarray) -> np.ndarray:
    """|deviation from pack median| / max(pack MAD * 1.4826, floor) for every cell."""
    med = np.median(P, axis=0)
    mad = np.median(np.abs(P - med), axis=0) * 1.4826
    return np.abs(P - med) / np.maximum(mad, FLOORS)


def rule_levels(P: np.ndarray) -> np.ndarray:
    """Per-cell rule level 0 (ok) / 1 (amber) / 2 (red) on raw deviations."""
    D = P - np.median(P, axis=0)
    lvl = np.zeros(len(P), int)
    def bump(mask, v):
        lvl[mask] = np.maximum(lvl[mask], v)
    bump(np.abs(D[:, 0]) > 30, 1); bump(np.abs(D[:, 0]) > 60, 2)
    bump(D[:, 1] > 30, 1); bump(D[:, 1] > 60, 2)
    bump(D[:, 2] > 4, 1); bump(D[:, 2] > 7, 2)
    bump(D[:, 3] < -8, 1); bump(D[:, 3] < -20, 2)
    return lvl


def healthy_pack(n_cells: int) -> np.ndarray:
    q = rng.uniform(0.6, 1.6)  # pack balance quality
    rest = rng.normal(0, 6 * q, n_cells)
    sag = rng.normal(0, 5 * q, n_cells)
    temp = rng.normal(0, 0.7 * q, n_cells)
    drift = rng.normal(0, 1.2 * q, n_cells)
    X = np.c_[rest, sag, temp, drift]
    return X - np.median(X, axis=0)  # deviations are relative to the pack median


def inject(x: np.ndarray, kind: str, sev: int) -> np.ndarray:
    x = x.copy()
    if kind == "self_discharge":
        x[0] -= [12, 28, 60][sev]
        x[3] -= [5, 12, 25][sev]
    elif kind == "resistance_rise":
        x[1] += [18, 35, 70][sev]
        x[2] += [0.6, 1.5, 3.0][sev]
    elif kind == "hotspot":
        x[2] += [2.5, 4.5, 8.0][sev]
    return x


def c_factor(n: float) -> float:
    if n <= 1:
        return 0.0
    if n == 2:
        return 1.0
    return 2.0 * (np.log(n - 1.0) + np.euler_gamma) - 2.0 * (n - 1.0) / n


def export(model: IsolationForest) -> dict:
    trees = []
    for est, feats in zip(model.estimators_, model.estimators_features_):
        t = est.tree_
        trees.append({
            "l": t.children_left.tolist(),
            "r": t.children_right.tolist(),
            "f": [int(feats[f]) if f >= 0 else -1 for f in t.feature],
            "t": [round(float(v), 4) for v in t.threshold],
            "n": t.n_node_samples.tolist(),
        })
    return {"features": FEATURES, "max_samples": int(model.max_samples_), "trees": trees}


def score_replica(m: dict, x: np.ndarray) -> float:
    """Re-implementation of sklearn score_samples (positive = more anomalous)."""
    depths = []
    for tr in m["trees"]:
        node, d = 0, 0
        while tr["l"][node] != -1:
            node = tr["l"][node] if x[tr["f"][node]] <= tr["t"][node] else tr["r"][node]
            d += 1
        depths.append(d + c_factor(tr["n"][node]))
    return float(2 ** (-np.mean(depths) / c_factor(m["max_samples"])))


def main():
    train = np.vstack([robust_z(healthy_pack(int(rng.choice([14, 16, 20, 24])))) for _ in range(600)])
    model = IsolationForest(n_estimators=100, max_samples=64, random_state=42).fit(train)
    exported = export(model)

    # verify the replica matches sklearn exactly
    probe = train[:200]
    sk = -model.score_samples(probe)
    rep = np.array([score_replica(exported, x) for x in probe])
    assert np.allclose(sk, rep, atol=2e-3), float(np.abs(sk - rep).max())

    # threshold: 99.5th percentile of healthy-cell scores on fresh packs
    hold_packs = [healthy_pack(16) for _ in range(400)]
    s_h = np.concatenate([-model.score_samples(robust_z(p)) for p in hold_packs])
    thr_amber = float(np.quantile(s_h, 0.995))
    thr_red = float(thr_amber + 0.08)

    # fault injection validation
    results = {"iforest_only": {}, "rules_only": {}, "hybrid": {}}
    for kind in ["self_discharge", "resistance_rise", "hotspot"]:
        for k in results:
            results[k][kind] = {}
        for sev, label in enumerate(["low", "medium", "high"]):
            hits = {"iforest_only": 0, "rules_only": 0, "hybrid": 0}
            for _ in range(300):
                pack = healthy_pack(16)
                j = rng.integers(16)
                pack[j] = inject(pack[j], kind, sev)
                s = -model.score_samples(robust_z(pack))
                rl = rule_levels(pack)
                if_hit = s[j] >= thr_amber and np.argmax(s) == j
                rule_hit = rl[j] >= 1
                hits["iforest_only"] += int(if_hit)
                hits["rules_only"] += int(rule_hit)
                hits["hybrid"] += int(if_hit or rule_hit)
            for k in results:
                results[k][kind][label] = round(hits[k] / 300, 3)
    false_alarm_cell = float(np.mean(s_h >= thr_amber))
    fa_pack = {
        "iforest_only": float(np.mean([np.any(-model.score_samples(robust_z(p)) >= thr_amber) for p in hold_packs])),
        "rules_only": float(np.mean([np.any(rule_levels(p) >= 1) for p in hold_packs])),
    }
    fa_pack["hybrid"] = float(np.mean([
        np.any((-model.score_samples(robust_z(p)) >= thr_amber) | (rule_levels(p) >= 1)) for p in hold_packs
    ]))

    exported.update({
        "floors": FLOORS.tolist(),
        "version": "iforest-cells 1.0",
        "threshold_amber": round(thr_amber, 4),
        "threshold_red": round(thr_red, 4),
    })
    OUT.mkdir(exist_ok=True)
    (OUT / "iforest.json").write_text(json.dumps(exported, separators=(",", ":")))
    card = {
        "model": "iforest-cells 1.0",
        "algorithm": "Isolation Forest (100 trees, 64 samples/tree) on robust z-scores of per-cell deviation from the pack median, combined with rule thresholds",
        "features": FEATURES,
        "training": f"{len(train)} healthy cells from 600 simulated packs with varied balance quality",
        "threshold_amber": round(thr_amber, 4),
        "threshold_red": round(thr_red, 4),
        "validation": "Synthetic fault injection into one cell of fresh healthy packs (300 packs per fault/severity); detection requires the injected cell to be the top-scoring cell above threshold",
        "detection_rate": results,
        "false_alarm_rate_per_cell": round(false_alarm_cell, 4),
        "false_alarm_rate_per_pack": {k: round(v, 3) for k, v in fa_pack.items()},
        "raw_features": RAW_FEATURES,
        "robust_scale_floors": FLOORS.tolist(),
        "rules": [
            "Resting cell spread > 50 mV: AMBER; > 100 mV: RED",
            "Single-cell resting deviation from median > 30 mV: AMBER; > 60 mV: RED",
            "Cell temperature > 4 deg C above median: AMBER; > 7 deg C: RED",
            "Abnormal self-discharge > 8 mV/day vs pack: AMBER; > 20 mV/day: RED",
            "Voltage sag > 30% above pack median: AMBER; > 60%: RED",
        ],
    }
    (OUT / "iforest_model_card.json").write_text(json.dumps(card, indent=2))
    print(json.dumps(card, indent=2))


if __name__ == "__main__":
    main()
