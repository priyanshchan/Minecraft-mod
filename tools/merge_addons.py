#!/usr/bin/env python3
"""Combines Overlord with other Bedrock add-ons into one .mcaddon, for your own worlds only.

Experimental (branch experimental-merge). It never stores or publishes anyone else's files: you pass the
add-ons in, and the combined file is written to dist/merged/, which git ignores.

    python3 -I tools/merge_addons.py [--set NAME] OUT.mcaddon OVERLORD.mcaddon OTHER.mcaddon [OTHER.mcaddon ...]

--set NAME makes a separate combined set (for example "hardcore" for the Hardcore build): its packs get ids and
names of their own, so it installs beside another combined set built from the same add-ons.

What it does:
- Every pack keeps its own folder and its own scripts. A pack can run only one version of the script API, and
  other add-ons are often written for an older one than Overlord's, so their packs are not poured into
  Overlord's: they ride along beside it.
- Each pack gets new ids (derived from its old ones, so a rebuild gives the same ids) and "(merged)" in its
  name, so the combined set installs beside any copies you already have.
- Overlord's behaviour pack depends on all the others, so turning Overlord on in a world turns the rest on.
- Files that two packs share by path, which would otherwise hide one another:
  - recipes are found by their identifiers, so Overlord's copy is just given another file name;
  - anything else is kept from the add-on given first on the command line and dropped from those after it
    (for example chest loot that two add-ons both replace).
  - Overlord itself must never lose a file: if one of its other files is shared, the merge stops.
- A subpack folder named "normal" is moved to the front, so it is the one a world starts with.
- Afterwards every manifest is checked: ids unique, every dependency present at the right version.
"""
from __future__ import annotations

import json
import re
import sys
import uuid
import zipfile
from pathlib import PurePosixPath

STAMP = (2026, 1, 1, 0, 0, 0)
SPACE = uuid.UUID("6f0a3c2e-8d5b-4c71-9e2a-5b7d1f4c8a90")  # the namespace merged ids are derived in
# Files the game merges across packs (or that belong to one pack only), never a clash.
MERGED = {"manifest.json", "pack_icon.png", "textures/item_texture.json", "textures/terrain_texture.json",
          "textures/flipbook_textures.json", "sounds.json", "sounds/sound_definitions.json",
          "sounds/music_definitions.json", "blocks.json", "ui/_ui_defs.json", "biomes_client.json",
          "texts/languages.json", "texts/language_names.json", "item_catalog/crafting_item_catalog.json"}


def lenient(raw: bytes):
    """JSON as Minecraft reads it: comments and trailing commas allowed."""
    text = raw.decode("utf-8-sig")
    text = re.sub(r'(?<![:"\\])//[^\n]*', "", text)
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r",\s*([}\]])", r"\1", text)
    return json.loads(text)


def shared_key(rel: str) -> str | None:
    """The path a file occupies in the game's view of all packs, or None when it cannot clash."""
    if rel.startswith("subpacks/"):
        rel = "/".join(rel.split("/")[2:])  # a subpack layers over its own pack
    if not rel or rel in MERGED or rel.startswith("scripts/") or (rel.startswith("texts/") and rel.endswith(".lang")):
        return None
    return rel


class Pack:
    def __init__(self, addon: str, folder: str, manifest: dict, files: dict[str, bytes]):
        self.addon, self.folder, self.manifest, self.files = addon, folder, manifest, files
        types = {m.get("type") for m in manifest.get("modules", [])}
        self.kind = "RP" if "resources" in types else "BP"

    @property
    def uuid(self):
        return self.manifest["header"]["uuid"]

    @property
    def version(self):
        return self.manifest["header"]["version"]


def read_addon(path: str, label: str) -> list[Pack]:
    """The packs inside an .mcaddon (or .zip), each with its files."""
    z = zipfile.ZipFile(path)
    groups: dict[str, dict[str, bytes]] = {}
    for info in z.infolist():
        if info.is_dir():
            continue
        name = PurePosixPath(info.filename)
        if name.is_absolute() or ".." in name.parts or len(name.parts) < 2:
            raise SystemExit(f"{path}: refusing odd entry {info.filename}")
        groups.setdefault(name.parts[0], {})["/".join(name.parts[1:])] = z.read(info)
    packs = []
    for folder, files in sorted(groups.items()):
        if "manifest.json" not in files:
            continue
        packs.append(Pack(label, folder, lenient(files["manifest.json"]), files))
    if not packs:
        raise SystemExit(f"{path}: no packs found")
    return packs


def new_id(old: str, tag: str = "") -> str:
    return str(uuid.uuid5(SPACE, f"merged:{tag + ':' if tag else ''}{old.lower()}"))


