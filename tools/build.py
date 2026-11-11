#!/usr/bin/env python3
"""Packages the add-on into dist/Overlord_Tomb_of_Nazarick.mcaddon.

The archive is deterministic (fixed timestamps, sorted entries) so rebuilding
without changes yields a byte-identical file.

Usage:  python3 tools/build.py        (runs the validator first)
"""
from __future__ import annotations

import json
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
NAME = "Overlord_Tomb_of_Nazarick"
PACKS = {"behavior_pack": f"{NAME}_BP", "resource_pack": f"{NAME}_RP"}
STAMP = (2026, 1, 1, 0, 0, 0)


def main():
    if subprocess.call([sys.executable, str(ROOT / "tools" / "validate.py")]) != 0:
        print("validation failed - not packaging")
        return 1
    DIST.mkdir(exist_ok=True)
    target = DIST / f"{NAME}.mcaddon"
    count = 0
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for folder, arc in PACKS.items():
            for f in sorted((ROOT / folder).rglob("*")):
                if not f.is_file() or "node_modules" in f.parts or f.name.startswith("."):
                    continue
                info = zipfile.ZipInfo(f"{arc}/{f.relative_to(ROOT / folder).as_posix()}", STAMP)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                z.writestr(info, f.read_bytes())
                count += 1
    with zipfile.ZipFile(target) as z:
        assert z.testzip() is None
        for arc in PACKS.values():
            manifest = json.loads(z.read(f"{arc}/manifest.json"))
            assert manifest["format_version"] == 2
            assert f"{arc}/pack_icon.png" in z.namelist()
    print(f"wrote {target.relative_to(ROOT)} ({count} files, {target.stat().st_size / 1024:.0f} KiB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
