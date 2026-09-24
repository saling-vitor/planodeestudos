#!/usr/bin/env python3
from pathlib import Path
import json, re

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "files.json"
OUT_JS = ROOT / "data" / "files.js"
META = ROOT / "data" / "files-meta.json"

SCAN_DIRS = ["edital", "documents"]
EXTS = {".pdf",".doc",".docx",".xls",".xlsx",".csv",".txt",".md",".png",".jpg",".jpeg",".webp"}

def slug(s):
    s = re.sub(r"[^a-zA-Z0-9]+","-",str(s)).strip("-").lower()
    return s or "arquivo"

def infer_category(name):
    n=name.lower()
    if "retif" in n: return "Retificação"
    if "edital" in n: return "Edital"
    if "comunic" in n or "aviso" in n: return "Comunicado"
    if "cronograma" in n: return "Cronograma"
    if "gabarito" in n: return "Gabarito"
    if "resultado" in n: return "Resultado"
    if "anexo" in n: return "Anexo"
    return "Apoio"

def title_from_name(stem):
    s=re.sub(r"[_-]+"," ",stem)
    s=re.sub(r"\s+"," ",s).strip()
    return s[:1].upper()+s[1:]

meta={}
if META.exists():
    try: meta=json.loads(META.read_text(encoding="utf-8"))
    except Exception: meta={}
overrides=meta.get("files",{}) if isinstance(meta,dict) else {}

extra_fields = [
    "disclosureDate","protocol","process","sourceTitle","sourceUrl",
    "supersedes","supersededBy","notes"
]

rows=[]
for folder in SCAN_DIRS:
    base=ROOT/folder
    if not base.exists(): continue
    for p in sorted(base.rglob("*")):
        if not p.is_file() or p.suffix.lower() not in EXTS: continue
        if p.name.lower().startswith("readme") or any(part.startswith(".") for part in p.relative_to(ROOT).parts): continue
        rel=p.relative_to(ROOT).as_posix()
        o=overrides.get(rel,{})
        default_id=slug(str(p.relative_to(ROOT).with_suffix("")))
        row={
            "id": o.get("id",default_id),
            "contestId": o.get("contestId","demhab-poa-arquiteto-2026"),
            "path": rel,
            "filename": p.name,
            "title": o.get("title",title_from_name(p.stem)),
            "shortTitle": o.get("shortTitle",o.get("title",title_from_name(p.stem))),
            "category": o.get("category",infer_category(p.name)),
            "type": p.suffix.lower().lstrip("."),
            "sizeBytes": p.stat().st_size,
            "official": bool(o.get("official", folder=="edital")),
            "status": o.get("status","vigente" if folder=="edital" else "ativo"),
            "version": o.get("version","—"),
            "organization": o.get("organization",""),
            "board": o.get("board",""),
            "date": o.get("date"),
            "description": o.get("description",""),
            "tags": o.get("tags",[]),
            "source": o.get("source","repository"),
            "linkedToEdital": bool(o.get("linkedToEdital",folder=="edital"))
        }
        for field in extra_fields:
            if field in o: row[field]=o[field]
        rows.append(row)

ids=[r["id"] for r in rows]
dups=sorted({x for x in ids if ids.count(x)>1})
if dups:
    raise SystemExit("IDs duplicados no manifesto: "+", ".join(dups))

order={"Edital":0,"Retificação":1,"Comunicado":2,"Cronograma":3,"Anexo":4,"Gabarito":5,"Resultado":6,"Apoio":7}
rows.sort(key=lambda r:(order.get(r.get("category"),99), 0 if r.get("status")=="vigente" else 1, r.get("date") or "9999-99-99", r.get("title","")))

payload={"schema":2,"files":rows}
OUT_JSON.parent.mkdir(parents=True,exist_ok=True)
OUT_JSON.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
OUT_JS.write_text("window.PLANO_ARQ_FILES="+json.dumps(payload,ensure_ascii=False)+";\n",encoding="utf-8")
print(f"{len(rows)} arquivo(s) indexado(s)")
