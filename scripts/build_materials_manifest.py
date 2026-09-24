#!/usr/bin/env python3
from pathlib import Path
from html.parser import HTMLParser
import json, re, unicodedata

ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ROOT / "materials"
OUT_JSON = ROOT / "data" / "materials.json"
OUT_JS = ROOT / "data" / "materials.js"
PLACEHOLDER = re.compile(r"\[\[[^\]]+\]\]")
VERSION_RX = re.compile(r"V(\d+)", re.I)

class MaterialParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta = {}
        self.title = ""
        self._in_title = False
        self.topic_count = 0
        self.branch_count = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        tag = tag.lower()
        if tag == "meta" and a.get("name"):
            self.meta[a["name"]] = a.get("content", "")
        elif tag == "title":
            self._in_title = True
        classes = set((a.get("class") or "").split())
        if "topic-card" in classes:
            self.topic_count += 1
        if "branch-card" in classes:
            self.branch_count += 1

    def handle_endtag(self, tag):
        if tag.lower() == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data

def usable(v):
    v = " ".join((v or "").split())
    return v if v and not PLACEHOLDER.search(v) else ""

def slug(v):
    v = unicodedata.normalize("NFD", v or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", v).strip("-")

def version_number(v, filename):
    m = VERSION_RX.search(v or "") or VERSION_RX.search(filename)
    return int(m.group(1)) if m else 0

raw = []
for p in sorted(MATERIALS.glob("*.html")):
    parser = MaterialParser()
    parser.feed(p.read_text(encoding="utf-8", errors="ignore"))
    m = parser.meta
    storage_id = usable(m.get("mindmap-storage-id"))
    fallback_id = slug(" ".join(filter(None, [
        usable(m.get("study-short-code")),
        usable(m.get("study-short-title")),
    ]))) or slug(p.stem)
    material_id = storage_id or fallback_id
    version = usable(m.get("study-file-version"))
    raw.append({
        "id": material_id,
        "storageNamespace": slug(material_id),
        "src": "materials/" + p.name,
        "filename": p.name,
        "title": usable(m.get("study-display-title")) or usable(m.get("study-short-title")) or usable(parser.title) or p.stem,
        "shortTitle": usable(m.get("study-short-title")),
        "shortCode": usable(m.get("study-short-code")),
        "emoji": usable(m.get("study-title-emoji")),
        "version": version,
        "versionNumber": version_number(version, p.name),
        "board": usable(m.get("study-exam-board")),
        "contest": usable(m.get("study-exam-contest")),
        "group": usable(m.get("study-library-group")) or "Outros",
        "order": usable(m.get("study-library-order")),
        "bridge": usable(m.get("plano-arq-bridge-version")) or None,
        "sourceTemplate": usable(m.get("plano-arq-source-template")),
        "legacyStorageId": usable(m.get("plano-arq-legacy-storage-id")),
        "topicCount": parser.topic_count,
        "branchCount": parser.branch_count,
        "contestId": usable(m.get("plano-arq-contest-id")) or "demhab-poa-arquiteto-2026",
    })

grouped = {}
for item in raw:
    grouped.setdefault(item["id"], []).append(item)

materials = []
for material_id, versions in grouped.items():
    versions.sort(key=lambda x: (x["versionNumber"], x["filename"].lower()))
    latest = dict(versions[-1])
    latest["versions"] = [
        {"version": v["version"], "versionNumber": v["versionNumber"], "src": v["src"], "filename": v["filename"]}
        for v in reversed(versions)
    ]
    latest["versionCount"] = len(versions)
    materials.append(latest)

materials.sort(key=lambda x: (
    x.get("group","").lower(),
    x.get("order") or "9999",
    x.get("title","").lower()
))

payload = {"schema": 2, "materials": materials}
OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
OUT_JS.write_text("window.PLANO_ARQ_MATERIALS=" + json.dumps(payload, ensure_ascii=False) + ";\n", encoding="utf-8")
print(f"{len(materials)} material(is) ativo(s), {len(raw)} arquivo(s) HTML -> {OUT_JSON}")
