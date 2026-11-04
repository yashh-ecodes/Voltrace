"""
Passport storage. Uses Supabase (PostgreSQL via PostgREST) when SUPABASE_URL and
SUPABASE_SERVICE_KEY are set; otherwise a local SQLite file so the service runs with
zero configuration. Schema: backend/supabase/schema.sql.
"""
from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

import httpx

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
DB_PATH = Path(os.environ.get("VOLTRACE_DB", Path(__file__).resolve().parents[1] / "data" / "voltrace.db"))


class SqliteStore:
    kind = "sqlite"

    def __init__(self) -> None:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(DB_PATH, check_same_thread=False)
        self.db.execute(
            "create table if not exists passports (pid text primary key, battery_id text, payload text,"
            " hash text, sig text, kid text, created_at text default current_timestamp)")
        self.db.commit()

    def put(self, rec: dict) -> None:
        self.db.execute("insert or replace into passports(pid,battery_id,payload,hash,sig,kid) values (?,?,?,?,?,?)",
                        (rec["pid"], rec["battery_id"], json.dumps(rec["payload"]), rec["hash"], rec["sig"], rec["kid"]))
        self.db.commit()

    def get(self, pid: str) -> dict | None:
        row = self.db.execute("select pid,battery_id,payload,hash,sig,kid from passports where pid=?", (pid,)).fetchone()
        if not row:
            return None
        return {"pid": row[0], "battery_id": row[1], "payload": json.loads(row[2]), "hash": row[3], "sig": row[4], "kid": row[5]}


class SupabaseStore:
    kind = "supabase"

    def __init__(self) -> None:
        self.h = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"}

    def put(self, rec: dict) -> None:
        r = httpx.post(f"{SUPABASE_URL}/rest/v1/passports", headers={**self.h, "Prefer": "resolution=merge-duplicates"},
                       json=rec, timeout=10)
        r.raise_for_status()

    def get(self, pid: str) -> dict | None:
        r = httpx.get(f"{SUPABASE_URL}/rest/v1/passports", headers=self.h,
                      params={"pid": f"eq.{pid}", "select": "pid,battery_id,payload,hash,sig,kid"}, timeout=10)
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None


store = SupabaseStore() if SUPABASE_URL and SUPABASE_KEY else SqliteStore()
