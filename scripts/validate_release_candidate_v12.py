#!/usr/bin/env python3
from pathlib import Path
import argparse,json,re,subprocess

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument("--git",action="store_true")
args=parser.parse_args()

rc=json.loads((ROOT/"data/release-candidate-v12.json").read_text("utf-8"))
qa=json.loads((ROOT/"data/release-qa-v12.json").read_text("utf-8"))
freeze=json.loads((ROOT/"data/release-freeze-v12.json").read_text("utf-8"))
versions=json.loads((ROOT/"data/version-contract.json").read_text("utf-8"))
errors=[]

def err(msg):
    errors.append(msg)

if rc.get("schema")!=1: err("V1.2 RC: schema deve ser 1")
if rc.get("candidate")!="1.2.0-rc.1": err("V1.2 RC: candidate divergente")
if rc.get("targetRelease")!="1.2.0": err("V1.2 RC: targetRelease divergente")
if rc.get("candidateBranch")!="release/v1.2.0-rc1": err("V1.2 RC: branch candidata divergente")
if rc.get("baselineRelease")!="1.1.0": err("V1.2 RC: baselineRelease divergente")
if rc.get("runtimeProductVersion")!="1.1.0": err("V1.2 RC: runtimeProductVersion deve permanecer 1.1.0")
if rc.get("featureFreeze") is not True: err("V1.2 RC: featureFreeze deve estar ativo")

freeze_sha=str(rc.get("functionalFreezeSha") or "")
baseline_sha=str(rc.get("baselineSha") or "")
source_sha=str(rc.get("developmentSourceSha") or "")
for label,sha in (("functionalFreezeSha",freeze_sha),("baselineSha",baseline_sha),("developmentSourceSha",source_sha)):
    if not re.fullmatch(r"[0-9a-f]{40}",sha):
        err(f"V1.2 RC: {label} inválido")

if freeze.get("functionalFreezeSha")!=freeze_sha:
    err("V1.2 RC: freeze diverge do manifesto")
if freeze.get("baselineSha")!=baseline_sha:
    err("V1.2 RC: baseline diverge do manifesto")
if qa.get("candidate")!=rc.get("candidate") or qa.get("targetRelease")!=rc.get("targetRelease"):
    err("V1.2 RC: QA aponta para outro candidato/release")

if versions.get("productBaseline")!="1.1.0" or versions.get("releaseStatus")!="released":
    err("V1.2 RC: contrato público deve permanecer 1.1.0/released")
if versions.get("releaseSha")!=baseline_sha:
    err("V1.2 RC: releaseSha público deve continuar na baseline V1.1.0")

runtime=(ROOT/"assets/js/pa-data-v03.js").read_text("utf-8",errors="replace")
m=re.search(r"const RELEASE=['\"]([^'\"]+)['\"]",runtime)
if not m or m.group(1)!="1.1.0":
    err("V1.2 RC: runtime RELEASE deve permanecer 1.1.0")

manual={x.get("id"):x for x in (qa.get("manual") or []) if isinstance(x,dict)}
blockers=list(rc.get("manualBlockers") or [])
required={k for k,v in manual.items() if v.get("required")}
if set(blockers)!=required:
    err("V1.2 RC: manualBlockers divergem dos checks obrigatórios")
pending=[k for k in blockers if manual.get(k,{}).get("status")!="approved"]
if rc.get("status")=="manual-qa-pending" and not pending:
    err("V1.2 RC: status manual-qa-pending sem pendências")
if rc.get("status")!="manual-qa-pending" and pending:
    err("V1.2 RC: status avançado com QA pendente")

allowed=set(rc.get("allowedPostFreezePaths") or [])
if allowed!=set(freeze.get("allowedPostFreezePaths") or []):
    err("V1.2 RC: allowlist diverge do freeze")
required_allowed={
    ".github/workflows/rc-gate-v12.yml",
    ".github/workflows/release-gate-v12.yml",
    "data/release-candidate-v12.json",
    "data/release-qa-v12.json",
    "docs/V1.2_RELEASE_NOTES.md",
    "docs/V1.2_RELEASE_QA.md",
    "scripts/validate_release_candidate_v12.py",
    "scripts/validate_release_qa_v12.py",
}
missing=sorted(required_allowed-allowed)
if missing:
    err("V1.2 RC: allowlist incompleta: "+", ".join(missing))

notes=(ROOT/"docs/V1.2_RELEASE_NOTES.md").read_text("utf-8",errors="replace")
for token in ("V1.2.0","Safety Rails","PWA","Mapas","Portal","80%","125%","150%"):
    if token not in notes:
        err(f"V1.2 RC: release notes não documentam {token}")

if args.git:
    try:
        for sha in (freeze_sha,baseline_sha,source_sha):
            subprocess.run(["git","cat-file","-e",sha+"^{commit}"],cwd=ROOT,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        if subprocess.run(["git","merge-base","--is-ancestor",freeze_sha,"HEAD"],cwd=ROOT).returncode!=0:
            err("V1.2 RC: HEAD não descende do functionalFreezeSha")
        diff=subprocess.run(["git","diff","--name-only",freeze_sha+"...HEAD"],cwd=ROOT,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True).stdout.splitlines()
        changed={x.strip() for x in diff if x.strip()}
        forbidden=sorted(changed-allowed)
        if forbidden:
            err("V1.2 RC: mudança não autorizada após freeze: "+", ".join(forbidden))
    except subprocess.CalledProcessError as exc:
        err("V1.2 RC: histórico Git indisponível: "+(exc.stderr or str(exc)).strip())

if errors:
    for e in errors:
        print("ERRO:",e)
    raise SystemExit(1)

print(json.dumps({
    "ok":True,
    "candidate":rc.get("candidate"),
    "targetRelease":rc.get("targetRelease"),
    "status":rc.get("status"),
    "functionalFreezeSha":freeze_sha,
    "manualPending":pending,
    "runtimeProductVersion":"1.1.0",
    "gitChecked":args.git,
    "allowedPostFreezePaths":len(allowed)
},ensure_ascii=False,indent=2))
