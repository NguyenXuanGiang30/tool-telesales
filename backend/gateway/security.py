from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from dataclasses import asdict, dataclass, field
from pathlib import Path
from threading import RLock

from .models import utc_now


@dataclass
class DevicePairing:
    device_id: str
    token_hash: str
    salt: str
    paired_at: str = field(default_factory=lambda: utc_now().isoformat())

    def public_dict(self) -> dict:
        return {
            "device_id": self.device_id,
            "paired_at": self.paired_at,
            "token_configured": True,
        }


class DevicePairingStore:
    def __init__(
        self,
        path: str | Path | None = None,
        require_token: bool = False,
    ) -> None:
        self._path = Path(path) if path else None
        self._require_token = require_token
        self._pairings: dict[str, DevicePairing] = {}
        self._lock = RLock()
        self._load()

    @property
    def require_token(self) -> bool:
        return self._require_token

    def pair(self, device_id: str, token: str) -> DevicePairing:
        if not token:
            raise ValueError("token must not be empty")
        salt = secrets.token_hex(16)
        pairing = DevicePairing(
            device_id=device_id,
            token_hash=self._hash_token(token, salt),
            salt=salt,
        )
        with self._lock:
            self._pairings[device_id] = pairing
            self._persist()
            return pairing

    def verify(self, device_id: str, token: str | None) -> bool:
        with self._lock:
            pairing = self._pairings.get(device_id)
            if not pairing:
                return not self._require_token
            if not token:
                return False
            expected = pairing.token_hash
            actual = self._hash_token(token, pairing.salt)
            return hmac.compare_digest(actual, expected)

    def is_paired(self, device_id: str) -> bool:
        with self._lock:
            return device_id in self._pairings

    def list_pairings(self) -> list[dict]:
        with self._lock:
            return [pairing.public_dict() for pairing in self._pairings.values()]

    def clear(self) -> None:
        with self._lock:
            self._pairings.clear()
            self._persist()

    def _load(self) -> None:
        if not self._path or not self._path.exists():
            return
        data = json.loads(self._path.read_text(encoding="utf-8"))
        for item in data.get("pairings", []):
            pairing = DevicePairing(**item)
            self._pairings[pairing.device_id] = pairing

    def _persist(self) -> None:
        if not self._path:
            return
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "pairings": [asdict(pairing) for pairing in self._pairings.values()]
        }
        temp_path = self._path.with_suffix(f"{self._path.suffix}.tmp")
        temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        temp_path.replace(self._path)

    @staticmethod
    def _hash_token(token: str, salt: str) -> str:
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            token.encode("utf-8"),
            salt.encode("utf-8"),
            120_000,
        )
        return digest.hex()

