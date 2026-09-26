#!/usr/bin/env python3
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
FILES=[
    ROOT/"assets/css/pa-tokens-v01.css",
    ROOT/"assets/css/pa-components-v01.css",
    ROOT/"assets/css/pa-shell-v16.css",
    ROOT/"assets/css/study-map-shared-v01.css",
    ROOT/"assets/css/simulation-shared-v01.css",
]
FILES += sorted(ROOT.glob("*.html"))

def inline_styles(text):
    return [m.group(1) for m in re.finditer(r"<style[^>]*>([\s\S]*?)</style>",text,re.I)]

def validate(text,label):
    stack=[]
    quote=None
    escape=False
    comment=False
    i=0
    while i < len(text):
        ch=text[i]
        nxt=text[i+1] if i+1 < len(text) else ""
        if comment:
            if ch=="*" and nxt=="/":
                comment=False;i+=2;continue
            i+=1;continue
        if quote:
            if escape: escape=False
            elif ch=="\\": escape=True
            elif ch==quote: quote=None
            i+=1;continue
        if ch=="/" and nxt=="*":
            comment=True;i+=2;continue
        if ch in ("'",'"'):
            quote=ch;i+=1;continue
        if ch=="{": stack.append(i)
        elif ch=="}":
            if not stack:
                raise ValueError(f"{label}: chave }} sem abertura em {i}")
            stack.pop()
        i+=1
    if comment: raise ValueError(f"{label}: comentário CSS não fechado")
    if quote: raise ValueError(f"{label}: string CSS não fechada")
    if stack: raise ValueError(f"{label}: {len(stack)} bloco(s) CSS sem fechamento")

errors=[]
checked=0
for path in FILES:
    if not path.is_file():
        continue
    if path.suffix.lower()==".css":
        chunks=[path.read_text("utf-8",errors="replace")]
    else:
        chunks=inline_styles(path.read_text("utf-8",errors="replace"))
    for idx,chunk in enumerate(chunks,1):
        label=str(path.relative_to(ROOT))
        if len(chunks)>1: label+=f" · style {idx}"
        try:
            validate(chunk,label);checked+=1
        except ValueError as e:
            errors.append(str(e))

study_map=(ROOT/"assets/css/study-map-shared-v01.css").read_text("utf-8",errors="replace")
study_map_no_comments=re.sub(r"/\*[\s\S]*?\*/","",study_map)
study_map_active= re.sub(r":not\(\s*\.map-mode\s*\)","",study_map_no_comments)
if re.search(r"\.map-mode\b|\.map-focus\b",study_map_active):
    errors.append("study-map-shared-v01.css: seletor positivo de map-mode/map-focus legado detectado")
if re.search(r"(?:^|[},])\s*body\s*\{[^}]*overflow-x\s*:\s*hidden",study_map_no_comments,re.I):
    errors.append("study-map-shared-v01.css: overflow-x:hidden global no body mascara overflow estrutural")
if re.search(r"html\.touch-performance[^{}]*\{[^}]*overflow-x\s*:\s*hidden",study_map_no_comments,re.I):
    errors.append("study-map-shared-v01.css: overflow-x:hidden global no modo touch mascara overflow estrutural")
for marker in (
    "V1.1 STUDY MAP CORE AUTHORITY",
    "body.mindmap-app .notice.study-overview",
    "#memorizacao .memory-table-wrap",
    "html.touch-performance body.mindmap-app .toolbar .sitecase-quick-exit",
):
    if marker not in study_map:
        errors.append(f"study-map-shared-v01.css: autoridade canônica ausente: {marker}")

if errors:
    for e in errors: print("ERRO:",e)
    raise SystemExit(1)

print(f"CSS OK: {checked} bloco(s)/arquivo(s) validados.")