def merge(out: str, inputs: list[tuple[str, str]], tag: str = ""):
    addons = [(label, read_addon(path, label)) for label, path in inputs]
    overlord = addons[0][1]
    report = []

    # 1. Shared paths. Recipes: Overlord's copy is renamed. Anything else: the earlier add-on keeps it.
    owner: dict[str, tuple[str, str]] = {}
    for label, packs in addons[1:] + addons[:1]:  # Overlord last: it must not win by order alone
        for pack in packs:
            for rel in list(pack.files):
                key = shared_key(rel)
                if key is None:
                    continue
                slot = f"{pack.kind}:{key}"
                if slot not in owner or owner[slot] == (label, pack.folder):
                    owner[slot] = (label, pack.folder)  # a pack's subpacks may layer over its own files
                    continue
                if label == addons[0][0]:
                    if key.startswith("recipes/"):
                        renamed = rel.replace("recipes/", "recipes/overlord_", 1)
                        pack.files[renamed] = pack.files.pop(rel)
                        report.append(f"renamed Overlord's {rel} (also in {owner[slot][0]})")
                        continue
                    raise SystemExit(f"Overlord's {rel} is also in {owner[slot][0]}: resolve this by hand")
                del pack.files[rel]
                report.append(f"dropped {label}'s {rel} (kept {owner[slot][0]}'s)")

    # 2. New ids and names; "normal" subpacks first; Overlord depends on every other behaviour pack.
    remap = {}
    for _label, packs in addons:
        for pack in packs:
            remap[pack.uuid] = new_id(pack.uuid, tag)
            for module in pack.manifest.get("modules", []):
                remap[module["uuid"]] = new_id(module["uuid"], tag)
    for label, packs in addons:
        for pack in packs:
            header = pack.manifest["header"]
            header["uuid"] = remap[header["uuid"]]
            for module in pack.manifest.get("modules", []):
                module["uuid"] = remap[module["uuid"]]
            for dep in pack.manifest.get("dependencies", []):
                if "uuid" in dep and dep["uuid"] in remap:
                    dep["uuid"] = remap[dep["uuid"]]
            name = header.get("name", pack.folder)
            if name == "pack.name":  # named in its language file
                name = pack.folder
            mark = f" (merged, {tag})" if tag else " (merged)"
            header["name"] = re.sub(r"(\s*\[(BP|RP)\])?$", lambda m: f"{mark}{m.group(0)}", name, count=1)
            subs = pack.manifest.get("subpacks")
            if subs:
                subs.sort(key=lambda s: s.get("folder_name") != "normal")
    for pack in overlord:
        if pack.kind != "BP":
            continue
        deps = pack.manifest.setdefault("dependencies", [])
        for _label, packs in addons[1:]:
            for other in packs:
                if other.kind == "BP":
                    deps.append({"uuid": other.uuid, "version": other.version})
        engines = [p.manifest["header"].get("min_engine_version", [1, 0, 0]) for _l, ps in addons for p in ps]
        pack.manifest["header"]["min_engine_version"] = max(engines)

    # 3. Check the set before writing it.
    every = [p for _l, ps in addons for p in ps]
    seen = set()
    for pack in every:
        for u in [pack.uuid] + [m["uuid"] for m in pack.manifest.get("modules", [])]:
            assert u not in seen, f"duplicate id {u}"
            seen.add(u)
    for pack in every:
        for dep in pack.manifest.get("dependencies", []):
            if "uuid" in dep:
                target = next((p for p in every if p.uuid == dep["uuid"]), None)
                assert target is not None, f"{pack.folder}: missing dependency {dep['uuid']}"
                assert list(target.version) == list(dep["version"]), f"{pack.folder}: wants {dep['version']} of {target.folder}"

    # 4. Write it.
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for label, packs in addons:
            for pack in packs:
                arc = f"{label}_{pack.kind}"
                pack.files["manifest.json"] = json.dumps(pack.manifest, indent=2, ensure_ascii=False).encode("utf-8")
                for rel in sorted(pack.files):
                    info = zipfile.ZipInfo(f"{arc}/{rel}", STAMP)
                    info.compress_type = zipfile.ZIP_DEFLATED
                    info.external_attr = 0o644 << 16
                    z.writestr(info, pack.files[rel])
    with zipfile.ZipFile(out) as z:
        assert z.testzip() is None
    return every, report


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        return 1
    args = sys.argv[1:]
    tag = ""
    if args[:1] == ["--set"]:
        tag, args = re.sub(r"[^a-z0-9]+", "-", args[1].lower()).strip("-"), args[2:]
    if len(args) < 3:
        print(__doc__)
        return 1
    out, paths = args[0], args[1:]
    labels = ["Overlord"] + [re.sub(r"[^A-Za-z0-9]+", "", PurePosixPath(p).stem.split("-", 1)[-1])[:24] or f"Addon{i}"
                             for i, p in enumerate(paths[1:], 1)]
    every, report = merge(out, list(zip(labels, paths)), tag)
    for line in report:
        print(" ", line)
    for pack in every:
        h = pack.manifest["header"]
        print(f"  {pack.kind} {h['name']}  {'.'.join(map(str, h['version']))}  {h['uuid']}")
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
