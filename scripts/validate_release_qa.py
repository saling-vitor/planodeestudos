#!/usr/bin/env python3
from pathlib import Path
import argparse,json,re

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument("--release",action="store_true",help="exige aprovação de todos os checks manuais")
args=parser.parse_args()
path=ROOT/"data/release-qa-v11.json"
data=json.loads(path.read_text("utf-8"))
errors=[]
if data.get("schema")!=1: errors.append("schema do release QA deve ser 1")
if data.get("targetRelease")!="1.1.0": errors.append("targetRelease deve ser 1.1.0")
required_ids={"chrome-zoom-80","chrome-zoom-125","chrome-zoom-150"}
manual=data.get("manual") or []
ids={x.get("id") for x in manual if isinstance(x,dict)}
missing=required_ids-ids
if missing: errors.append("checks manuais ausentes: "+", ".join(sorted(missing)))
for row in manual:
    if not isinstance(row,dict): continue
    if row.get("status") not in {"pending","approved"}:
        errors.append(f"{row.get('id')}: status inválido {row.get('status')!r}")
    if row.get("required") is not True:
        errors.append(f"{row.get('id')}: check de zoom deve ser obrigatório")
    if args.release and row.get("required"):
        if row.get("status")!="approved":
            errors.append(f"{row.get('id')}: pendente para release")
        if not row.get("checkedAt") or not re.match(r"^\d{4}-\d{2}-\d{2}T",str(row.get("checkedAt"))):
            errors.append(f"{row.get('id')}: checkedAt ausente/inválido")
        if len(str(row.get("evidence") or "").strip())<5:
            errors.append(f"{row.get('id')}: evidência manual ausente")

doc=(ROOT/"docs/V1.1_RELEASE_QA.md").read_text("utf-8",errors="replace")
for pct in ("80%","125%","150%"):
    if pct not in doc: errors.append(f"documentação de QA não contém zoom {pct}")

if errors:
    for e in errors: print("ERRO:",e)
    raise SystemExit(1)

print(json.dumps({
    "ok":True,
    "mode":"release" if args.release else "development",
    "targetRelease":data.get("targetRelease"),
    "manual":[{"id":x.get("id"),"status":x.get("status")} for x in manual],
    "releaseReady":all(x.get("status")=="approved" for x in manual if x.get("required"))
},ensure_ascii=False,indent=2))
