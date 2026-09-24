#!/usr/bin/env python3
from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
SIM=ROOT/'simulados'; OUT_JSON=ROOT/'data/simulations.json'; OUT_JS=ROOT/'data/simulations.js'
CONTEST='demhab-poa-arquiteto-2026'
def data_from(p):
 s=p.read_text(encoding='utf-8'); a=s.index('const EXAM_DATA = ')+len('const EXAM_DATA = '); b=s.index('\n};\n  /* ========================================================================\n     FIM — ÁREA EDITÁVEL',a)+2; return json.loads(s[a:b])
rows=[]
for p in sorted(SIM.glob('Simulado_*.html')):
 try:d=data_from(p)
 except Exception as e: print('Ignorado',p.name,e);continue
 m=d.get('meta',{}); code=str(m.get('code','')); n=re.search(r'SIM_(\d+)',code); order=int(n.group(1)) if n else len(rows)+1
 secs=[]; maxp=0
 for sec in d.get('sections',[]):
  q=len(sec.get('questions',[]));w=float(sec.get('weight',1) or 1);pts=q*w;maxp+=pts;secs.append({'title':sec.get('title',''),'questions':q,'weight':w,'points':pts})
 rows.append({'id':f'demhab-fundatec-sim-{order:02d}-v08','contestId':CONTEST,'order':order,'path':f'simulados/{p.name}','filename':p.name,'code':code,'title':f'Simulado {order:02d} — FUNDATEC','subtitle':'Arquiteto · DEMHAB Porto Alegre','version':m.get('version','V08'),'date':m.get('date',''),'questions':int(m.get('expectedQuestions') or sum(x['questions'] for x in secs)),'alternatives':int(m.get('alternativesCount') or 5),'duration':m.get('duration',''),'durationMinutes':210,'maxPoints':maxp,'minTotalPoints':float(m.get('minTotalPoints') or 0),'board':'FUNDATEC','kind':'full-exam','status':'available','sections':secs,'sourceTemplate':'Template_Prova_Concurso_Fundatec_V08_MESTRE_IMAGENS_REAIS.html','nonOfficial':True})
payload={'schema':1,'version':'13','simulations':rows};OUT_JSON.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');OUT_JS.write_text('window.PLANO_ARQ_SIMULATIONS='+json.dumps(payload,ensure_ascii=False)+';\n',encoding='utf-8');print(len(rows),'simulados indexados')
