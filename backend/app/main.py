"""
Voltrace API (FastAPI)

    uvicorn app.main:app --host 0.0.0.0 --port 8000      (run from backend/)

Endpoints
  GET  /api/health              service + model status
  GET  /api/keys                trusted issuer public keys (for offline verification)
  GET  /api/model-card          SoH + safety model metrics
  POST /api/diagnose            engineered features -> SoH quantiles + safety flag
  POST /api/passports           sign + store a passport (Ed25519 key stays here)
  GET  /api/passports/{pid}     fetch a stored signed passport
  POST /api/verify              verify payload + signature server-side

If ../frontend/dist exists it is served at "/" so one process hosts the whole app.
"""
from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import crypto, models
from .store import store

log = logging.getLogger("voltrace")
app = FastAPI(title="Voltrace API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=os.environ.get("VOLTRACE_CORS", "*").split(","),
                   allow_methods=["*"], allow_headers=["*"])

ISSUER = "Voltrace Issuer (server)"
TRUSTED = {crypto.SERVER_KID: {"pub": crypto.public_key_hex(), "issuer": ISSUER, "demo": False}}


class DiagnoseIn(BaseModel):
    soh_features: dict[str, float | None]
    cells: list[list[float]] = Field(..., description="[rest_dev_mv, sag_dev_pct, temp_dev_c, drift_dev_mv_d] per cell")


class SignIn(BaseModel):
    payload: dict[str, Any]


class VerifyIn(BaseModel):
    payload: dict[str, Any]
    sig: str


@app.get("/api/health")
def health():
    return {"ok": True, "store": store.kind, "kid": crypto.SERVER_KID,
            "models": {"soh": models.SOH["version"], "safety": models.IFOREST["version"]}}


@app.get("/api/keys")
def keys():
    return {"keys": [{"kid": k, **v} for k, v in TRUSTED.items()]}


@app.get("/api/model-card")
def model_card():
    return {"soh": models.SOH_CARD, "safety": models.IF_CARD}


@app.post("/api/diagnose")
def diagnose(body: DiagnoseIn):
    if len(body.cells) < 2:
        raise HTTPException(400, "at least two cells required")
    return {"soh": models.predict_soh(body.soh_features), "safety": models.safety(body.cells), "engine": "cloud"}


def _new_pid() -> str:
    alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
    body = "".join(secrets.choice(alphabet) for _ in range(8))
    return f"VTP-{body[:4]}-{body[4:]}"


@app.post("/api/passports")
def issue(body: SignIn):
    payload = dict(body.payload)
    payload["pid"] = _new_pid()
    payload["iat"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    payload["iss"] = ISSUER
    payload["kid"] = crypto.SERVER_KID
    signed = crypto.sign_payload(payload)
    rec = {"pid": payload["pid"], "battery_id": str(payload.get("bid", "")), "payload": payload, **signed}
    try:
        store.put(rec)
        stored = True
    except Exception as e:  # signing must not depend on storage; the QR carries the full record
        log.warning("passport %s signed but not stored: %s", rec["pid"], e)
        stored = False
    return {**rec, "stored": stored}


@app.get("/api/passports/{pid}")
def get_passport(pid: str):
    rec = store.get(pid.upper())
    if not rec:
        raise HTTPException(404, "passport not found")
    return rec


@app.post("/api/verify")
def verify(body: VerifyIn):
    kid = body.payload.get("kid")
    key = TRUSTED.get(kid)
    if not key:
        return {"status": "UNAVAILABLE", "reason": "unknown issuer key"}
    ok, digest = crypto.verify(body.payload, body.sig, key["pub"])
    return {"status": "VERIFIED" if ok else "INVALID", "hash": digest, "issuer": key["issuer"]}


DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="app")
