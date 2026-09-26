#!/usr/bin/env python3
from pathlib import Path
import argparse,json,re,subprocess

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument("--git",action="store_true",help="valida o diff real após o functional freeze")
args=parser.parse_args()

data=json.loads((ROOT/"data/release-freeze-v12.json").read_text("utf-8"))
errors=[]

def err(msg):
    errors.append(msg)

if data.get("schema")!=1:
    err("V1.2 freeze: schema deve ser 1")
if data.get("cycle")!="V1.2":
    err("V1.2 freeze: cycle divergente")
if data.get("targetRelease")!="1.2.0":
    err("V1.2 freeze: targetRelease deve ser 1.2.0")
if data.get("baselineRelease")!="1.1.0":
    err("V1.2 freeze: baselineRelease deve ser 1.1.0")
if data.get("developmentBranch")!="develop/v1.2":
    err("V1.2 freeze: developmentBranch divergente")
if data.get("featureFreeze") is not True:
    err("V1.2 freeze: featureFreeze deve estar ativo")
if data.get("status")!="functional-freeze":
    err("V1.2 freeze: status deve ser functional-freeze")

freeze=str(data.get("functionalFreezeSha") or "")
baseline=str(data.get("baselineSha") or "")
if not re.fullmatch(r"[0-9a-f]{40}",freeze):
    err("V1.2 freeze: functionalFreezeSha inválido")
if not re.fullmatch(r"[0-9a-f]{40}",baseline):
    err("V1.2 freeze: baselineSha inválido")

gate=data.get("functionalFreezeGate") or {}
if gate.get("workflow")!="Validar desenvolvimento":
    err("V1.2 freeze: workflow do gate divergente")
if gate.get("run")!=11:
    err("V1.2 freeze: run do gate divergente")
if gate.get("status")!="success":
    err("V1.2 freeze: gate funcional não está success")
if gate.get("sha")!=freeze:
    err("V1.2 freeze: gate não aponta para functionalFreezeSha")

runtime=(ROOT/"assets/js/pa-data-v03.js").read_text("utf-8",errors="replace")
sw=(ROOT/"service-worker.js").read_text("utf-8",errors="replace")
release=re.search(r"const RELEASE=['\"]([^'\"]+)['\"]",runtime)
if not release or release.group(1)!=data.get("runtimeProductVersion"):
    err("V1.2 freeze: versão runtime diverge da baseline declarada")
if "const BUILD_MAINTENANCE=false;" not in runtime:
    err("V1.2 freeze: BUILD_MAINTENANCE deve estar false")
if "const MAINTENANCE_MODE=false;" not in sw:
    err("V1.2 freeze: MAINTENANCE_MODE deve estar false")

allowed=set(data.get("allowedPostFreezePaths") or [])
required={
    ".github/workflows/validate-development.yml",
    ".github/workflows/rc-gate-v12.yml",
    ".github/workflows/release-gate-v12.yml",
    "data/release-freeze-v12.json",
    "data/release-candidate-v12.json",
    "data/release-qa-v12.json",
    "docs/V1.2.md",
    "docs/V1.2_BACKLOG.md",
    "scripts/validate_release_freeze_v12.py",
    "scripts/validate_release_candidate_v12.py",
    "scripts/validate_release_qa_v12.py",
    "assets/js/pa-data-v03.js",
    "data/cloud-config.json",
    "scripts/validate_production.py",
    "docs/RELEASE.md",
}
missing=sorted(required-allowed)
if missing:
    err("V1.2 freeze: allowlist incompleta: "+", ".join(missing))

if args.git:
    try:
        for sha,label in ((freeze,"freeze"),(baseline,"baseline")):
            subprocess.run(
                ["git","cat-file","-e",sha+"^{commit}"],
                cwd=ROOT,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True
            )
        ancestor=subprocess.run(
            ["git","merge-base","--is-ancestor",baseline,freeze],
            cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True
        )
        if ancestor.returncode!=0:
            err("V1.2 freeze: functionalFreezeSha não descende da baseline V1.1.0")

        diff=subprocess.run(
            ["git","diff","--name-only",freeze+"...HEAD"],
            cwd=ROOT,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True
        ).stdout.splitlines()
        changed={x.strip() for x in diff if x.strip()}
        forbidden=sorted(changed-allowed)
        if forbidden:
            err("V1.2 freeze: mudança não autorizada após freeze: "+", ".join(forbidden))
    except subprocess.CalledProcessError as exc:
        err("V1.2 freeze: histórico Git indisponível; checkout deve usar fetch-depth 0: "+(exc.stderr or str(exc)).strip())

if errors:
    for item in errors:
        print("ERRO:",item)
    raise SystemExit(1)

print(json.dumps({
    "ok":True,
    "cycle":data.get("cycle"),
    "targetRelease":data.get("targetRelease"),
    "baselineRelease":data.get("baselineRelease"),
    "functionalFreezeSha":freeze,
    "featureFreeze":True,
    "gate":gate,
    "gitChecked":args.git,
    "allowedPostFreezePaths":len(allowed)
},ensure_ascii=False,indent=2))
