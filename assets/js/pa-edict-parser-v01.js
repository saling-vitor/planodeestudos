(()=>{
'use strict';
const VERSION='1.7';
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
const OBJECTIVE_HEADINGS=[
 ['theoretical-objective','Prova Teórico-Objetiva',/\bPROVA\s+TEORICO(?:\s*[-–—]\s*|\s+)OBJETIVA\b/],
 ['written-objective','Prova Escrita Objetiva',/\bPROVA\s+ESCRITA\s+OBJETIVA\b/],
 ['objective','Prova Objetiva',/\bPROVA\s+OBJETIVA\b/],
 ['knowledge','Prova de Conhecimentos',/\bPROVA\s+DE\s+CONHECIMENTOS\b/],
 ['multiple-choice','Prova de Múltipla Escolha',/\bPROVA\s+DE\s+MULTIPLA\s+ESCOLHA\b/]
];
const NON_OBJECTIVE_STAGE=/\b(?:PROVA\s+PRATICA|AVALIACAO\s+PRATICA|PROVA\s+ORAL|AVALIACAO\s+PSICOLOGICA|EXAME\s+PSICOLOGICO|TESTE\s+DE\s+APTIDAO\s+FISICA|TAF|PROVA\s+DE\s+TITULOS|AVALIACAO\s+DE\s+TITULOS|CURSO\s+DE\s+FORMACAO)\b/;
const OBJECTIVE_SCHEDULE=/\b(?:APLICACAO|REALIZACAO|DATA|HORARIO|LOCAL|CONVOCACAO|GABARITO|RECURSO|RESULTADO|CRONOGRAMA)\b/;
const SECTION_STOP=/\b(?:PROVA\s+PRATICA|AVALIACAO\s+PRATICA|PROVA\s+ORAL|AVALIACAO\s+PSICOLOGICA|EXAME\s+PSICOLOGICO|TESTE\s+DE\s+APTIDAO\s+FISICA|TAF|PROVA\s+DE\s+TITULOS|AVALIACAO\s+DE\s+TITULOS|CURSO\s+DE\s+FORMACAO|CONTEUDO\s+PROGRAMATICO|PROGRAMA\s+DAS\s+PROVAS)\b/;
function objectiveHeading(text){
 const raw=clean(text),f=fold(raw);if(!raw||raw.length>180||NON_OBJECTIVE_STAGE.test(f)||(/^A\s+PROVA\b/.test(f)&&/\b(?:TERA|SERA|DEVERA|CARATER|DURACAO|PONTUACAO|CANDIDATO)\b/.test(f)))return null;
 for(const [kind,label,rx] of OBJECTIVE_HEADINGS)if(rx.test(f)){
  if(OBJECTIVE_SCHEDULE.test(f)&&(/\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/.test(raw)||f.length>70))return null;
  return{type:'objective',kind,label,sourceLabel:raw}
 }
 return null
}
function objectiveRows(doc){
 const mapped=doc?.documentMap?.pages;if(Array.isArray(mapped)&&mapped.length){
  const out=[];for(const page of mapped)for(let i=0;i<(page?.lines||[]).length;i++){const line=page.lines[i],text=clean(typeof line==='string'?line:line?.text);if(text)out.push({text,ref:typeof line==='string'?('p'+page.number+':l'+(i+1)):(line.ref||('p'+page.number+':l'+(i+1))),page:Number(page.number)||1,order:Number(line?.order)||i+1,bbox:typeof line==='string'?null:(line.bbox||null),items:typeof line==='string'?[]:(Array.isArray(line.items)?line.items:[])})}return out
 }
 const out=[];for(let p=0;p<(doc?.pages||[]).length;p++){const page=doc.pages[p],lines=page?.lines||String(page?.text||'').split(/\r?\n/);for(let i=0;i<lines.length;i++){const line=lines[i],text=clean(typeof line==='string'?line:line?.text);if(text)out.push({text,ref:typeof line==='string'?('p'+(page?.number||p+1)+':l'+(i+1)):(line.ref||('p'+(page?.number||p+1)+':l'+(i+1))),page:Number(page?.number)||p+1,order:Number(line?.order)||i+1,bbox:typeof line==='string'?null:(line.bbox||null),items:typeof line==='string'?[]:(Array.isArray(line.items)?line.items:[])})}}return out
}
function groupKey(value){
 const raw=fold(groupValue(value)||clean(value));if(!raw)return'';
 let m=raw.match(/^G\s*0*(\d+)$/);if(m)return'GROUP:'+Number(m[1]);
 m=raw.match(/^GRUPO\s+0*(\d+)$/);if(m)return'GROUP:'+Number(m[1]);
 m=raw.match(/^GRUPO\s+(.+)$/);if(m)return'GROUP:'+m[1].trim();
 m=raw.match(/^TIPO\s+(.+)$/);if(m)return'TYPE:'+m[1].trim();
 m=raw.match(/^AREA\s+(.+)$/);if(m)return'AREA:'+m[1].trim();
 m=raw.match(/^NIVEL\s+(.+)$/);if(m)return'LEVEL:'+m[1].trim();
 return raw
}
function contextGroupKeys(rows){
 const out=[];for(const row of rows){const value=groupValue(row.text),key=groupKey(value);if(key&&!out.some(x=>x.key===key))out.push({key,value,ref:row.ref})}return out
}
function tokenMatch(text,value){
 const needle=fold(value);if(!needle)return false;const hay=fold(text),pattern=escRe(needle).replace(/\\\s+/g,'\\s+');return new RegExp('(?:^|[^A-Z0-9])'+pattern+'(?=$|[^A-Z0-9])','i').test(hay)
}
function stageBoundary(text){const f=fold(text);return SECTION_STOP.test(f)&&!objectiveHeading(text)}
function locateObjective(doc,cargo,availableCargos=[]){
 const rows=objectiveRows(doc),selected=cargo?{...cargo,group:cargo.group||''}:null,selectedGroupKey=groupKey(selected?.group||''),candidates=[];
 for(let i=0;i<rows.length;i++){
  const heading=objectiveHeading(rows[i].text);if(!heading)continue;
  let end=i;for(let j=i+1;j<Math.min(rows.length,i+150);j++){if(objectiveHeading(rows[j].text)||stageBoundary(rows[j].text))break;end=j}
  const context=rows.slice(Math.max(0,i-12),Math.min(rows.length,Math.max(end+1,i+34))).filter(x=>x.page===rows[i].page),contextText=context.map(x=>x.text).join('\n'),groups=contextGroupKeys(context),groupMatch=selectedGroupKey?groups.some(x=>x.key===selectedGroupKey):false,foreignGroups=selectedGroupKey?groups.filter(x=>x.key!==selectedGroupKey):[],cargoNameMatch=!!selected?.name&&tokenMatch(contextText,selected.name),cargoCodeMatch=!!selected?.code&&tokenMatch(contextText,selected.code),cargoMatch=cargoNameMatch||cargoCodeMatch;
  const otherCargo=Array.isArray(availableCargos)?availableCargos.find(x=>x&&x!==cargo&&((x.name&&tokenMatch(contextText,x.name))||(x.code&&tokenMatch(contextText,x.code)))&&!((selected?.name&&fold(x.name)===fold(selected.name))||(selected?.code&&fold(x.code)===fold(selected.code)))):null;
  const explicitGroupMismatch=!!selectedGroupKey&&groups.length>0&&!groupMatch;
  if(explicitGroupMismatch)continue;
  let score=10;if(groupMatch)score+=12;if(cargoMatch)score+=8;if(selectedGroupKey&&!groups.length)score+=1;if(otherCargo&&!cargoMatch)score-=7;
  const association=groupMatch?'group':cargoMatch?'cargo':'generic',mixedGroups=groupMatch&&foreignGroups.length>0,mixedCargo=!!otherCargo&&cargoMatch,evidence=[rows[i].ref];
  for(const row of context){if((selected?.group&&groupKey(groupValue(row.text))===selectedGroupKey)||(selected?.name&&tokenMatch(row.text,selected.name))||(selected?.code&&tokenMatch(row.text,selected.code)))evidence.push(row.ref)}
  candidates.push({type:'objective',kind:heading.kind,label:'Prova Objetiva',sourceLabel:heading.sourceLabel,page:rows[i].page,headingRef:rows[i].ref,startRef:rows[i].ref,endRef:rows[end]?.ref||rows[i].ref,startIndex:i,endIndex:end,association,score,mixedGroups,mixedCargo,group:selected?.group||'',cargoCode:selected?.code||'',cargoName:selected?.name||'',sourceRefs:[...new Set(evidence)],region:{pageStart:rows[i].page,pageEnd:rows[end]?.page||rows[i].page,startRef:rows[i].ref,endRef:rows[end]?.ref||rows[i].ref,lineCount:end-i+1}})
 }
 if(!candidates.length)return{type:'objective',status:'missing',label:'Prova Objetiva',selectedCargo:selected||null,sourceRefs:[],reason:'objective-heading-not-found',alternatives:[]};
 candidates.sort((a,b)=>b.score-a.score||a.page-b.page||a.startIndex-b.startIndex);
 const top=candidates[0],second=candidates[1],ambiguous=!!second&&(second.score===top.score||Math.abs(second.score-top.score)<=1),strongAssociation=selectedGroupKey?top.association==='group':selected?.name||selected?.code?top.association==='cargo':candidates.length===1,status=!ambiguous&&strongAssociation&&!top.mixedGroups&&!top.mixedCargo?'confirmed':'review';
 return{...top,status,selectedCargo:selected||null,reason:status==='confirmed'?'matched-selected-cargo-or-group':ambiguous?'multiple-plausible-objective-regions':top.association==='generic'?'objective-region-needs-association-review':'objective-region-needs-review',alternatives:candidates.slice(1,5).map(x=>({page:x.page,headingRef:x.headingRef,sourceLabel:x.sourceLabel,association:x.association,score:x.score,sourceRefs:x.sourceRefs}))}
}
const OBJECTIVE_TABLE_HEADER_PATTERNS=[
 ['label',/\b(?:DISCIPLINA|DISCIPLINAS|MATERIA|MATERIAS|COMPONENTE\s+CURRICULAR|COMPONENTES\s+CURRICULARES|AREA\s+DE\s+CONHECIMENTO|AREAS\s+DE\s+CONHECIMENTO|CONHECIMENTOS)\b/],
 ['questions',/\b(?:(?:N|NUMERO|QTD|QUANTIDADE)(?:\s+DE)?\s+)?(?:QUESTAO|QUESTOES|ITENS?)\b/],
 ['weight',/\b(?:PESO|VALOR\s+(?:DA|DE\s+CADA|POR)\s+QUESTAO|PONTOS?\s+POR\s+QUESTAO|PONTUACAO\s+POR\s+QUESTAO)\b/],
 ['minimum',/\b(?:MINIMO|MINIMA|PONTUACAO\s+MINIMA|PONTOS?\s+MINIMOS?|NOTA\s+MINIMA|ACERTOS?\s+MINIMOS?|MINIMO\s+DE\s+ACERTOS?|QUESTOES?\s+MINIMAS?)\b/],
 ['total',/\b(?:PONTUACAO\s+MAXIMA|TOTAL\s+DE\s+PONTOS|PONTOS\s+TOTAIS|VALOR\s+TOTAL|PONTUACAO|PONTOS|TOTAL)\b/]
];
function tableHeaderKind(value){
 const n=fold(value).replace(/[º°ª]/g,' ').replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();if(!n)return'';
 if(/^(?:DISCIPLINA|DISCIPLINAS|MATERIA|MATERIAS|COMPONENTE CURRICULAR|COMPONENTES CURRICULARES|AREA DE CONHECIMENTO|AREAS DE CONHECIMENTO|CONHECIMENTOS)$/.test(n))return'label';
 if(/^(?:(?:N|NUMERO|QTD|QUANTIDADE)(?: DE)? )?(?:QUESTAO|QUESTOES|ITENS?)$/.test(n))return'questions';
 if(/^(?:PESO|VALOR (?:DA|DE CADA|POR) QUESTAO|PONTOS? POR QUESTAO|PONTUACAO POR QUESTAO)$/.test(n))return'weight';
 if(/^(?:MINIMO|MINIMA|PONTUACAO MINIMA|PONTOS? MINIMOS?|NOTA MINIMA|ACERTOS? MINIMOS?|MINIMO DE ACERTOS?|QUESTOES? MINIMAS?)$/.test(n))return'minimum';
 if(/^(?:PONTUACAO MAXIMA|TOTAL DE PONTOS|PONTOS TOTAIS|VALOR TOTAL|PONTUACAO|PONTOS|TOTAL)$/.test(n))return'total';
 return''
}
function tableHeaderKindsFromText(value){
 const f=fold(value),out=[];for(const [kind,rx] of OBJECTIVE_TABLE_HEADER_PATTERNS){const m=rx.exec(f);if(m)out.push({kind,index:m.index,text:m[0]})}
 return out.sort((a,b)=>a.index-b.index).filter((x,i,a)=>a.findIndex(y=>y.kind===x.kind)===i)
}
function objectiveRegionRows(doc,location){
 if(!location||location.status==='missing')return[];const rows=objectiveRows(doc),start=Number.isInteger(location.startIndex)?location.startIndex:rows.findIndex(x=>x.ref===location.startRef),end=Number.isInteger(location.endIndex)?location.endIndex:rows.findIndex(x=>x.ref===location.endRef);
 if(start<0)return[];return rows.slice(start,Math.max(start+1,(end>=start?end:Math.min(rows.length-1,start+149))+1))
}
function tableHeaderAnchors(items){
 const arr=(items||[]).filter(x=>clean(x?.text)).sort((a,b)=>(Number(a.x)||0)-(Number(b.x)||0)),candidates=[];
 for(let i=0;i<arr.length;i++)for(let len=1;len<=Math.min(5,arr.length-i);len++){const part=arr.slice(i,i+len),kind=tableHeaderKind(part.map(x=>x.text).join(' '));if(kind)candidates.push({kind,x:Math.min(...part.map(x=>Number(x.x)||0)),span:len,text:part.map(x=>x.text).join(' ')})}
 const chosen=[];for(const kind of ['label','questions','weight','total','minimum']){const hits=candidates.filter(x=>x.kind===kind).sort((a,b)=>b.span-a.span||a.x-b.x);if(hits[0])chosen.push(hits[0])}
 return chosen.sort((a,b)=>a.x-b.x)
}
function validSectionLabel(value){
 const label=clean(value).replace(/^[\s:;|–—-]+|[\s:;|–—-]+$/g,'');if(!label||label.length>140||/^\d+(?:[.,]\d+)?$/.test(label))return false;
 const f=fold(label);if(/^(?:TOTAL|TOTAL GERAL|TOTAL DA PROVA|PONTUACAO TOTAL|PONTOS TOTAIS)$/.test(f)||tableHeaderKind(label))return false;
 return /[A-ZÀ-ÿ]/i.test(label)
}
function tableValue(value,kind){
 const raw=clean(value).replace(/[^\d,.-]+/g,'');if(!raw)return null;const n=num(raw);if(n===null||n<0)return null;
 if(kind==='questions')return Number.isInteger(n)&&n>0&&n<=500?n:null;
 return n<=100000?n:null
}
function minimumKindFromHeader(value){
 const f=fold(value);if(/ACERTO|QUESTAO/.test(f))return'questions';if(/PONTO|PONTUACAO|NOTA/.test(f))return'points';if(/%|PERCENT/.test(f))return'percentage';return'value'
}
function sectionId(label,used){
 let base=fold(label).toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'secao',id=base,n=2;while(used.has(id))id=base+'-'+n++;used.add(id);return id
}
function sectionFromCells(cells,sourceRef,mode,used){
 const label=clean(cells.label||'');if(!validSectionLabel(label))return null;
 const questions=tableValue(cells.questions,'questions'),givenWeight=tableValue(cells.weight,'weight'),givenTotal=tableValue(cells.total,'total'),minimumValue=tableValue(cells.minimum,'minimum'),minimumKind=cells.minimumKind||'value';
 if(questions===null&&givenTotal===null)return null;
 let pointsPerQuestion=givenWeight,totalPoints=givenTotal,pointsPerQuestionSource=givenWeight!==null?'edital':null,totalPointsSource=givenTotal!==null?'edital':null;
 if(totalPoints===null&&questions!==null&&pointsPerQuestion!==null){totalPoints=Math.round(questions*pointsPerQuestion*10000)/10000;totalPointsSource='calculated'}
 if(pointsPerQuestion===null&&questions&&totalPoints!==null){pointsPerQuestion=Math.round(totalPoints/questions*10000)/10000;pointsPerQuestionSource='calculated'}
 const minimum=minimumValue===null?null:{kind:minimumKind,value:minimumValue,source:'edital'};
 return{id:sectionId(label,used),label,questions,pointsPerQuestion,totalPoints,minimum,minimumPoints:minimumKind==='points'?minimumValue:null,minimumQuestions:minimumKind==='questions'?minimumValue:null,mapGroups:[label],sourceRefs:sourceRef?[sourceRef]:[],extractionMode:mode,pointsPerQuestionSource,totalPointsSource}
}
function finalizeObjectiveSections(sections,meta={}){
 const unique=[];for(const s of sections||[]){const key=fold(s.label)+'|'+String(s.questions??'')+'|'+String(s.totalPoints??'');if(!unique.some(x=>x._key===key))unique.push({...s,_key:key})}
 unique.forEach(x=>delete x._key);const allQ=unique.length&&unique.every(x=>Number.isFinite(x.questions)),allP=unique.length&&unique.every(x=>Number.isFinite(x.totalPoints)),totalQuestions=allQ?unique.reduce((a,x)=>a+x.questions,0):null,totalPoints=allP?Math.round(unique.reduce((a,x)=>a+x.totalPoints,0)*10000)/10000:null;
 unique.forEach(s=>{s.planWeight=totalPoints?Math.round((s.totalPoints||0)*10000/totalPoints)/100:null;s.planWeightSource=s.planWeight===null?null:'calculated'});
 return{status:unique.length?(meta.locationStatus==='confirmed'&&allQ?'parsed':'review'):'missing',mode:meta.mode||'none',headerRef:meta.headerRef||'',columns:meta.columns||[],sections:unique,totalQuestions,totalPoints,sourceRefs:[...new Set([meta.headerRef,...unique.flatMap(x=>x.sourceRefs||[])].filter(Boolean))]}
}
function parseGeometryObjectiveTable(rows,locationStatus){
 for(let i=0;i<Math.min(rows.length,18);i++){const anchors=tableHeaderAnchors(rows[i].items);if(!anchors.some(x=>x.kind==='label')||!anchors.some(x=>['questions','weight','total'].includes(x.kind)))continue;
  const used=new Set(),sections=[],columns=anchors.map(x=>x.kind),headerRef=rows[i].ref;let pending='',misses=0;
  for(let r=i+1;r<rows.length;r++){const row=rows[r];if(objectiveHeading(row.text)||stageBoundary(row.text))break;const repeated=tableHeaderAnchors(row.items);if(repeated.some(x=>x.kind==='label')&&repeated.some(x=>['questions','weight','total'].includes(x.kind)))continue;
   const cells={label:'',questions:'',weight:'',total:'',minimum:'',minimumKind:minimumKindFromHeader(anchors.find(x=>x.kind==='minimum')?.text||'')};for(const item of row.items||[]){if(!clean(item.text))continue;let chosen=anchors[0];for(const a of anchors)if(Math.abs((Number(item.x)||0)-a.x)<Math.abs((Number(item.x)||0)-chosen.x))chosen=a;cells[chosen.kind]+=(cells[chosen.kind]?' ':'')+clean(item.text)}
   const hasNumeric=['questions','weight','total'].some(k=>tableValue(cells[k],k)!==null),label=clean(cells.label);
   if(!hasNumeric&&validSectionLabel(label)){pending=label;continue}
   if(hasNumeric&&!label&&pending)cells.label=pending;
   const section=sectionFromCells(cells,row.ref,'geometry',used);if(section){sections.push(section);pending='';misses=0}else if(clean(row.text)){misses++;if(sections.length&&misses>=8)break}
  }
  if(sections.length)return finalizeObjectiveSections(sections,{mode:'geometry',headerRef,columns,locationStatus})
 }
 return finalizeObjectiveSections([],{locationStatus})
}
function parseDelimitedObjectiveTable(rows,locationStatus){
 const sep=/\s*[|;\t]\s*/;for(let i=0;i<Math.min(rows.length,20);i++){if(!/[|;\t]/.test(rows[i].text))continue;const heads=rows[i].text.split(sep).map(clean),kinds=heads.map(tableHeaderKind),labelIndex=kinds.indexOf('label');if(labelIndex<0||!kinds.some(x=>['questions','weight','total'].includes(x)))continue;
  const used=new Set(),sections=[];let misses=0;for(let r=i+1;r<rows.length;r++){if(objectiveHeading(rows[r].text)||stageBoundary(rows[r].text))break;if(!/[|;\t]/.test(rows[r].text)){if(sections.length&&++misses>=4)break;continue}const cols=rows[r].text.split(sep).map(clean),cells={minimumKind:minimumKindFromHeader(heads[kinds.indexOf('minimum')]||'')};for(let c=0;c<kinds.length;c++)if(kinds[c])cells[kinds[c]]=cols[c]||'';const s=sectionFromCells(cells,rows[r].ref,'delimited',used);if(s){sections.push(s);misses=0}}
  if(sections.length)return finalizeObjectiveSections(sections,{mode:'delimited',headerRef:rows[i].ref,columns:kinds.filter(Boolean),locationStatus})
 }
 return finalizeObjectiveSections([],{locationStatus})
}
function parseTextObjectiveTable(rows,locationStatus){
 for(let i=0;i<Math.min(rows.length,20);i++){const kinds=tableHeaderKindsFromText(rows[i].text),numeric=kinds.filter(x=>x.kind!=='label').map(x=>x.kind);if(!kinds.some(x=>x.kind==='label')||!numeric.some(x=>['questions','weight','total'].includes(x)))continue;
  const used=new Set(),sections=[];let misses=0;for(let r=i+1;r<rows.length;r++){const row=rows[r];if(objectiveHeading(row.text)||stageBoundary(row.text))break;const tokens=[...row.text.matchAll(/\d{1,5}(?:[.,]\d+)?/g)];if(!tokens.length){if(sections.length&&++misses>=7)break;continue}const take=Math.min(tokens.length,numeric.length),selected=tokens.slice(-take),suffix=row.text.slice(selected[0].index);if(!/^[\d\s,.;]+$/.test(suffix)){if(sections.length&&++misses>=7)break;continue}const label=clean(row.text.slice(0,selected[0].index)),minHeader=kinds.find(x=>x.kind==='minimum')?.text||'',cells={label,minimumKind:minimumKindFromHeader(minHeader)};for(let k=0;k<take;k++)cells[numeric[k]]=selected[k][0];const s=sectionFromCells(cells,row.ref,'text',used);if(s){sections.push(s);misses=0}else if(sections.length&&++misses>=7)break}
  if(sections.length)return finalizeObjectiveSections(sections,{mode:'text',headerRef:rows[i].ref,columns:kinds.map(x=>x.kind),locationStatus})
 }
 return finalizeObjectiveSections([],{locationStatus})
}
function parseObjectiveTable(doc,location){
 const rows=objectiveRegionRows(doc,location);if(!rows.length)return finalizeObjectiveSections([],{locationStatus:location?.status||'missing'});
 const geometry=parseGeometryObjectiveTable(rows,location?.status);if(geometry.sections.length)return geometry;
 const delimited=parseDelimitedObjectiveTable(rows,location?.status);if(delimited.sections.length)return delimited;
 return parseTextObjectiveTable(rows,location?.status)
}
const MONTHS_PT={JANEIRO:'01',FEVEREIRO:'02',MARCO:'03','MARÇO':'03',ABRIL:'04',MAIO:'05',JUNHO:'06',JULHO:'07',AGOSTO:'08',SETEMBRO:'09',OUTUBRO:'10',NOVEMBRO:'11',DEZEMBRO:'12'};
function parseAnyDate(value){
 const raw=clean(value);let m=raw.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2})\b/);if(m)return m[3]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0');
 m=raw.match(/\b(\d{1,2})\s+de\s+(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(20\d{2})\b/i);if(!m)return'';const mm=MONTHS_PT[fold(m[2])]||'';return mm?m[3]+'-'+mm+'-'+String(m[1]).padStart(2,'0'):''
}
function parseDurationMinutes(value){
 const raw=clean(value);let m=raw.match(/\b(\d{1,2})\s*h(?:oras?)?\s*(?:(?:e\s*)?(\d{1,2})\s*(?:min(?:utos?)?)?)?\b/i);if(m){const h=Number(m[1]),min=Number(m[2]||0);if(h<=12&&min<60)return h*60+min}
 m=raw.match(/\b(\d{1,3})\s*minutos?\b/i);if(m){const min=Number(m[1]);if(min>=30&&min<=720)return min}
 m=raw.match(/\bdura[cç][aã]o[^\d]{0,30}(\d{1,2})\s*\([^)]*\)\s*horas?(?:\s*e\s*(\d{1,2})\s*\([^)]*\)\s*minutos?)?/i);if(m)return Number(m[1])*60+Number(m[2]||0);
 return null
}
function objectiveExamDate(rows){
 const out=[];for(let i=0;i<rows.length;i++){const row=rows[i],f=fold(row.text);if(/GABARITO|RESULTADO|RECURSO|PUBLICACAO|CONVOCACAO/.test(f))continue;const context=[rows[i-1]?.text,row.text,rows[i+1]?.text].filter(Boolean).join(' '),date=parseAnyDate(context);if(!date)continue;let score=0;if(/APLICA|REALIZA/.test(f))score+=6;if(/PROVA\s+(?:TEORICO\s*[-–—]?\s*)?OBJETIVA|PROVA\s+ESCRITA\s+OBJETIVA|PROVA\s+DE\s+CONHECIMENTOS/.test(f))score+=5;if(/DATA/.test(f))score+=1;if(score>0)out.push({date,status:/PROVAVEL|PREVIST[AO]/.test(f)?'provável':'edital',sourceRef:row.ref,score})}
 out.sort((a,b)=>b.score-a.score);return out[0]||null
}
function objectiveDuration(rows,localRows){
 const candidates=[...(localRows||[]),...rows.filter(x=>/DURA[CÇ][AÃ]O|TEMPO\s+(?:DE|PARA)|HORAS?\s+DE\s+PROVA/.test(fold(x.text)))],seen=new Set(),out=[];
 for(const row of candidates){if(!row||seen.has(row.ref))continue;seen.add(row.ref);const context=[row.text].join(' '),minutes=parseDurationMinutes(context);if(minutes===null)continue;let score=1;const f=fold(row.text);if(/DURA[CÇ][AÃ]O|TEMPO\s+(?:DE|PARA)/.test(f))score+=4;if(/PROVA/.test(f))score+=2;out.push({minutes,sourceRef:row.ref,score})}
 out.sort((a,b)=>b.score-a.score);return out[0]||null
}
function objectiveCharacter(rows,localRows){
 const candidates=[...(localRows||[]),...rows.filter(x=>/ELIMINATOR|CLASSIFICATOR/.test(fold(x.text)))],seen=new Set();
 for(const row of candidates){if(!row||seen.has(row.ref))continue;seen.add(row.ref);const f=fold(row.text);if(/ELIMINATORI[OA]\s+E\s+CLASSIFICATORI[OA]/.test(f))return{value:'Eliminatório e classificatório',sourceRef:row.ref};if(/ELIMINATOR/.test(f))return{value:'Eliminatório',sourceRef:row.ref};if(/CLASSIFICATOR/.test(f))return{value:'Classificatório',sourceRef:row.ref}}
 return null
}
function objectiveMinimum(rows,localRows){
 const candidates=[...(localRows||[]),...rows.filter(x=>/MINIM|APROVAD|ELIMINAD/.test(fold(x.text)))],seen=new Set();
 for(const row of candidates){if(!row||seen.has(row.ref))continue;seen.add(row.ref);const text=clean(row.text),f=fold(text);if(!/MINIM|APROVAD|ELIMINAD/.test(f))continue;
  let m=text.match(/(?:pontua[cç][aã]o|nota)?\s*m[ií]nima(?:\s+geral)?(?:\s+de)?\s*(\d{1,3}(?:[.,]\d+)?)\s*(%|pontos?)/i)||text.match(/(?:obter|alcan[cç]ar|atingir)[^\d%]{0,60}(?:no\s+m[ií]nimo\s+)?(\d{1,3}(?:[.,]\d+)?)\s*(%|pontos?)/i)||text.match(/(\d{1,3}(?:[.,]\d+)?)\s*(%|pontos?)[^\n]{0,80}(?:m[ií]nimo|m[ií]nima|aprova[cç][aã]o)/i);
  if(!m)continue;const value=num(m[1]);if(value===null)continue;const unit=m[2]==='%'?'percentage':'points';return{kind:unit,value,label:unit==='percentage'?'mínimo geral de '+String(value).replace('.',',')+'%':'mínimo geral de '+String(value).replace('.',',')+' pontos',sourceRef:row.ref}
 }
 return null
}
function extractResponseModel(doc,location){
 const rows=objectiveRows(doc),localRows=objectiveRegionRows(doc,location),seen=new Set(),candidates=[];
 for(const row of [...localRows,...rows]){if(!row?.ref||seen.has(row.ref))continue;seen.add(row.ref);const f=fold(row.text);if(/ALTERNATIV|MULTIPLA ESCOLHA|CERTO|ERRADO|GABARITO|PONTUACAO NEGATIVA|ANULA|DESCONT|FORMULA|NOTA LIQUIDA/.test(f))candidates.push(row)}
 let answerModel='',alternatives=null,scoringModel='',scoringRuleRaw='',modelRef='',scoringRef='';
 for(const row of candidates){const text=clean(row.text),f=fold(text);
  if(!answerModel&&/(?:CERTO\s*(?:\/|OU|E)\s*ERRADO|ITENS?\s+(?:SERAO\s+)?JULGADOS?\s+(?:COMO\s+)?CERTO)/.test(f)){answerModel='true-false';alternatives=2;modelRef=row.ref}
  if(!answerModel){let m=text.match(/(?:AT[EÉ]\s+)?(\d)\s*(?:\([^)]*\))?\s*alternativas?/i);if(!m)m=text.match(/alternativas?\s*(?:de\s*)?\(?\s*A\s*(?:a|até|-)\s*([D-E])\s*\)?/i);if(!m)m=text.match(/\bA\s*[,;]\s*B\s*[,;]\s*C\s*(?:[,;]\s*D)(?:\s*[,;e]\s*E)?/i);if(m){answerModel='multiple-choice';if(/^\d$/.test(m[1]||''))alternatives=Number(m[1]);else if(/[D-E]/i.test(m[1]||''))alternatives=(m[1].toUpperCase().charCodeAt(0)-64);else alternatives=/\bE\b/i.test(text)?5:4;modelRef=row.ref}}
  if(!scoringModel&&/(?:ERRAD[AO].{0,45}(?:ANULA|DESCONTA)|PONTUACAO\s+NEGATIVA|RESPOSTA\s+INCORRETA.{0,45}(?:PERDE|DESCONTA)|UMA\s+ERRADA.{0,45}UMA\s+CERTA)/.test(f)){scoringModel='negative-marking';scoringRuleRaw=text;scoringRef=row.ref}
  else if(!scoringRuleRaw&&/(?:FORMULA|NOTA\s+LIQUIDA|CALCULO\s+DA\s+NOTA|PONTUACAO\s+SERA\s+CALCULADA)/.test(f)){scoringModel=scoringModel||'custom';scoringRuleRaw=text;scoringRef=row.ref}
 }
 if(answerModel&&!scoringModel)scoringModel='standard';
 const sourceRefs=[modelRef,scoringRef].filter(Boolean);
 return{status:answerModel||scoringRuleRaw?'parsed':'missing',answerModel,alternatives,scoringModel,scoringRuleRaw,sourceRefs:[...new Set(sourceRefs)],evidence:{responseModel:modelRef?[modelRef]:[],scoringRule:scoringRef?[scoringRef]:[]}}
}
function extractObjectiveRules(doc,location,exam){
 const rows=objectiveRows(doc),localRows=objectiveRegionRows(doc,location),date=objectiveExamDate(rows),dur=objectiveDuration(rows,localRows),character=objectiveCharacter(rows,localRows),minimum=objectiveMinimum(rows,localRows),response=extractResponseModel(doc,location),sectionMinimums=(exam?.sections||[]).filter(x=>x.minimum).map(x=>({sectionId:x.id,label:x.label,...x.minimum,sourceRefs:x.sourceRefs||[]}));
 const sourceRefs=[date?.sourceRef,dur?.sourceRef,character?.sourceRef,minimum?.sourceRef,...response.sourceRefs,...sectionMinimums.flatMap(x=>x.sourceRefs||[])].filter(Boolean);
 return{status:(date||dur||character||minimum||response.status==='parsed'||sectionMinimums.length)?'parsed':'missing',date:date?.date||'',dateStatus:date?.status||'',durationMinutes:dur?.minutes??null,character:character?.value||'',minimum:minimum?{kind:minimum.kind,value:minimum.value,label:minimum.label}:null,answerModel:response.answerModel,alternatives:response.alternatives,scoringModel:response.scoringModel,scoringRuleRaw:response.scoringRuleRaw,sectionMinimums,sourceRefs:[...new Set(sourceRefs)],evidence:{date:date?.sourceRef?[date.sourceRef]:[],durationMinutes:dur?.sourceRef?[dur.sourceRef]:[],character:character?.sourceRef?[character.sourceRef]:[],minimum:minimum?.sourceRef?[minimum.sourceRef]:[],responseModel:response.evidence.responseModel,scoringRule:response.evidence.scoringRule,sectionMinimums:[...new Set(sectionMinimums.flatMap(x=>x.sourceRefs||[]))]}}
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
const PROGRAM_START=/^(?:(?:ANEXO\s+[A-Z0-9IVXLCDM.-]+\s*[-–—:]?\s*)?)(?:CONTEUDOS?\s+PROGRAMATICOS?|PROGRAMA\s+(?:DAS?|DE)\s+PROVAS?|PROGRAMA\s+DE\s+CONHECIMENTOS)\b/i;
const PROGRAM_STOP=/^(?:CRONOGRAMA|CALENDARIO|QUADRO\s+DE\s+VAGAS|REQUISITOS?\s+(?:DOS?\s+)?CARGOS?|ATRIBUICOES?\s+(?:DOS?\s+)?CARGOS?|DAS?\s+INSCRICOES|DA\s+AVALIACAO\s+DE\s+TITULOS|PROVA\s+DE\s+TITULOS|PROVA\s+PRATICA|CURSO\s+DE\s+FORMACAO)\b/i;
const PROGRAM_SCOPE_WORDS=/\b(?:CARGO|CARGOS|FUNCAO|FUNCOES|EMPREGO|EMPREGOS|ESPECIALIDADE|ESPECIALIDADES|GRUPO|TIPO\s+DE\s+PROVA|AREA|NIVEL)\b/i;
function programRows(doc){
 if(doc&&typeof doc==='object')return objectiveRows(doc);
 return String(doc||'').split(/\r?\n/).map((text,i)=>({text:clean(text),ref:'text:l'+(i+1),page:1,order:i+1,items:[]})).filter(x=>x.text)
}
function programRegions(rows){
 const starts=[];for(let i=0;i<rows.length;i++)if(PROGRAM_START.test(fold(rows[i].text)))starts.push(i);
 const regions=[];for(let s=0;s<starts.length;s++){const start=starts[s],next=starts[s+1]??rows.length;let end=Math.min(next-1,start+700);
  for(let i=start+1;i<=end;i++){const f=fold(rows[i].text);if(i>start+2&&PROGRAM_STOP.test(f)){end=i-1;break}if(i>start+2&&/^ANEXO\s+[A-Z0-9IVXLCDM.-]+\b/.test(f)&&!PROGRAM_START.test(f)){end=i-1;break}}
  if(end>start)regions.push({start,end,startRef:rows[start].ref,endRef:rows[end]?.ref||rows[start].ref})
 }
 return regions
}
function sectionMatchLine(text,sections=[]){
 const raw=clean(text);if(!raw)return null;const f=fold(raw),ordered=(sections||[]).filter(x=>clean(x?.label)).sort((a,b)=>clean(b.label).length-clean(a.label).length);
 for(const sec of ordered){const label=clean(sec.label),sf=fold(label),at=f.indexOf(sf);if(at<0||at>45)continue;const before=f.slice(0,at).trim();if(before&&!/^(?:NIVEL\s+(?:SUPERIOR|MEDIO|FUNDAMENTAL)(?:\s+COMPLETO)?|PROGRAMA|CONTEUDO\s+PROGRAMATICO)\s*[-–—:]?$/.test(before))continue;
  const rest=raw.slice(at+label.length);let body='';const pm=rest.match(/\bPROGRAMA\s*:\s*(.+)$/i);if(pm)body=clean(pm[1]);else{const m=rest.match(/^\s*[:–—-]\s*(.+)$/);if(m&&!PROGRAM_SCOPE_WORDS.test(fold(m[1])))body=clean(m[1])}
  return{label,sectionId:sec.id||'',body,matched:true}
 }
 const inline=raw.match(/^([^:]{3,100})\s*:\s*(.{12,})$/);if(inline&&!PROGRAM_SCOPE_WORDS.test(fold(inline[1]))&&!PROGRAM_START.test(fold(inline[1]))&&!PROGRAM_STOP.test(fold(inline[1]))&&!/\b(?:EDITAL|ANEXO|CAPITULO|TITULO)\b/.test(fold(inline[1])))return{label:clean(inline[1]),sectionId:'',body:clean(inline[2]),matched:false};
 const short=raw.length<=90&&raw.split(/\s+/).length<=10&&!/[.;]$/.test(raw)&&!PROGRAM_SCOPE_WORDS.test(f)&&!PROGRAM_START.test(f)&&!PROGRAM_STOP.test(f)&&!/^ANEXO\b/.test(f);
 if(short&&/^[A-ZÀ-Ü0-9 ()/&.-]+$/.test(raw)&&/[A-ZÀ-Ü]{3}/.test(raw))return{label:titleCase(raw),sectionId:'',body:'',matched:false};
 return null
}
function programScopeDecision(text,cargo,available=[]){
 const raw=clean(text),f=fold(raw);if(!raw)return null;
 if(/\b(?:CARGOS?|FUNCOES?|EMPREGOS?|ESPECIALIDADES?)\s*:\s*(?:TODOS|TODAS)|\bTODOS\s+OS\s+CARGOS\b/.test(f))return{kind:'common',allowed:true,association:'common'};
 const selectedGroup=groupKey(cargo?.group||''),lineGroup=groupKey(groupValue(raw));if(lineGroup&&/\b(?:GRUPO|TIPO\s+DE\s+PROVA|AREA|NIVEL)\b/.test(f))return{kind:'group',allowed:!selectedGroup||lineGroup===selectedGroup,association:lineGroup===selectedGroup?'group':'foreign-group'};
 if(/\b(?:CARGO|FUNCAO|EMPREGO|ESPECIALIDADE)\b/.test(f)){const own=!!cargo&&((cargo.code&&tokenMatch(raw,cargo.code))||(cargo.name&&tokenMatch(raw,cargo.name))),other=(available||[]).find(x=>x&&((x.code&&tokenMatch(raw,x.code))||(x.name&&tokenMatch(raw,x.name)))&&!((cargo?.code&&fold(x.code)===fold(cargo.code))||(cargo?.name&&fold(x.name)===fold(cargo.name))));if(own)return{kind:'cargo',allowed:true,association:'cargo'};if(other)return{kind:'cargo',allowed:false,association:'foreign-cargo'}}
 return null
}
function cleanProgramBody(lines){return clean((lines||[]).map(x=>clean(x)).filter(Boolean).join(' ')).replace(/\s+([,.;:])/g,'$1')}
function legacyProgram(text,cargo){
 const out=[],capture=(label,start,end)=>{const m=text.match(new RegExp(start+'\\s*PROGRAMA\\s*:\\s*([\\s\\S]*?)(?='+end+'|$)','i'));if(m){const body=clean(m[1]).replace(/\n+/g,' ');if(body.length>20)out.push({label,text:body,source:'edital',sourceRefs:[],scope:'legacy',association:'legacy',status:'review'})}};
 capture('Língua Portuguesa','(?:N[ÍI]VEL\\s+SUPERIOR\\s+COMPLETO\\s+)?L[ÍI]NGUA\\s+PORTUGUESA(?:\\s+CARGOS?\\s*:\\s*TODOS)?','(?:N[ÍI]VEL\\s+SUPERIOR\\s+COMPLETO\\s+)?LEGISLA[CÇ][AÃ]O');
 capture('Legislação','(?:N[ÍI]VEL\\s+SUPERIOR\\s+COMPLETO\\s+)?LEGISLA[CÇ][AÃ]O(?:\\s+CARGOS?\\s*:\\s*TODOS)?','(?:N[ÍI]VEL\\s+(?:SUPERIOR|M[EÉ]DIO)\\s+COMPLETO\\s+)?CONHECIMENTOS\\s+ESPEC[ÍI]FICOS');
 if(cargo?.name){const code=cargo.code?escRe(cargo.code).replace(/\s+/g,'\\s*'):'(?:CP\\s*\\d+)',name=escRe(cargo.name).replace(/\s+/g,'\\s+');capture('Conhecimentos Específicos','CONHECIMENTOS\\s+ESPEC[ÍI]FICOS\\s+CARGO\\s+'+code+'\\s*:\\s*'+name,'(?:N[ÍI]VEL\\s+(?:SUPERIOR|M[EÉ]DIO)\\s+COMPLETO\\s+)?CONHECIMENTOS\\s+ESPEC[ÍI]FICOS\\s+CARGO|ANEXO\\s+V|$')}
 return out
}
function extractProgram(doc,cargo,sections=[],available=[]){
 const rows=programRows(doc),regions=programRegions(rows),blocks=[],seen=new Set();let genericHeadings=0,excludedScopes=0;
 for(const region of regions){let allowed=true,scope='common',association='common',current=null;
  const flush=()=>{if(!current)return;const body=cleanProgramBody(current.body),key=fold(current.label)+'|'+fold(body);if(body.length>=8&&!seen.has(key)){seen.add(key);blocks.push({label:current.label,text:body,source:'edital',sourceRefs:[...new Set(current.refs)],scope:current.scope,association:current.association,sectionId:current.sectionId||'',status:current.matched?'confirmed':'review'})}current=null};
  for(let i=region.start+1;i<=region.end;i++){const row=rows[i],scopeInfo=programScopeDecision(row.text,cargo,available),heading=sectionMatchLine(row.text,sections);if(scopeInfo){if(!heading)flush();allowed=scopeInfo.allowed;scope=scopeInfo.kind;association=scopeInfo.association;if(!allowed)excludedScopes++}if(heading){flush();if(!allowed)continue;if(!heading.matched)genericHeadings++;current={label:heading.label,sectionId:heading.sectionId,matched:heading.matched,body:heading.body?[heading.body]:[],refs:[row.ref],scope,association};continue}if(current&&allowed){current.body.push(row.text);current.refs.push(row.ref)}}
  flush()
 }
 if(!blocks.length){const fallback=legacyProgram(clean(doc?.text??doc),cargo);if(fallback.length)return{status:'review',mode:'legacy',blocks:fallback,regions:regions.length,excludedScopes,sourceRefs:[]}}
 const matched=blocks.filter(x=>x.status==='confirmed').length,status=blocks.length?(genericHeadings||matched<blocks.length?'review':'parsed'):'missing';
 return{status,mode:blocks.length?'document-map':'none',blocks,regions:regions.length,excludedScopes,sourceRefs:[...new Set(blocks.flatMap(x=>x.sourceRefs||[]))]}
}
function program(input,cargo,sections=[],available=[]){return extractProgram(input,cargo,sections,available).blocks}
function evidenceRefs(rows,values,limit=8){
 const needles=(Array.isArray(values)?values:[values]).map(clean).filter(Boolean),out=[];for(const row of rows||[]){if(!row?.ref)continue;let hit=false;for(const value of needles){const short=value.replace(/^Edital\s+/i,'');if(tokenMatch(row.text,value)||tokenMatch(row.text,short)||fold(row.text).includes(fold(short))){hit=true;break}}if(hit&&!out.includes(row.ref)){out.push(row.ref);if(out.length>=limit)break}}return out
}
function confidenceLevel(score){return score>=.85?'high':score>=.6?'medium':'low'}
function evidenceField(value,confidence,sourceRefs=[],reason='',derived=false){
 const present=value!==null&&value!==undefined&&value!==''&&!(Array.isArray(value)&&!value.length),score=present?Math.max(0,Math.min(1,Number(confidence)||0)):0;
 return{value:present?value:null,confidence:Math.round(score*100)/100,level:confidenceLevel(score),status:present?(score>=.85?'confirmed':'review'):'missing',sourceRefs:[...new Set((sourceRefs||[]).filter(Boolean))],reason,derived:!!derived,conflictIds:[]}
}
function objectiveDateCandidates(rows){
 const out=[];for(let i=0;i<(rows||[]).length;i++){const row=rows[i],f=fold(row.text);if(!/APLICA|REALIZA/.test(f)||!/PROVA/.test(f)||/GABARITO|RESULTADO|RECURSO/.test(f))continue;const context=[rows[i-1]?.text,row.text,rows[i+1]?.text].filter(Boolean).join(' '),date=parseAnyDate(row.text)||parseAnyDate(context);if(date&&!out.some(x=>x.value===date&&x.ref===row.ref))out.push({value:date,ref:row.ref})}return out
}
function objectiveDurationCandidates(rows){
 const out=[];for(const row of rows||[]){const f=fold(row.text);if(!/DURA[CÇ][AÃ]O|TEMPO\s+(?:DE|PARA)|HORAS?\s+DE\s+PROVA/.test(f))continue;const value=parseDurationMinutes(row.text);if(value!==null&&!out.some(x=>x.value===value&&x.ref===row.ref))out.push({value,ref:row.ref})}return out
}
function minimumStatement(value){
 const text=clean(value);let m=text.match(/(?:pontua[cç][aã]o|nota)?\s*m[ií]nima(?:\s+geral)?(?:\s+de)?\s*(\d{1,3}(?:[.,]\d+)?)\s*(%|pontos?)/i)||text.match(/(?:obter|alcan[cç]ar|atingir)[^\d%]{0,60}(?:no\s+m[ií]nimo\s+)?(\d{1,3}(?:[.,]\d+)?)\s*(%|pontos?)/i)||text.match(/(\d{1,3}(?:[.,]\d+)?)\s*(%|pontos?)[^\n]{0,80}(?:m[ií]nimo|m[ií]nima|aprova[cç][aã]o)/i);if(!m)return null;const n=num(m[1]);return n===null?null:{kind:m[2]==='%'?'percentage':'points',value:n}
}
function objectiveMinimumCandidates(rows){
 const out=[];for(const row of rows||[]){if(!/MINIM|APROVAD|ELIMINAD/.test(fold(row.text)))continue;const m=minimumStatement(row.text);if(m&&!out.some(x=>x.kind===m.kind&&x.value===m.value&&x.ref===row.ref))out.push({...m,ref:row.ref})}return out
}
function distinctCandidateValues(list,key=x=>String(x.value)){const map=new Map();for(const x of list||[]){const k=key(x);if(!map.has(k))map.set(k,{value:x.value,kind:x.kind||'',sourceRefs:[]});const row=map.get(k);if(x.ref&&!row.sourceRefs.includes(x.ref))row.sourceRefs.push(x.ref)}return[...map.values()]}
function extractionConflicts(doc,ctx){
 const rows=objectiveRows(doc),localRows=objectiveRegionRows(doc,ctx.objectiveLocation),conflicts=[],add=(id,type,fields,message,values,refs,severity='warning')=>{if(!conflicts.some(x=>x.id===id))conflicts.push({id,type,severity,fields,message,values:values||[],sourceRefs:[...new Set((refs||[]).filter(Boolean))]})};
 const dates=distinctCandidateValues(objectiveDateCandidates(rows));if(dates.length>1)add('exam-date-conflict','conflicting-values',['examDate'],'O edital apresenta mais de uma data plausível para a aplicação da prova objetiva.',dates,dates.flatMap(x=>x.sourceRefs),'error');
 const durations=distinctCandidateValues(objectiveDurationCandidates([...localRows,...rows]));if(durations.length>1)add('duration-conflict','conflicting-values',['durationMinutes'],'Foram encontradas durações divergentes associadas à prova objetiva.',durations,durations.flatMap(x=>x.sourceRefs),'error');
 const minimums=distinctCandidateValues(objectiveMinimumCandidates([...localRows,...rows]),x=>x.kind+':'+x.value);if(minimums.length>1)add('minimum-conflict','conflicting-values',['minimum'],'Foram encontrados critérios mínimos gerais divergentes.',minimums,minimums.flatMap(x=>x.sourceRefs),'error');
 if(ctx.objectiveLocation?.status==='review'&&ctx.objectiveLocation?.alternatives?.length)add('objective-location-ambiguous','ambiguous-source',['objectiveLocation','objectiveTable'],'Há mais de uma região plausível para a prova objetiva do cargo selecionado.',ctx.objectiveLocation.alternatives,[...(ctx.objectiveLocation.sourceRefs||[]),...ctx.objectiveLocation.alternatives.flatMap(x=>x.sourceRefs||[])]);
 const byLabel=new Map();for(const s of ctx.exam?.sections||[]){const k=fold(s.label);if(!byLabel.has(k))byLabel.set(k,[]);byLabel.get(k).push(s)}for(const [k,list] of byLabel){const sig=[...new Set(list.map(x=>[x.questions,x.pointsPerQuestion,x.totalPoints,x.minimumPoints,x.minimumQuestions].join('|')))];if(list.length>1&&sig.length>1)add('section-conflict-'+k.replace(/[^a-z0-9]+/g,'-'),'conflicting-values',['objectiveTable'],'A mesma disciplina aparece com métricas divergentes na estrutura da prova.',list.map(x=>({label:x.label,questions:x.questions,totalPoints:x.totalPoints,minimumPoints:x.minimumPoints,minimumQuestions:x.minimumQuestions})),list.flatMap(x=>x.sourceRefs||[]),'error')}
 for(const s of ctx.exam?.sections||[]){if(Number.isFinite(s.minimumPoints)&&Number.isFinite(s.totalPoints)&&s.minimumPoints>s.totalPoints)add('minimum-over-total-'+s.id,'structural-conflict',['objectiveTable','minimum'],'O mínimo da disciplina excede sua pontuação total.',[{label:s.label,minimum:s.minimumPoints,total:s.totalPoints}],s.sourceRefs||[],'error');if(Number.isFinite(s.minimumQuestions)&&Number.isFinite(s.questions)&&s.minimumQuestions>s.questions)add('minimum-over-questions-'+s.id,'structural-conflict',['objectiveTable','minimum'],'O mínimo de questões excede a quantidade de questões da disciplina.',[{label:s.label,minimum:s.minimumQuestions,questions:s.questions}],s.sourceRefs||[],'error')}
 return conflicts
}
function buildEvidenceReport(doc,ctx){
 const rows=objectiveRows(doc),cargoRefs=evidenceRefs(rows,[ctx.selected?.code,ctx.selected?.name]),groupRefs=evidenceRefs(rows,ctx.selected?.group),orgRefs=evidenceRefs(rows,[ctx.officialName,ctx.organizationAcronym]),boardRefs=evidenceRefs(rows,ctx.board),cityRefs=evidenceRefs(rows,[ctx.cityName,ctx.uf]),noticeRefs=evidenceRefs(rows,[ctx.notice,String(ctx.notice||'').replace(/^Edital\s+/i,'')]),publicationRefs=evidenceRefs(rows,ctx.publicationDate);
 const cargoConfidence=ctx.selected?.source==='geometry'?0.98:ctx.selected?.source==='delimited'?0.95:ctx.selected?.source==='explicit'||ctx.selected?.source==='line'?0.9:ctx.selected?0.76:0;
 const fields={
  title:evidenceField(ctx.title,ctx.title?.length?(orgRefs.length?.78:.62):0,orgRefs,'Nome curto derivado da identificação do órgão.',true),
  organization:evidenceField(ctx.officialName,orgRefs.length?.94:ctx.officialName?.length?.68:0,orgRefs,'Órgão/instituição identificado no edital.'),
  position:evidenceField(ctx.selected?.name||'',cargoConfidence,cargoRefs,'Cargo selecionado para a importação.'),
  positionCode:evidenceField(ctx.selected?.code||'',ctx.selected?.code?(cargoRefs.length?.94:.72):0,cargoRefs,'Código do cargo quando explicitamente identificado.'),
  examGroup:evidenceField(ctx.selected?.group||'',ctx.selected?.group?(groupRefs.length?.94:.72):0,groupRefs,'Grupo/tipo de prova associado ao cargo.'),
  board:evidenceField(ctx.board,ctx.board?(boardRefs.length?.92:.7):0,boardRefs,'Banca identificada no documento.'),
  city:evidenceField(ctx.city,ctx.city?(cityRefs.length?.8:.62):0,cityRefs,'Localidade inferida a partir do edital.'),
  notice:evidenceField(ctx.notice,ctx.notice?(noticeRefs.length?.96:.74):0,noticeRefs,'Número do edital identificado.'),
  publicationDate:evidenceField(ctx.publicationDate,ctx.publicationDate?(publicationRefs.length?.88:.7):0,publicationRefs,'Data de publicação identificada.'),
  objectiveLocation:evidenceField(ctx.objectiveLocation?.status!=='missing'?{page:ctx.objectiveLocation.page,startRef:ctx.objectiveLocation.startRef,endRef:ctx.objectiveLocation.endRef,association:ctx.objectiveLocation.association}:null,ctx.objectiveLocation?.status==='confirmed'?.97:ctx.objectiveLocation?.status==='review'?.62:0,ctx.objectiveLocation?.sourceRefs||[],ctx.objectiveLocation?.reason||''),
  objectiveTable:evidenceField(ctx.exam?.sections?.length?{sections:ctx.exam.sections.length,totalQuestions:ctx.exam.totalQuestions,totalPoints:ctx.exam.totalPoints}:null,ctx.objectiveTable?.status==='parsed'?.95:ctx.objectiveTable?.status==='review'?.68:ctx.exam?.sections?.length?.58:0,ctx.objectiveTable?.sourceRefs||[],'Estrutura da prova objetiva.'),
  examDate:evidenceField(ctx.examDate,ctx.examDate?(ctx.objectiveRules?.evidence?.date?.length?.97:.8):0,ctx.objectiveRules?.evidence?.date?.length?ctx.objectiveRules.evidence.date:evidenceRefs(rows,ctx.examDate),'Data de aplicação da prova objetiva.'),
  durationMinutes:evidenceField(ctx.durationMinutes,ctx.durationMinutes!==null&&ctx.durationMinutes!==undefined?(ctx.objectiveRules?.evidence?.durationMinutes?.length?.95:.72):0,ctx.objectiveRules?.evidence?.durationMinutes||[],'Duração da prova objetiva.'),
  character:evidenceField(ctx.objectiveRules?.character||'',ctx.objectiveRules?.character?(ctx.objectiveRules?.evidence?.character?.length?.94:.72):0,ctx.objectiveRules?.evidence?.character||[],'Caráter eliminatório/classificatório.'),
  minimum:evidenceField(ctx.objectiveMinimum,ctx.objectiveMinimum?(ctx.objectiveRules?.evidence?.minimum?.length?.94:.72):0,ctx.objectiveRules?.evidence?.minimum||[],'Critério mínimo geral da prova.'),
  responseModel:evidenceField(ctx.objectiveRules?.answerModel?{answerModel:ctx.objectiveRules.answerModel,alternatives:ctx.objectiveRules.alternatives,scoringModel:ctx.objectiveRules.scoringModel,scoringRuleRaw:ctx.objectiveRules.scoringRuleRaw||''}:null,ctx.objectiveRules?.answerModel?(ctx.objectiveRules?.evidence?.responseModel?.length?.94:.72):0,[...(ctx.objectiveRules?.evidence?.responseModel||[]),...(ctx.objectiveRules?.evidence?.scoringRule||[])],'Modelo de respostas e regra de correção da prova objetiva.'),
  program:evidenceField(ctx.programExtraction?.blocks?.length?{blocks:ctx.programExtraction.blocks.length}:null,ctx.programExtraction?.status==='parsed'?.93:ctx.programExtraction?.status==='review'?.62:0,ctx.programExtraction?.sourceRefs||[],'Conteúdo programático associado ao cargo/grupo.')
 };
 const sectionEvidence=(ctx.exam?.sections||[]).map(s=>{const score=s.extractionMode==='geometry'?.97:s.extractionMode==='delimited'?.93:s.extractionMode==='text'?.84:.62;return{id:s.id,label:s.label,...evidenceField({questions:s.questions,pointsPerQuestion:s.pointsPerQuestion,totalPoints:s.totalPoints,minimum:s.minimum||null},score,s.sourceRefs||[],'Linha da estrutura objetiva.')}});
 const contentEvidence=(ctx.programExtraction?.blocks||[]).map((b,i)=>({id:b.sectionId||'content-'+(i+1),label:b.label,...evidenceField(b.text,b.status==='confirmed'?.92:.62,b.sourceRefs||[],'Bloco do conteúdo programático.')})); 
 const conflicts=extractionConflicts(doc,{objectiveLocation:ctx.objectiveLocation,exam:ctx.exam});
 for(const conflict of conflicts)for(const field of conflict.fields||[]){const e=fields[field];if(!e)continue;e.confidence=Math.min(e.confidence,conflict.severity==='error'?.42:.55);e.level=confidenceLevel(e.confidence);e.status='review';e.conflictIds.push(conflict.id)}
 const core=['organization','position','objectiveLocation','objectiveTable','examDate','program'].map(k=>fields[k]).filter(x=>x&&x.status!=='missing'),overall=core.length?Math.round(core.reduce((a,x)=>a+x.confidence,0)*100/core.length)/100:0,needsReview=conflicts.length>0||Object.values(fields).some(x=>x.status==='review'||x.status==='missing');
 return{version:'1.0',overall:{confidence:overall,level:confidenceLevel(overall),status:needsReview?'review':'confirmed'},fields,sections:sectionEvidence,content:contentEvidence,conflicts,hasConflicts:conflicts.length>0,needsReview}
}

function parseDocument(doc,cargo){
 const text=clean(doc.text),lines=doc.pages.flatMap(p=>p.lines||String(p.text||'').split(/\r?\n/)).map(x=>typeof x==='string'?clean(x):clean(x?.text)).filter(Boolean),loc=locality(text),org=organization(lines,text),nt=notice(text),bd=board(text),available=cargos(text,lines,doc),picked=cargo||available[0]||null,selected=picked?{...picked,group:resolveCargoGroup(picked,text,lines)}:null,objectiveLocation=locateObjective(doc,selected,available),objectiveTable=parseObjectiveTable(doc,objectiveLocation),objectiveText=objectiveRegionRows(doc,objectiveLocation).map(x=>x.text).join('\n'),exam=objectiveTable.sections.length?objectiveTable:examSections(objectiveText||text),programExtraction=extractProgram(doc,selected,exam.sections,available),objectiveRules=extractObjectiveRules(doc,objectiveLocation,exam),sched=schedule(lines),examEvent=sched.find(e=>e.kind==='exam')||null,min=objectiveRules.minimum?.kind==='points'?objectiveRules.minimum.value:minimumTotal(text),dur=objectiveRules.durationMinutes??duration(text),pub=publicationDate(text),details=cargoDetails(text,lines,selected),examDate=objectiveRules.date||examEvent?.date||'',examDateStatus=objectiveRules.dateStatus||examEvent?.status||'';
 const objective=exam.sections.length?{id:'objective',type:'objective',label:/Te[oó]rico-Objetiva/i.test(text)?'Prova Teórico-Objetiva':'Prova Objetiva',character:objectiveRules.character||(/eliminat[oó]ria e classificat[oó]ria/i.test(text)?'Eliminatório e classificatório':''),planningMode:'weighted-sections',date:examDate,dateStatus:examDateStatus,durationMinutes:dur,totalQuestions:exam.totalQuestions,totalPoints:exam.totalPoints,alternatives:objectiveRules.alternatives,answerModel:objectiveRules.answerModel,scoringModel:objectiveRules.scoringModel,scoringRuleRaw:objectiveRules.scoringRuleRaw||'',minimum:objectiveRules.minimum||(min!==null?{kind:'points',value:min,label:'mínimo geral de '+String(min).replace('.',',')+' pontos'}:null),sections:exam.sections}:null;
 const content=programExtraction.blocks,officialName=org.organization,title=org.acronym?(org.acronym+(loc.cityName?' '+loc.cityName:'')):officialName,rules=[];
 if(objective?.character)rules.push(objective.label+' de caráter '+objective.character.toLowerCase()+'.');if(objective?.minimum)rules.push(objective.minimum.kind==='percentage'?'Mínimo geral: '+String(objective.minimum.value).replace('.',',')+'%.':'Pontuação mínima geral: '+String(objective.minimum.value).replace('.',',')+' pontos.');for(const s of exam.sections){if(s.minimumPoints!==null&&s.minimumPoints!==undefined)rules.push('Mínimo em '+s.label+': '+String(s.minimumPoints).replace('.',',')+' pontos.');else if(s.minimumQuestions!==null&&s.minimumQuestions!==undefined)rules.push('Mínimo em '+s.label+': '+String(s.minimumQuestions).replace('.',',')+' questões.')}
 const evidence=buildEvidenceReport(doc,{title:title||officialName,officialName,organizationAcronym:org.acronym,selected,board:bd,city:loc.city,cityName:loc.cityName,uf:loc.uf,notice:nt,publicationDate:pub,objectiveLocation,objectiveTable,exam,examDate,durationMinutes:dur,objectiveMinimum:objective?.minimum||null,objectiveRules,programExtraction});
 const schema={id:'',kind:'user',status:'reviewed',board:bd,organization:officialName,position:selected?.name||'',positionCode:selected?.code||'',examGroup:selected?.group||'',notice:nt,examDate:{date:examDate,status:examDateStatus},stages:objective?[objective]:[],schedule:sched,rules,content,evidence,conflicts:evidence.conflicts,documents:[],sourceNote:'Extraído localmente do PDF; revisar antes de criar.'};
 const draft={title:title||officialName,officialName,organization:officialName,position:selected?.name||'',positionCode:selected?.code||'',examGroup:selected?.group||'',board:bd,city:loc.city,cityName:loc.cityName,uf:loc.uf,notice:nt,publicationDate:pub,examDate:examDate,examDateStatus:examDateStatus,durationMinutes:dur,vacancies:details.vacancies,reserve:details.reserve,workloadHours:details.workloadHours,remuneration:details.remuneration,requirements:details.requirements,stages:schema.stages,sections:exam.sections,schedule:sched,rules,content,schema,source:'pdf-import',_evidence:evidence,_status:{title:evidence.fields.title.status,organization:evidence.fields.organization.status,position:evidence.fields.position.status,board:evidence.fields.board.status,city:evidence.fields.city.status,notice:evidence.fields.notice.status,examDate:evidence.fields.examDate.status}};
 return{draft,schema,cargos:available,selectedCargo:selected,objectiveLocation,objectiveTable,programExtraction,objectiveRules,evidence,conflicts:evidence.conflicts,meta:{pages:doc.numPages,nativeChars:doc.nativeChars||0,ocr:!!doc.ocr,ocrPartial:!!doc.ocrPartial,examGroup:selected?.group||'',objectiveLocationStatus:objectiveLocation.status,objectiveTableStatus:objectiveTable.status,objectiveTableMode:objectiveTable.mode,programStatus:programExtraction.status,programMode:programExtraction.mode,objectiveRulesStatus:objectiveRules.status,evidenceStatus:evidence.overall.status,evidenceConfidence:evidence.overall.confidence,conflictCount:evidence.conflicts.length}};
}
window.PLANO_ARQ_EDICT_PARSER={version:VERSION,parseDocument,cargos,resolveCargoGroup,locateObjective,objectiveHeading,parseObjectiveTable,extractProgram,program,extractResponseModel,extractObjectiveRules,buildEvidenceReport,parseAnyDate,parseDurationMinutes,examSections,schedule};
})();