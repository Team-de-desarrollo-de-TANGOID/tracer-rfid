#!/usr/bin/env python3
"""Build .deb for FX9600 User App without dpkg-deb (works on Windows)."""
from __future__ import annotations

import io
import os
import shutil
import stat
import tarfile
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PKG = ROOT / "pkg"
CONTROL = PKG / "DEBIAN" / "control"
FILES = [
    "racketclub_gate.py",
    "racketclub-gate",
    "RestAPI.py",
    "Logger.py",
    "INIFile.py",
    "AllowList.py",
    "Secrets.py",
    "UserAppServer.py",
    "config.ini",
    "start_racketclub-gate.sh",
    "stop_racketclub-gate.sh",
]


def _read_version() -> str:
    text = CONTROL.read_text(encoding="utf-8")
    for line in text.splitlines():
        if line.startswith("Version:"):
            return line.split(":", 1)[1].strip()
    return "0.0.0"


def _normalize_text(path: Path) -> None:
    data = path.read_bytes()
    path.write_bytes(data.replace(b"\r\n", b"\n").replace(b"\r", b"\n"))


def _tar_gz(members: list[tuple[str, bytes, int]]) -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        dir_info = tarfile.TarInfo(name=".")
        dir_info.type = tarfile.DIRTYPE
        dir_info.mode = 0o755
        tar.addfile(dir_info)
        for name, payload, mode in members:
            info = tarfile.TarInfo(name=f"./{name}")
            info.size = len(payload)
            info.mode = mode
            tar.addfile(info, io.BytesIO(payload))
    return buf.getvalue()


def _ar_member(name: str, payload: bytes) -> bytes:
    size = len(payload)
    header = f"{name:<16}{0:<12}{0:<6}{0:<6}{0o100644:<8}{size:<10}`\n"
    if len(header) != 60:
        raise RuntimeError(f"bad ar header len {len(header)}")
    out = header.encode("ascii") + payload
    if size % 2:
        out += b"\n"
    return out


def build_deb(out_path: Path) -> Path:
    with tempfile.TemporaryDirectory() as tmp:
        staging = Path(tmp) / "staging"
        staging.mkdir()
        for fname in FILES:
            shutil.copy2(PKG / fname, staging / fname)
        for path in staging.iterdir():
            _normalize_text(path)
            if path.suffix in {".sh", ".py"} or path.name == "racketclub-gate":
                path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

        control_payload = CONTROL.read_bytes().replace(b"\r\n", b"\n").replace(b"\r", b"\n")
        data_members = []
        for path in sorted(staging.iterdir()):
            mode = path.stat().st_mode & 0o777
            data_members.append((path.name, path.read_bytes(), mode))

        debian_binary = b"2.0\n"
        control_tar = _tar_gz([("control", control_payload, 0o644)])
        data_tar = _tar_gz(data_members)

        ar_body = b"!<arch>\n"
        ar_body += _ar_member("debian-binary", debian_binary)
        ar_body += _ar_member("control.tar.gz", control_tar)
        ar_body += _ar_member("data.tar.gz", data_tar)

        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(ar_body)
    return out_path


if __name__ == "__main__":
    version = _read_version()
    out = ROOT / f"racketclub-gate_{version}_all.deb"
    build_deb(out)
    print(f"Built {out}")
