#!/usr/bin/env python3
from pathlib import Path
import argparse, json, re, subprocess

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument("--git",action="store_true",help="valida o diff real após o feature freeze")
args=parser.parse_args()

rc=json.loads((ROOT/"data/release-candidate-v11.json").read_text("utf-8"))
qa=json.loads((ROOT/"data/release-qa-v11.json").read_text("utf-8"))
versions=json.loads((ROOT/"data/version-contract.json").read_text("utf-8"))
errors=[]

def err(msg): errors.append(msg)

if rc.get("schema")!=1: err("RC: schema deve ser 1")
candidate=str(rc.get("candidate") or "")
target=str(rc.get("targetRelease") or "")
if candidate!="1.1.0-rc.1": err(f"RC: candidate inesperado {candidate!r}")
if target!="1.1.0": err(f"RC: targetRelease inesperado {target!r}")
if rc.get("candidateBranch")!="release/v1.1.0-rc1": err("RC: branch candidata divergente")
if rc.get("featureFreeze") is not True: err("RC: featureFreeze deve estar ativo")
freeze=str(rc.get("functionalFreezeSha") or "")
baseline=str(rc.get("baselineSha") or "")
if not re.fullmatch(r"[0-9a-f]{40}",freeze): err("RC: functionalFreezeSha inválido")
if not re.fullmatch(r"[0-9a-f]{40}",baseline): err("RC: baselineSha inválido")
if versions.get("targetRelease")!=target: err("RC: targetRelease diverge do contrato de versões")
if versions.get("candidateRelease")!=candidate: err("RC: candidateRelease diverge do contrato de versões")
if versions.get("functionalFreezeSha")!=freeze: err("RC: feature freeze diverge do contrato de versões")
if qa.get("targetRelease")!=target: err("RC: QA aponta para outro release")

manual={x.get("id"):x for x in qa.get("manual") or [] if isinstance(x,dict)}
blockers=list(rc.get("manualBlockers") or [])
if set(blockers)!={k for k,v in manual.items() if v.get("required")}:
    err("RC: manualBlockers divergem dos checks manuais obrigatórios")
pending=[k for k in blockers if manual.get(k,{}).get("status")!="approved"]
if rc.get("status")=="manual-qa-pending" and not pending:
    err("RC: status manual-qa-pending sem bloqueadores pendentes")
if rc.get("status")!="manual-qa-pending" and pending:
    err("RC: status indica avanço, mas ainda há QA manual pendente")

allowed=set(rc.get("allowedPostFreezePaths") or [])
required_allowed={
    ".github/workflows/rc-gate-v11.yml",
    ".github/workflows/release-gate-v11.yml",
    ".github/workflows/validate-v11.yml",
    "data/release-candidate-v11.json",
    "data/release-qa-v11.json",
    "data/version-contract.json",
    "docs/V1.1_RELEASE_NOTES.md",
    "scripts/validate_release_candidate.py",
}
missing=sorted(required_allowed-allowed)
if missing: err("RC: allowlist pós-freeze incompleta: "+", ".join(missing))

notes=(ROOT/"docs/V1.1_RELEASE_NOTES.md").read_text("utf-8",errors="replace")
for token in ("V1.1.0","Data Safety","84","286","80%","125%","150%"):
    if token not in notes: err(f"RC: release notes não documentam {token}")

if args.git:
    try:
        subprocess.run(["git","cat-file","-e",freeze+"^{commit}"],cwd=ROOT,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        diff=subprocess.run(["git","diff","--name-only",freeze+"...HEAD"],cwd=ROOT,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True).stdout.splitlines()
        changed={x.strip() for x in diff if x.strip()}
        forbidden=sorted(changed-allowed)
        if forbidden:
            err("RC: mudança funcional/não autorizada após freeze: "+", ".join(forbidden))
    except subprocess.CalledProcessError as exc:
        err("RC: não foi possível validar histórico Git; use checkout com fetch-depth 0: "+(exc.stderr or str(exc)).strip())

if errors:
    for x in errors: print("ERRO:",x)
    raise SystemExit(1)

print(json.dumps({
    "ok":True,
    "candidate":candidate,
    "targetRelease":target,
    "status":rc.get("status"),
    "functionalFreezeSha":freeze,
    "manualPending":pending,
    "featureFreeze":True,
    "gitChecked":args.git,
    "allowedPostFreezePaths":len(allowed),
},ensure_ascii=False,indent=2))
