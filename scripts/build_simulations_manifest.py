#!/usr/bin/env python3
from pathlib import Path
import json,re

ROOT=Path(__file__).resolve().parents[1]
SIM=ROOT/'simulados'
OUT_JSON=ROOT/'data/simulations.json'
OUT_JS=ROOT/'data/simulations.js'
CONTEST='demhab-poa-arquiteto-2026'

def extract_object(text, marker='const EXAM_DATA = '):
    pos=text.index(marker)+len(marker)
    while pos < len(text) and text[pos].isspace():
        pos+=1
    if pos>=len(text) or text[pos] != '{':
        raise ValueError('EXAM_DATA não começa com objeto JSON')
    start=pos
    depth=0
    quote=None
    escape=False
    for i,ch in enumerate(text[start:],start):
        if quote is not None:
            if escape:
                escape=False
            elif ch=='\\':
                escape=True
            elif ch==quote:
                quote=None
            continue
        if ch in ('"', "'"):
            quote=ch
        elif ch=='{':
            depth+=1
        elif ch=='}':
            depth-=1
            if depth==0:
                return text[start:i+1]
    raise ValueError('EXAM_DATA sem fechamento')

def data_from(path):
    return json.loads(extract_object(path.read_text(encoding='utf-8')))

rows=[]
for p in sorted(SIM.glob('Simulado_*.html')):
    try:
        d=data_from(p)
    except Exception as e:
        print('Ignorado',p.name,e)
        continue
    m=d.get('meta',{})
    code=str(m.get('code',''))
    n=re.search(r'SIM_(\d+)',code)
    order=int(n.group(1)) if n else len(rows)+1
    secs=[]
    maxp=0
    for sec in d.get('sections',[]):
        q=len(sec.get('questions',[]))
        w=float(sec.get('weight',1) or 1)
        pts=q*w
        maxp+=pts
        secs.append({'title':sec.get('title',''),'questions':q,'weight':w,'points':pts})
    version=str(m.get('version','V08'))
    vm=re.search(r'\d+',version)
    version_num=int(vm.group(0)) if vm else 8
    rows.append({
        'id':f'demhab-fundatec-sim-{order:02d}-v{version_num:02d}',
        'contestId':CONTEST,
        'order':order,
        'path':f'simulados/{p.name}',
        'filename':p.name,
        'code':code,
        'title':f'Simulado {order:02d} — FUNDATEC',
        'subtitle':'Arquiteto · DEMHAB Porto Alegre',
        'version':version,
        'date':m.get('date',''),
        'questions':int(m.get('expectedQuestions') or sum(x['questions'] for x in secs)),
        'alternatives':int(m.get('alternativesCount') or 5),
        'duration':m.get('duration',''),
        'durationMinutes':210,
        'maxPoints':maxp,
        'minTotalPoints':float(m.get('minTotalPoints') or 0),
        'board':'FUNDATEC',
        'kind':'full-exam',
        'status':'available',
        'sections':secs,
        'nonOfficial':True
    })

payload={'schema':1,'version':'14','simulations':rows}
OUT_JSON.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
OUT_JS.write_text('window.PLANO_ARQ_SIMULATIONS='+json.dumps(payload,ensure_ascii=False)+';\n',encoding='utf-8')
print(len(rows),'simulados indexados')
