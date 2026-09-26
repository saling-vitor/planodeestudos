#!/usr/bin/env python3
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
PATH=ROOT/"assets/css/study-map-shared-v01.css"
css=PATH.read_text("utf-8",errors="replace")
errors=[]

def strip_comments(text):
    return re.sub(r"/\*[\s\S]*?\*/","",text)

def scan_blocks(text,start=0,end=None,parents=()):
    if end is None:
        end=len(text)
    out=[]
    i=start
    header_start=start
    while i<end:
        if text.startswith("/*",i):
            j=text.find("*/",i+2)
            i=end if j<0 else j+2
            continue
        if text[i] in "'\"":
            q=text[i]; i+=1
            while i<end:
                if text[i]=="\\":
                    i+=2; continue
                if text[i]==q:
                    i+=1; break
                i+=1
            continue
        if text[i]=="{":
            header=text[header_start:i].strip()
            depth=1; j=i+1
            while j<end and depth:
                if text.startswith("/*",j):
                    c=text.find("*/",j+2)
                    j=end if c<0 else c+2
                    continue
                if text[j] in "'\"":
                    q=text[j]; j+=1
                    while j<end:
                        if text[j]=="\\":
                            j+=2; continue
                        if text[j]==q:
                            j+=1; break
                        j+=1
                    continue
                if text[j]=="{": depth+=1
                elif text[j]=="}": depth-=1
                j+=1
            body=text[i+1:j-1]
            node=(header,body,tuple(parents),header_start,j)
            out.append(node)
            if re.match(r"^@(media|supports|layer|container|document)\b",header,re.I):
                out.extend(scan_blocks(text,i+1,j-1,(*parents,header)))
            i=j; header_start=j; continue
        if text[i]==";" and not parents:
            header_start=i+1
        i+=1
    return out

def norm(text):
    text=strip_comments(text)
    text=re.sub(r"\s+"," ",text)
    text=re.sub(r"\s*([:;,>+~])\s*",r"\1",text)
    return text.strip()

blocks=scan_blocks(css)
empty=[]
for header,body,parents,start,end in blocks:
    if not header:
        continue
    group=bool(re.match(r"^@(media|supports|layer|container|document)\b",header,re.I))
    style=not header.startswith("@")
    if (group or style) and not strip_comments(body).strip():
        empty.append((header,parents,start))
if empty:
    errors.append(f"CSS mapas: {len(empty)} regra(s)/grupo(s) vazio(s)")

top=[x for x in blocks if not x[2]]
adjacent=[]
for a,b in zip(top,top[1:]):
    ah,ab,ap,as_,ae=a
    bh,bb,bp,bs,be=b
    if re.match(r"^@media\b",ah,re.I) and re.match(r"^@media\b",bh,re.I) and norm(ah)==norm(bh):
        if not strip_comments(css[ae:bs]).strip():
            adjacent.append(norm(ah))
if adjacent:
    errors.append(f"CSS mapas: {len(adjacent)} @media idêntico(s) imediatamente adjacente(s)")

styles=[x for x in blocks if x[0] and not x[0].startswith("@") and "{" not in x[1] and "}" not in x[1]]
by_context={}
for row in styles:
    by_context.setdefault(tuple(norm(x) for x in row[2]),[]).append(row)
adjacent_selectors=[]
for rows in by_context.values():
    rows.sort(key=lambda x:x[3])
    for a,b in zip(rows,rows[1:]):
        ah,ab,ap,as_,ae=a
        bh,bb,bp,bs,be=b
        if norm(ah)==norm(bh) and not strip_comments(css[ae:bs]).strip():
            adjacent_selectors.append(norm(ah))
if adjacent_selectors:
    errors.append(f"CSS mapas: {len(adjacent_selectors)} seletor(es) idêntico(s) imediatamente adjacente(s)")

metrics={
    "chars":len(css),
    "important":css.count("!important"),
    "media":len(re.findall(r"@media\b",css)),
    "empty":len(empty),
    "adjacentIdenticalMedia":len(adjacent),
    "adjacentIdenticalSelectors":len(adjacent_selectors),
}
print("study-map-css",metrics)
if errors:
    for e in errors:
        print("ERRO:",e)
    raise SystemExit(1)
