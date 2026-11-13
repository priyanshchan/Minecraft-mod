#!/usr/bin/env python3
"""Runs the script logic (rpg.js + main.js) against a small mock of the game API.

It checks levelling, party XP, stat points, classes, quests, mana, the melee
bonus and save/load without needing Minecraft.  Requires Node.js 18+.

Usage:  python3 tools/test_rpg.py
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SIM = ROOT / "tools" / "sim"


def main():
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        (work / "package.json").write_text('{"type":"module"}')
        for script in (ROOT / "behavior_pack" / "scripts").glob("*.js"):
            shutil.copy(script, work / script.name)
        shutil.copy(SIM / "test.js", work / "test.js")
        for module, source in (("server", "server.js"), ("server-ui", "server-ui.js")):
            target = work / "node_modules" / "@minecraft" / module
            target.mkdir(parents=True)
            shutil.copy(SIM / source, target / "index.js")
            (target / "package.json").write_text(
                '{"name":"@minecraft/%s","type":"module","main":"index.js"}' % module)
        return subprocess.call(["node", "test.js"], cwd=work)


if __name__ == "__main__":
    sys.exit(main())
