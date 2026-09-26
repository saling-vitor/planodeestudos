#!/usr/bin/env python3
from pathlib import Path
import argparse,re

ROOT=Path(__file__).resolve().parents[1]
PWA_RUNTIME=ROOT/"assets/js/pa-pwa-v01.js"
SERVICE_WORKER=ROOT/"service-worker.js"

def pwa_version():
    text=PWA_RUNTIME.read_text("utf-8",errors="replace")
    m=re.search(r"const VERSION=['\"]([^'\"]+)['\"];",text)
    if not m:
        raise SystemExit("PWA: versão canônica ausente em assets/js/pa-pwa-v01.js")
    return m.group(1)

parser=argparse.ArgumentParser()
parser.add_argument("--deploy-sha",default="",help="SHA curto usado no cache do deploy")
args=parser.parse_args()

base=pwa_version()
suffix="source"
if args.deploy_sha:
    sha=str(args.deploy_sha).strip().lower()
    if not re.fullmatch(r"[0-9a-f]{7,40}",sha):
        raise SystemExit("PWA: deploy SHA inválido")
    suffix=sha[:8]

version=f"{base}-{suffix}"
text=SERVICE_WORKER.read_text("utf-8",errors="replace")
updated,n=re.subn(r"const VERSION=['\"][^'\"]+['\"];",f"const VERSION='{version}';",text,count=1)
if n!=1:
    raise SystemExit("PWA: não foi possível sincronizar VERSION do service-worker.js")
SERVICE_WORKER.write_text(updated,"utf-8")
print(f"PWA canônico={base} · Service Worker={version}")
