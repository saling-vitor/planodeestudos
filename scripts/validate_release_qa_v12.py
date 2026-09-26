#!/usr/bin/env python3
from pathlib import Path
import argparse,json,re

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument("--release",action="store_true")
args=parser.parse_args()

data=json.loads((ROOT/"data/release-qa-v12.json").read_text("utf-8"))
errors=[]
required_ids={"chrome-zoom-80","chrome-zoom-125","chrome-zoom-150"}

if data.get("schema")!=1:
    errors.append("V1.2 QA: schema deve ser 1")
if data.get("candidate")!="1.2.0-rc.1":
    errors.append("V1.2 QA: candidate divergente")
if data.get("targetRelease")!="1.2.0":
    errors.append("V1.2 QA: targetRelease deve ser 1.2.0")

manual=[x for x in (data.get("manual") or []) if isinstance(x,dict)]
ids={x.get("id") for x in manual}
missing=required_ids-ids
if missing:
    errors.append("V1.2 QA: checks manuais ausentes: "+", ".join(sorted(missing)))

for row in manual:
    rid=row.get("id")
    if rid in required_ids and row.get("required") is not True:
        errors.append(f"V1.2 QA: {rid} deve ser obrigatório")
    if row.get("status") not in {"pending","approved"}:
        errors.append(f"V1.2 QA: {rid} status inválido {row.get('status')!r}")
    if args.release and row.get("required"):
        if row.get("status")!="approved":
            errors.append(f"V1.2 QA: {rid} pendente para release")
        if not re.match(r"^\d{4}-\d{2}-\d{2}T",str(row.get("checkedAt") or "")):
            errors.append(f"V1.2 QA: {rid} checkedAt ausente/inválido")
        if len(str(row.get("evidence") or "").strip())<5:
            errors.append(f"V1.2 QA: {rid} evidência ausente")

doc=(ROOT/"docs/V1.2_RELEASE_QA.md").read_text("utf-8",errors="replace")
for token in ("80%","125%","150%","biblioteca.html","configuracoes.html"):
    if token not in doc:
        errors.append(f"V1.2 QA: documentação não contém {token}")

if errors:
    for e in errors:
        print("ERRO:",e)
    raise SystemExit(1)

print(json.dumps({
    "ok":True,
    "mode":"release" if args.release else "rc",
    "candidate":data.get("candidate"),
    "targetRelease":data.get("targetRelease"),
    "manual":[{"id":x.get("id"),"status":x.get("status")} for x in manual],
    "releaseReady":all(x.get("status")=="approved" for x in manual if x.get("required"))
},ensure_ascii=False,indent=2))
