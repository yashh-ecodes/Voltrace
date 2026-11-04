"""
Passport trust layer: canonical JSON -> SHA-256 -> Ed25519 signature.

Canonical JSON (must match frontend/src/lib/canonical.ts exactly):
  * object keys sorted, no insignificant whitespace, UTF-8, non-ASCII not escaped
  * floats with an integral value are written as integers (84.0 -> 84)
  * other floats use the shortest round-trip representation (same in Python and JS)

The Ed25519 signature is computed over the 32-byte SHA-256 digest of the canonical JSON.
The private key never leaves this service.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
from pathlib import Path

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

KEY_DIR = Path(os.environ.get("VOLTRACE_KEY_DIR", Path(__file__).resolve().parents[1] / "keys"))


def _normalise(o):
    if isinstance(o, bool) or o is None or isinstance(o, str):
        return o
    if isinstance(o, float):
        if not math.isfinite(o):
            raise ValueError("non-finite number in passport")
        return int(o) if o.is_integer() else o
    if isinstance(o, int):
        return o
    if isinstance(o, dict):
        return {str(k): _normalise(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_normalise(v) for v in o]
    raise TypeError(f"unsupported type {type(o)}")


def canonical_json(obj) -> str:
    return json.dumps(_normalise(obj), sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_hex(obj) -> str:
    return hashlib.sha256(canonical_json(obj).encode("utf-8")).hexdigest()


def _load_or_create_key() -> Ed25519PrivateKey:
    KEY_DIR.mkdir(parents=True, exist_ok=True)
    seed = os.environ.get("VOLTRACE_SIGNING_SEED")
    if seed:  # stable key from a long random secret (e.g. Render generateValue), survives restarts
        return Ed25519PrivateKey.from_private_bytes(hashlib.sha256(seed.encode("utf-8")).digest())
    pem = os.environ.get("VOLTRACE_SIGNING_KEY_PEM")
    if pem:
        return serialization.load_pem_private_key(pem.encode(), password=None)  # type: ignore[return-value]
    path = KEY_DIR / "issuer_ed25519.pem"
    if path.exists():
        return serialization.load_pem_private_key(path.read_bytes(), password=None)  # type: ignore[return-value]
    key = Ed25519PrivateKey.generate()
    path.write_bytes(key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    os.chmod(path, 0o600)
    return key


_KEY = _load_or_create_key()
_PUB_HEX = _KEY.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw).hex()
# Key id: explicit, or derived from the public key fingerprint so different keys never share an id.
SERVER_KID = os.environ.get("VOLTRACE_KEY_ID") or (
    "vt-srv-2026-01" if not os.environ.get("VOLTRACE_SIGNING_SEED") else f"vt-srv-{hashlib.sha256(bytes.fromhex(_PUB_HEX)).hexdigest()[:10]}")


def public_key_hex() -> str:
    return _KEY.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw).hex()


def sign_payload(payload: dict) -> dict:
    digest_hex = sha256_hex(payload)
    sig = _KEY.sign(bytes.fromhex(digest_hex))
    return {"hash": digest_hex, "sig": sig.hex(), "kid": SERVER_KID}


def verify(payload: dict, sig_hex: str, pub_hex: str) -> tuple[bool, str]:
    digest_hex = sha256_hex(payload)
    try:
        Ed25519PublicKey.from_public_bytes(bytes.fromhex(pub_hex)).verify(bytes.fromhex(sig_hex), bytes.fromhex(digest_hex))
        return True, digest_hex
    except (InvalidSignature, ValueError):
        return False, digest_hex
