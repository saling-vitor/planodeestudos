(()=>{
'use strict';
const VERSION='1.1';
const UF={"acre":"AC","alagoas":"AL","amapa":"AP","amazonas":"AM","bahia":"BA","ceara":"CE","distrito federal":"DF","espirito santo":"ES","goias":"GO","maranhao":"MA","mato grosso":"MT","mato grosso do sul":"MS","minas gerais":"MG","para":"PA","paraiba":"PB","parana":"PR","pernambuco":"PE","piaui":"PI","rio de janeiro":"RJ","rio grande do norte":"RN","rio grande do sul":"RS","rondonia":"RO","roraima":"RR","santa catarina":"SC","sao paulo":"SP","sergipe":"SE","tocantins":"TO"};
const BOARDS=[['FUNDATEC','FUNDATEC'],['CEBRASPE','CEBRASPE'],['CESPE','CEBRASPE'],['FUNDAÇÃO GETULIO VARGAS','FGV'],['FGV','FGV'],['FUNDAÇÃO CARLOS CHAGAS','FCC'],['FCC','FCC'],['VUNESP','VUNESP'],['INSTITUTO AOCP','Instituto AOCP'],['LEGALLE','Legalle Concursos'],['INSTITUTO OBJETIVA','Instituto Objetiva'],['INSTITUTO AVALIA','Instituto Avalia']];
const escRe=s=>String(s||'').replace(/[.*+?^$(){}|[\]\\]/g,'\\$&');
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const clean=s=>String(s||'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/\s+\n/g,'\n').trim();
const titleCase=s=>String(s||'').toLocaleLowerCase('pt-BR').replace(/(^|[\s/-])([a-zà-ÿ])/g,(_,a,b)=>a+b.toLocaleUpperCase('pt-BR')).replace(/\b(De|Da|Do|Das|Dos|E)\b/g,x=>x.toLowerCase());
const isoDate=s=>{const m=String(s||'').match(/(\d{2})\/(\d{2})\/(20\d{2})/);return m?m[3]+'-'+m[2]+'-'+m[1]:''};
const num=s=>{const n=Number(String(s??'').replace(/\./g,'').replace(',','.'));return Number.isFinite(n)?n:null};
function organization(lines,text){
 const first=lines.slice(0,180),rx=/(Departamento Municipal|Prefeitura Municipal|Munic[ií]pio de|C[aâ]mara Municipal|Tribunal|Secretaria(?: Municipal| de Estado)?|Universidade|Instituto Federal|Companhia|Conselho Regional)/i;
 let cand=first.filter(l=>rx.test(l)&&l.length>=8&&l.length<=150).sort((a,b)=>{const av=/Departamento|Prefeitura|Munic[ií]pio/i.test(a)?0:1,bv=/Departamento|Prefeitura|Munic[ií]pio/i.test(b)?0:1;return av-bv||a.length-b.length})[0]||'';
 const m=text.match(/((?:Departamento|Prefeitura|Secretaria|C[aâ]mara)\s+(?:Municipal\s+)?[^\n,.-]{3,80})\s*[-–—]\s*([A-Z]{2,12})\b/i);
 return{organization:clean(cand||m?.[1]||''),acronym:m?.[2]||''};
}
function locality(text){
 let city='',uf='';
 let m=text.match(/Munic[ií]pio de\s+([A-ZÀ-ÿ][A-Za-zÀ-ÿ' -]{2,55}?)(?:,|\s+do Estado)/i);if(m)city=clean(m[1]);
 m=text.match(/\b([A-ZÀ-ÿ][A-Za-zÀ-ÿ' -]{2,45})\/(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);if(m&&!city){city=clean(m[1]);uf=m[2]}
 const em=text.match(/Estado\s+(?:do|de|da)\s+([A-ZÀ-ÿ][A-Za-zÀ-ÿ ]{3,35})/i);
 if(em){const key=fold(em[1]).toLocaleLowerCase('pt-BR');for(const [name,code] of Object.entries(UF))if(fold(name).toLocaleLowerCase('pt-BR')===key){uf=uf||code;break}}
 return{cityName:city,uf,city:city?(uf?city+'/'+uf:city):''};
}
function board(text){const f=fold(text);for(const [needle,label] of BOARDS)if(f.includes(fold(needle)))return label;const m=text.match(/(?:banca|organizadora|responsabilidade d[ao]|executad[oa] pela)\s+([^\n.;]{3,100})/i);return clean(m?.[1]||'')}
function notice(text){for(const r of [/EDITAL(?:\s+DE\s+(?:ABERTURA|CONCURSO|PROCESSO SELETIVO|SELE[CÇ][AÃ]O)){0,2}\s*(?:N[º°o.]?\s*)?(\d{1,4}\s*[\/-]\s*20\d{2})/i,/EDITAL\s*(?:N[º°o.]?\s*)?(\d{1,4}\s*[\/-]\s*20\d{2})/i]){const m=text.match(r);if(m)return'Edital '+m[1].replace(/\s/g,'')}return''}
function publicationDate(text){
 const m=text.match(/Publica[cç][aã]o\s*:\s*(?:[^\d\n]{0,30})?(\d{2}\/\d{2}\/20\d{2})/i)||text.match(/(?:publicado|publica[cç][aã]o)[^\n]{0,40}(\d{2}\/\d{2}\/20\d{2})/i);if(m)return isoDate(m[1]);
 const w=text.match(/Publica[cç][aã]o\s*:[^\n]*?(\d{1,2})\s+de\s+(Janeiro|Fevereiro|Mar[cç]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)\s+de\s+(20\d{2})/i);if(!w)return'';
 const ms={janeiro:'01',fevereiro:'02','março':'03',marco:'03',abril:'04',maio:'05',junho:'06',julho:'07',agosto:'08',setembro:'09',outubro:'10',novembro:'11',dezembro:'12'},mm=ms[fold(w[2]).toLocaleLowerCase('pt-BR')]||ms[w[2].toLocaleLowerCase('pt-BR')];
 return mm?w[3]+'-'+mm+'-'+String(w[1]).padStart(2,'0'):'';
}
const CARGO_HEADERS={
 code:['CODIGO','COD','COD.','CODIGO DO CARGO','COD DO CARGO','COD. DO CARGO'],
 name:['CARGO','FUNCAO','EMPREGO','ESPECIALIDADE','CARGO/FUNCAO','CARGO / FUNCAO','CARGO/ESPECIALIDADE','CARGO / ESPECIALIDADE'],
 group:['GRUPO','GRUPO DE PROVA','TIPO DE PROVA','GRUPO/TIPO DE PROVA','GRUPO / TIPO DE PROVA']
};
const CARGO_STOP=/\b(?:VAGA|VAGAS|REMUNERACAO|SALARIO|JORNADA|CARGA HORARIA|REQUISITO|REQUISITOS|ESCOLARIDADE|INSCRICAO|INSCRICOES|TAXA|PONTOS|QUESTOES)\b/i;
const CARGO_NAME_REJECT=/^(?:CODIGO|COD\.?|CARGO|FUNCAO|EMPREGO|ESPECIALIDADE|GRUPO|TIPO DE PROVA|REQUISITOS?|ESCOLARIDADE|VAGAS?|REMUNERACAO|JORNADA|TOTAL|ANEXO|TABELA)$/i;
const normHeader=s=>fold(s).replace(/[^A-Z0-9/ ]+/g,' ').replace(/\s+/g,' ').trim();
function headerMatches(value,kind){const n=normHeader(value);return CARGO_HEADERS[kind].some(x=>n===normHeader(x))}
function groupValue(value){
 const raw=clean(value).replace(/^[\s:;|–—-]+|[\s:;|–—-]+$/g,'');if(!raw)return'';
 let m=raw.match(/\bG\s*0*(\d{1,3})\b/i);if(m)return'G'+String(m[1]).padStart(Math.max(2,m[1].length),'0');
 m=raw.match(/\bGRUPO(?:\s+DE\s+PROVA)?\s*[:–—-]?\s*(?!DE\b|PROVA\b)([A-Z0-9][A-Z0-9.-]*)\b/i);if(m)return/^G\d+$/i.test(m[1])?m[1].toUpperCase():'Grupo '+m[1].toUpperCase();
 m=raw.match(/\bTIPO(?:\s+DE\s+PROVA)?\s*[:–—-]?\s*(?!DE\b|PROVA\b)([A-Z0-9][A-Z0-9.-]*)\b/i);if(m)return'Tipo '+m[1].toUpperCase();
 m=raw.match(/(?:^|\s)[ÁA]REA\s*[:–—-]?\s*([A-Z0-9][A-Z0-9.-]*)\b/i);if(m)return'Área '+m[1].toUpperCase();
 m=raw.match(/\bN[ÍI]VEL\s+(SUPERIOR|M[ÉE]DIO|FUNDAMENTAL(?:\s+(?:COMPLETO|INCOMPLETO))?)\b/i);if(m)return titleCase('Nível '+m[1]);
 return''
}
function splitCargoGroup(value){
 let raw=clean(value),group=groupValue(raw);if(!group)return{name:raw,group:''};
 const patterns=[/\s*[-–—|]\s*(?:G\s*\d{1,3}|GRUPO(?:\s+DE\s+PROVA)?\s*[:–—-]?\s*[A-Z0-9.-]+|TIPO(?:\s+DE\s+PROVA)?\s*[:–—-]?\s*[A-Z0-9.-]+|[ÁA]REA\s*[:–—-]?\s*[A-Z0-9.-]+|N[ÍI]VEL\s+(?:SUPERIOR|M[ÉE]DIO|FUNDAMENTAL(?:\s+(?:COMPLETO|INCOMPLETO))?))\s*$/i,/\s+(?:G\s*\d{1,3}|GRUPO(?:\s+DE\s+PROVA)?\s*[:–—-]?\s*[A-Z0-9.-]+|TIPO(?:\s+DE\s+PROVA)?\s*[:–—-]?\s*[A-Z0-9.-]+|[ÁA]REA\s*[:–—-]?\s*[A-Z0-9.-]+|N[ÍI]VEL\s+(?:SUPERIOR|M[ÉE]DIO|FUNDAMENTAL(?:\s+(?:COMPLETO|INCOMPLETO))?))\s*$/i];
 for(const rx of patterns){if(rx.test(raw)){raw=clean(raw.replace(rx,''));break}}
 return{name:raw,group}
}
function cleanCargoName(value){
 let name=clean(value).replace(/^[\s:;|–—-]+|[\s:;|–—-]+$/g,'').replace(/[.,;:]$/,'');
 name=name.replace(/\s+(?=(?:\d{1,3}\s*(?:\+|VAGAS?\b)|C\.?\s*R\.?\b|R\$\s*\d|CURSO\b|ENSINO\b|CARGA\s+HOR[ÁA]RIA\b|\d{1,2}\s*H(?:ORAS?)?\b)).*$/i,'').trim();
 return name
}
function plausibleCargoName(value){
 const name=cleanCargoName(value),f=fold(name);if(!name||name.length<3||name.length>100||CARGO_NAME_REJECT.test(f)||CARGO_STOP.test(f))return false;
 if(!/[A-ZÀ-ÿ]/i.test(name)||/^\d+(?:[.,]\d+)?$/.test(name))return false;
 if(/[.!?]$/.test(name)&&name.split(/\s+/).length>7)return false;
 return true
}
function findHeaderAnchor(items,kind){
 const arr=(items||[]).filter(x=>clean(x?.text));for(let i=0;i<arr.length;i++)for(let len=1;len<=Math.min(5,arr.length-i);len++){const part=arr.slice(i,i+len),label=part.map(x=>x.text).join(' ');if(headerMatches(label,kind))return{x:Math.min(...part.map(x=>Number(x.x)||0)),label}}
 return null
}
function geometryCargoRows(doc,add){
 const pages=doc?.documentMap?.pages||[];for(const page of pages){const rows=page?.lines||[];for(let h=0;h<rows.length;h++){const header=rows[h],items=header?.items||[],nameAnchor=findHeaderAnchor(items,'name');if(!nameAnchor)continue;const codeAnchor=findHeaderAnchor(items,'code'),groupAnchor=findHeaderAnchor(items,'group'),anchors=[codeAnchor&&{kind:'code',x:codeAnchor.x},nameAnchor&&{kind:'name',x:nameAnchor.x},groupAnchor&&{kind:'group',x:groupAnchor.x}].filter(Boolean).sort((a,b)=>a.x-b.x);if(!anchors.length)continue;
   let misses=0;for(let r=h+1;r<Math.min(rows.length,h+70);r++){const row=rows[r];if(findHeaderAnchor(row?.items||[],'name'))break;const values={code:'',name:'',group:''};for(const item of row?.items||[]){const x=Number(item.x)||0;let chosen=anchors[0];for(const a of anchors)if(Math.abs(a.x-x)<Math.abs(chosen.x-x))chosen=a;values[chosen.kind]+=(values[chosen.kind]?' ':'')+clean(item.text)}
     let parsed=splitCargoGroup(values.name),group=groupValue(values.group)||parsed.group,name=cleanCargoName(parsed.name),code=clean(values.code).replace(/^[|:;–—-]+|[|:;–—-]+$/g,'');if(code&&code.length>20)code='';
     if(plausibleCargoName(name)&&(code||group||anchors.length===1)){add(code,name,group,'geometry');misses=0}else if(clean(row?.text)){misses++;if(misses>=10)break}
   }
  }
 }
}
function delimitedCargoRows(lines,add){
 for(let i=0;i<lines.length-1;i++){const header=clean(lines[i]),sep=/\s*[|;\t]\s*/;if(!/[|;\t]/.test(header))continue;const heads=header.split(sep),nameIndex=heads.findIndex(x=>headerMatches(x,'name'));if(nameIndex<0)continue;const codeIndex=heads.findIndex(x=>headerMatches(x,'code')),groupIndex=heads.findIndex(x=>headerMatches(x,'group'));
   for(let r=i+1;r<Math.min(lines.length,i+50);r++){if(!/[|;\t]/.test(lines[r]))break;const cols=lines[r].split(sep).map(clean),parsed=splitCargoGroup(cols[nameIndex]||''),name=cleanCargoName(parsed.name);if(!plausibleCargoName(name))continue;add(codeIndex>=0?cols[codeIndex]:'',name,groupIndex>=0?groupValue(cols[groupIndex]):parsed.group,'delimited')}
 }
}
function fallbackCargoRows(text,lines,add){
 let m;const explicit=/\bCARGO\s+((?:CP\s*)?\d{1,4}|[A-Z]{1,3}\s*-?\s*\d{1,4})\s*:\s*([^\n]{3,100})/gi;while((m=explicit.exec(text))){const p=splitCargoGroup(m[2]);add(m[1],p.name,p.group,'explicit')}
 for(let i=0;i<lines.length;i++){
  const line=clean(lines[i]);if(!line)continue;
  let x=line.match(/^\s*((?:CP\s*)?\d{1,4}|[A-Z]{1,3}\s*-?\s*\d{1,4})\s*[-–—:]?\s+(.+)$/i);
  if(x&&!/^(?:20\d{2}|\d{1,2}[\/.]\d{1,2})$/.test(clean(x[1]))){const p=splitCargoGroup(x[2]),name=cleanCargoName(p.name);if(plausibleCargoName(name))add(x[1],name,p.group,'line')}
  x=line.match(/^\s*(?:CARGO|FUN[CÇ][AÃ]O|EMPREGO|ESPECIALIDADE)\s*[:–—-]\s*(.+)$/i);if(x){const p=splitCargoGroup(x[1]),name=cleanCargoName(p.name);if(plausibleCargoName(name))add('',name,p.group,'label')}
  if(headerMatches(line,'name')&&lines[i+1]){const p=splitCargoGroup(lines[i+1]),name=cleanCargoName(p.name);if(plausibleCargoName(name))add('',name,p.group,'header-follow')}
 }
}
function cargos(text,lines,doc){
 const out=[],index=new Map(),add=(code,name,group='',source='text')=>{code=clean(code||'').replace(/\s+/g,' ');name=cleanCargoName(name);group=groupValue(group)||clean(group||'');if(!plausibleCargoName(name))return;const pretty=/^[A-ZÀ-Ü\s/&().-]+$/.test(name)?titleCase(name):name,key=fold(code?code+'|'+pretty:pretty);const existing=index.get(key);if(existing){if(!existing.group&&group)existing.group=group;if(!existing.code&&code)existing.code=code;if(existing.source!=='geometry'&&source==='geometry')existing.source=source;return}const row={code,name:pretty,group,source};out.push(row);index.set(key,row)};
 geometryCargoRows(doc,add);delimitedCargoRows(lines,add);fallbackCargoRows(text,lines,add);
 return out
}
function resolveCargoGroup(cargo,text,lines){
 if(cargo?.group)return groupValue(cargo.group)||clean(cargo.group);const code=fold(cargo?.code||''),name=fold(cargo?.name||'');if(!code&&!name)return'';
 const hits=lines.map((line,i)=>({line,i,f:fold(line)})).filter(x=>(code&&x.f.includes(code))||(name&&x.f.includes(name)));
 for(const h of hits.slice(0,8)){for(const line of lines.slice(Math.max(0,h.i-1),Math.min(lines.length,h.i+3))){const g=groupValue(line);if(g)return g}}
 return''
}
function cargoBlock(text,cargo){if(!cargo?.name)return'';const name=escRe(cargo.name).replace(/\\s+/g,'\\s+'),rx=new RegExp('(?:^|\\n)\\s*\\d+\\.\\d+\\.\\s+'+name+'\\s*[\\s\\S]*?(?=\\n\\s*\\d+\\.\\d+\\.\\s+[A-ZÀ-Ü]|$)','i'),m=text.match(rx);if(m)return m[0];const i=fold(text).indexOf(fold(cargo.name));return i>=0?text.slice(i,Math.min(text.length,i+6500)):''}
function cargoDetails(text,lines,cargo){
 const block=cargoBlock(text,cargo),code=fold(cargo?.code||''),name=fold(cargo?.name||'');let vacancies=null,reserve=false,requirements='';
 const all=lines.map((l,i)=>({l,i})),codeHits=code?all.filter(x=>fold(x.l).includes(code)):[],nameHits=name?all.filter(x=>fold(x.l).includes(name)):[],hits=codeHits.length?codeHits:nameHits;
 for(const h of hits.slice(0,5)){const around=lines.slice(Math.max(0,h.i-5),Math.min(lines.length,h.i+11)).join(' '),m=around.match(/(\d{1,3})\s*\+/i);if(m&&/C\.?\s*R\.?/i.test(around)){vacancies=Number(m[1]);reserve=true;break}}
 if(!reserve&&hits.some(h=>/C\.?\s*R\.?/i.test(h.l)))reserve=true;
 const reqArea=hits.length?lines.slice(Math.max(0,hits[0].i-6),Math.min(lines.length,hits[0].i+18)).join(' '):'',rm=reqArea.match(/(Curso\s+(?:Superior|de gradua[cç][aã]o)[\s\S]{0,650}?(?:CAU|CREA|CORECON)\.?)/i)||reqArea.match(/(Curso\s+(?:Superior|de gradua[cç][aã]o)[\s\S]{0,450}?(?:MEC|completo)\.?)/i);
 requirements=clean(rm?.[1]||'');
 if(requirements){const junk=[cargo?.code,cargo?.name].filter(Boolean).map(escRe);if(junk.length)requirements=requirements.replace(new RegExp('\\b(?:'+junk.join('|')+')\\b','gi'),' ');requirements=requirements.replace(/\b\d{1,3}\s*\+\s*(?:C\.?\s*R\.?\s*){1,8}/gi,' ').replace(/(?:C\.?\s*R\.?\s*){2,}/gi,' ').replace(/\s+/g,' ').trim()}
 const wh=block.match(/carga hor[aá]ria de\s+(\d{1,2})\s*\([^)]*\)\s*horas semanais/i)||block.match(/(\d{1,2})\s*horas semanais/i),sal=block.match(/R\$\s*([\d.]+,\d{2})/);
 return{vacancies,reserve,workloadHours:wh?Number(wh[1]):null,remuneration:sal?'R$ '+sal[1]:'',requirements};
}
function duration(text){const area=text.match(/Tempo para realiza[cç][aã]o da Prova[\s\S]{0,700}/i)?.[0]||text.match(/dura[cç][aã]o da prova[\s\S]{0,500}/i)?.[0]||'',m=area.match(/(\d{1,2})\s*\([^)]*\)\s*horas?(?:\s*e?\s*(\d{1,2})\s*\([^)]*\)\s*minutos?)?/i)||area.match(/(\d{1,2})\s*h(?:oras?)?\s*(?:e\s*)?(\d{1,2})?\s*min?/i);return m?(Number(m[1])*60+Number(m[2]||0)):null}
function examSections(text){
 const i=text.search(/\bDisciplinas\b/i),area=i>=0?text.slice(i,i+5000):text,defs=[['portuguese','Língua Portuguesa','L[íi]ngua[\\s]+Portuguesa'],['legislation','Legislação','Legisla[cç][aã]o'],['specific','Conhecimentos Específicos','Conhecimentos[\\s]+Espec[íi]ficos'],['informatics','Informática','Inform[aá]tica'],['logic','Raciocínio Lógico','Racioc[íi]nio[\\s]+L[oó]gico(?:-Matem[aá]tico)?'],['general','Conhecimentos Gerais','Conhecimentos[\\s]+Gerais'],['current','Atualidades','Atualidades']],out=[];
 for(const [id,label,p] of defs){const m=area.match(new RegExp(p+'\\s+(\\d{1,3})\\s+([\\d.,]+)\\s+([\\d.,]+)(?:\\s+([\\d.,]+))?','i'));if(m){const q=Number(m[1]),w=num(m[2]),pts=num(m[3]),mn=num(m[4]);if(q>0&&q<300&&w!==null&&pts!==null)out.push({id,label,questions:q,pointsPerQuestion:w,totalPoints:pts,minimumPoints:mn,mapGroups:[label]})}}
 if(!out.some(s=>s.id==='specific')){const m=area.match(/Conhecimentos\s+(\d{1,3})\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+Espec[íi]ficos/i);if(m){const q=Number(m[1]),w=num(m[2]),pts=num(m[3]),mn=num(m[4]);if(q>0&&w!==null&&pts!==null)out.push({id:'specific',label:'Conhecimentos Específicos',questions:q,pointsPerQuestion:w,totalPoints:pts,minimumPoints:mn,mapGroups:['Conhecimentos Específicos']})}}
 const totalQuestions=out.reduce((a,s)=>a+Number(s.questions||0),0),totalPoints=out.reduce((a,s)=>a+Number(s.totalPoints||0),0);out.forEach(s=>{s.planWeight=totalPoints?Math.round(s.totalPoints*10000/totalPoints)/100:null;s.planWeightSource='calculated'});
 return{sections:out,totalQuestions:totalQuestions||null,totalPoints:totalPoints||null};
}
function minimumTotal(text){const m=text.match(/(?:M[ií]nima\s+Geral|mínimo geral)[\s\S]{0,280}?(\d{1,3}(?:[.,]\d+)?)\s*pontos/i)||text.match(/(\d{1,3}(?:[.,]\d+)?)\s*pontos[\s\S]{0,220}?(?:M[ií]nima\s+Geral|mínimo geral)/i);return m?num(m[1]):null}
function schedule(lines){
 const out=[],seen=new Set(),keywords=/inscri|isen[cç]|pagamento|homologa|prova|gabarito|recurso|resultado|t[ií]tulo|local|convoca|publica[cç]/i;
 for(let i=0;i<lines.length;i++){const dates=[...lines[i].matchAll(/\b\d{2}\/\d{2}\/20\d{2}\b/g)].map(x=>x[0]);if(!dates.length)continue;let label=lines[i].replace(/\b\d{2}\/\d{2}\/20\d{2}\b/g,'').replace(/[-–—|]+$/,'').trim();if(label.length<7)label=[lines[i-1]||'',label,lines[i+1]||''].join(' ').replace(/\b\d{2}\/\d{2}\/20\d{2}\b/g,'').replace(/\s+/g,' ').trim();if(!keywords.test(label))continue;const date=isoDate(dates[0]),key=date+'|'+fold(label).slice(0,80);if(seen.has(key))continue;seen.add(key);const f=fold(label);let kind='event';if(/APLICA.*PROVA|REALIZA.*PROVA/.test(f))kind='exam';else if(/GABARITO/.test(f))kind='answer-key';else if(/INSCRI/.test(f))kind='registration';else if(/ISEN/.test(f))kind='exemption';else if(/RECURSO/.test(f))kind='appeal';else if(/RESULTADO/.test(f))kind='result';else if(/TITUL/.test(f))kind='titles';out.push({date,label:clean(label).slice(0,220),kind,status:/PROV[AÁ]VEL/i.test(label)?'provável':'edital'})}
 return out.sort((a,b)=>a.date.localeCompare(b.date));
}
function program(text,cargo){
 const out=[],capture=(label,start,end)=>{const m=text.match(new RegExp(start+'\\s*PROGRAMA\\s*:\\s*([\\s\\S]*?)(?='+end+'|$)','i'));if(m){const body=clean(m[1]).replace(/\n+/g,' ');if(body.length>20)out.push({label,text:body,source:'edital'})}};
 capture('Língua Portuguesa','(?:N[ÍI]VEL\\s+SUPERIOR\\s+COMPLETO\\s+)?L[ÍI]NGUA\\s+PORTUGUESA(?:\\s+CARGOS?\\s*:\\s*TODOS)?','(?:N[ÍI]VEL\\s+SUPERIOR\\s+COMPLETO\\s+)?LEGISLA[CÇ][AÃ]O');
 capture('Legislação','(?:N[ÍI]VEL\\s+SUPERIOR\\s+COMPLETO\\s+)?LEGISLA[CÇ][AÃ]O(?:\\s+CARGOS?\\s*:\\s*TODOS)?','(?:N[ÍI]VEL\\s+(?:SUPERIOR|M[EÉ]DIO)\\s+COMPLETO\\s+)?CONHECIMENTOS\\s+ESPEC[ÍI]FICOS');
 if(cargo?.name){const code=cargo.code?escRe(cargo.code).replace(/\s+/g,'\\s*'):'(?:CP\\s*\\d+)',name=escRe(cargo.name).replace(/\s+/g,'\\s+');capture('Conhecimentos Específicos','CONHECIMENTOS\\s+ESPEC[ÍI]FICOS\\s+CARGO\\s+'+code+'\\s*:\\s*'+name,'(?:N[ÍI]VEL\\s+(?:SUPERIOR|M[EÉ]DIO)\\s+COMPLETO\\s+)?CONHECIMENTOS\\s+ESPEC[ÍI]FICOS\\s+CARGO|ANEXO\\s+V|$')}
 return out;
}
function parseDocument(doc,cargo){
 const text=clean(doc.text),lines=doc.pages.flatMap(p=>p.lines||String(p.text||'').split(/\r?\n/)).map(x=>typeof x==='string'?clean(x):clean(x?.text)).filter(Boolean),loc=locality(text),org=organization(lines,text),nt=notice(text),bd=board(text),available=cargos(text,lines,doc),picked=cargo||available[0]||null,selected=picked?{...picked,group:resolveCargoGroup(picked,text,lines)}:null,details=cargoDetails(text,lines,selected),exam=examSections(text),sched=schedule(lines),examEvent=sched.find(e=>e.kind==='exam')||null,min=minimumTotal(text),dur=duration(text),pub=publicationDate(text);
 const objective=exam.sections.length?{id:'objective',type:'objective',label:/Te[oó]rico-Objetiva/i.test(text)?'Prova Teórico-Objetiva':'Prova Objetiva',character:/eliminat[oó]ria e classificat[oó]ria/i.test(text)?'Eliminatório e classificatório':'',planningMode:'weighted-sections',date:examEvent?.date||'',dateStatus:examEvent?.status||'',durationMinutes:dur,totalQuestions:exam.totalQuestions,totalPoints:exam.totalPoints,minimum:min!==null?{kind:'points',value:min,label:'mínimo geral de '+String(min).replace('.',',')+' pontos'}:null,sections:exam.sections}:null;
 const content=program(text,selected),officialName=org.organization,title=org.acronym?(org.acronym+(loc.cityName?' '+loc.cityName:'')):officialName,rules=[];
 if(objective?.character)rules.push(objective.label+' de caráter '+objective.character.toLowerCase()+'.');if(min!==null)rules.push('Pontuação mínima geral: '+String(min).replace('.',',')+' pontos.');for(const s of exam.sections)if(s.minimumPoints!==null&&s.minimumPoints!==undefined)rules.push('Mínimo em '+s.label+': '+String(s.minimumPoints).replace('.',',')+' pontos.');
 const schema={id:'',kind:'user',status:'reviewed',board:bd,organization:officialName,position:selected?.name||'',positionCode:selected?.code||'',examGroup:selected?.group||'',notice:nt,examDate:{date:examEvent?.date||'',status:examEvent?.status||''},stages:objective?[objective]:[],schedule:sched,rules,content,documents:[],sourceNote:'Extraído localmente do PDF; revisar antes de criar.'};
 const draft={title:title||officialName,officialName,organization:officialName,position:selected?.name||'',positionCode:selected?.code||'',examGroup:selected?.group||'',board:bd,city:loc.city,cityName:loc.cityName,uf:loc.uf,notice:nt,publicationDate:pub,examDate:examEvent?.date||'',examDateStatus:examEvent?.status||'',durationMinutes:dur,vacancies:details.vacancies,reserve:details.reserve,workloadHours:details.workloadHours,remuneration:details.remuneration,requirements:details.requirements,stages:schema.stages,sections:exam.sections,schedule:sched,rules,content,schema,source:'pdf-import',_status:{title:title?'confirmed':'missing',organization:officialName?'confirmed':'missing',position:selected?.name?'confirmed':'missing',board:bd?'confirmed':'missing',city:loc.city?'review':'missing',notice:nt?'confirmed':'missing',examDate:examEvent?.date?'review':'missing'}};
 return{draft,schema,cargos:available,selectedCargo:selected,meta:{pages:doc.numPages,nativeChars:doc.nativeChars||0,ocr:!!doc.ocr,ocrPartial:!!doc.ocrPartial,examGroup:selected?.group||''}};
}
window.PLANO_ARQ_EDICT_PARSER={version:VERSION,parseDocument,cargos,resolveCargoGroup,examSections,schedule,program};
})();