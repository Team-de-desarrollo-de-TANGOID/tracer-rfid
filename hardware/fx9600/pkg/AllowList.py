import json
import os
import threading
import time


def normalize_tid(tid):
    """
    Uppercase hex TID and strip trailing zero-bytes (00) that FX9600/LLRP
    often pads when Tid_Word_Count exceeds the tag's meaningful TID length.
    Keeps at least 8 hex chars (4 bytes).
    """
    t = str(tid or "").upper().strip()
    if not t:
        return ""
    while len(t) >= 10 and t.endswith("00"):
        t = t[:-2]
    return t


def tids_equivalent(a, b):
    """True if TIDs match after normalizing padding zeros."""
    na = normalize_tid(a)
    nb = normalize_tid(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    longer, shorter = (na, nb) if len(na) >= len(nb) else (nb, na)
    suffix = longer[len(shorter) :]
    return longer.startswith(shorter) and suffix and set(suffix) <= {"0"}


class AllowList:
    """Lista local de TIDs restringidos (activos en club que no pueden salir)."""

    def __init__(self, path=None):
        self._path = path or os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "racketclub_allowlist.json"
        )
        self._lock = threading.RLock()
        self._tids = set()
        self._version = 0
        self._gpo_pin = 1
        self._updated_at = None
        self._loaded_mtime = None
        self.load()

    def _file_mtime(self):
        try:
            return os.path.getmtime(self._path)
        except OSError:
            return None

    def _reload_if_changed(self):
        mtime = self._file_mtime()
        if mtime is None:
            return
        if self._loaded_mtime is None or mtime > self._loaded_mtime:
            self.load()

    def load(self):
        with self._lock:
            if not os.path.exists(self._path):
                self._loaded_mtime = self._file_mtime()
                return
            try:
                with open(self._path, encoding="utf-8") as f:
                    data = json.load(f)
            except (OSError, json.JSONDecodeError):
                return
            self._tids = {
                normalize_tid(t)
                for t in (data.get("tids") or [])
                if normalize_tid(t)
            }
            self._version = int(data.get("version") or 0)
            self._gpo_pin = int(data.get("gpoPin") or data.get("gpo_pin") or 1)
            self._updated_at = data.get("updatedAt")
            self._loaded_mtime = self._file_mtime()

    def _save_unlocked(self):
        payload = {
            "tids": sorted(self._tids),
            "version": self._version,
            "gpoPin": self._gpo_pin,
            "updatedAt": self._updated_at,
            "count": len(self._tids),
        }
        tmp = self._path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
        os.replace(tmp, self._path)

    def contains(self, tid):
        if not tid:
            return False
        needle = normalize_tid(tid)
        if not needle:
            return False
        with self._lock:
            if needle in self._tids:
                return True
            for stored in self._tids:
                if tids_equivalent(needle, stored):
                    return True
            return False

    def sync(self, tids, version, gpo_pin=None):
        incoming = {normalize_tid(t) for t in (tids or []) if normalize_tid(t)}
        with self._lock:
            before = set(self._tids)
            self._tids = incoming
            self._version = int(version or 0)
            if gpo_pin is not None:
                self._gpo_pin = int(gpo_pin)
            self._updated_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            added = sorted(incoming - before)
            removed = sorted(before - incoming)
            self._save_unlocked()
            return {
                "count": len(self._tids),
                "version": self._version,
                "gpoPin": self._gpo_pin,
                "added": added,
                "removed": removed,
                "updatedAt": self._updated_at,
            }

    def snapshot(self):
        with self._lock:
            self._reload_if_changed()
            return {
                "tids": sorted(self._tids),
                "count": len(self._tids),
                "version": self._version,
                "gpoPin": self._gpo_pin,
                "updatedAt": self._updated_at,
            }
