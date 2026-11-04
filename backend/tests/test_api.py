"""Run from backend/:  python -m pytest -q"""
import copy

from fastapi.testclient import TestClient

from app.main import app

c = TestClient(app)

PAYLOAD = {
    "v": 1, "bid": "VTB-TEST-0001", "demo": True, "src": "demo-profile:faulty",
    "bat": {"cat": "E-rickshaw traction pack", "chem": "LFP", "cfg": "16S1P", "vn": 51.2, "ah": 100, "cyc": 620, "veh": "E-rickshaw"},
    "soh": {"v": 83.4, "lo": 72.4, "hi": 90.8, "m": "xgb-soh-q 1.0"},
    "sos": {"f": "RED", "c": 11, "m": "iforest-cells 1.0 + rules", "n": "Cell 11 resting voltage low"},
    "cells": {"n": 16, "min": 3237, "max": 3315, "med": 3304, "spr": 78}, "use": "RECYCLE", "meth": "VT-M1",
}


def test_health_and_keys():
    assert c.get("/api/health").json()["ok"]
    keys = c.get("/api/keys").json()["keys"]
    assert keys and len(keys[0]["pub"]) == 64


def test_sign_verify_and_tamper():
    rec = c.post("/api/passports", json={"payload": PAYLOAD}).json()
    assert rec["pid"].startswith("VTP-") and len(rec["hash"]) == 64
    ok = c.post("/api/verify", json={"payload": rec["payload"], "sig": rec["sig"]}).json()
    assert ok["status"] == "VERIFIED"
    bad = copy.deepcopy(rec["payload"])
    bad["soh"]["v"] = 96.5
    assert c.post("/api/verify", json={"payload": bad, "sig": rec["sig"]}).json()["status"] == "INVALID"
    assert c.get(f"/api/passports/{rec['pid']}").json()["hash"] == rec["hash"]
    assert c.get("/api/passports/VTP-2222-2222").status_code == 404


def test_diagnose_flags_faulty_cell():
    cells = [[(i % 5) - 2, (i % 3) - 1, 0.1 * (i % 4), 0.2 * (i % 3)] for i in range(16)]
    cells[10] = [-67, 40, 5.0, -10.5]
    feats = {"cycle_frac": 0.2067, "r_growth": 1.268, "recovery_ratio": 1.101, "slope_rel": 1.22, "avg_temp_c": 32.3, "bms_soh": 91.4}
    r = c.post("/api/diagnose", json={"soh_features": feats, "cells": cells}).json()
    assert r["safety"]["flag"] == "RED" and r["safety"]["suspect_cell"] == 11
    assert 70 < r["soh"]["p50"] < 95 and r["soh"]["p05"] <= r["soh"]["p50"] <= r["soh"]["p95"]
