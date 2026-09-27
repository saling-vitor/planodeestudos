(()=>{
'use strict';
const VERSION='1.1';
const MAP_VERSION='1.0';
const PDFJS='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
const PDFWORKER='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
const TESS='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const clean=s=>String(s||'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/\s+\n/g,'\n').trim();
const fold=s=>clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleUpperCase('pt-BR');
const finite=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
const clamp01=v=>Math.max(0,Math.min(1,Number(v)||0));
function itemGeometry(it,pageWidth=0,pageHeight=0,index=0){
 const text=clean(it?.str);if(!text)return null;
 const t=Array.isArray(it?.transform)?it.transform:[],x=finite(t[4]),y=finite(t[5]),width=Math.max(0,finite(it?.width));
 const matrixH=Math.hypot(finite(t[2]),finite(t[3])),matrixFont=Math.hypot(finite(t[0]),finite(t[1])),height=Math.max(0,finite(it?.height)||matrixH||matrixFont);
 const pw=Math.max(0,finite(pageWidth)),ph=Math.max(0,finite(pageHeight)),top=ph?ph-(y+height):null;
 return{id:'i'+(index+1),text,x,y,width,height,fontName:String(it?.fontName||''),dir:String(it?.dir||''),bbox:{x,y,width,height,x2:x+width,y2:y+height},normalized:pw&&ph?{left:clamp01(x/pw),bottom:clamp01(y/ph),top:clamp01(top/ph),width:clamp01(width/pw),height:clamp01(height/ph)}:null}
}
function buildRows(items,pageNumber=1,pageWidth=0,pageHeight=0){
 const fragments=(items||[]).map((it,i)=>itemGeometry(it,pageWidth,pageHeight,i)).filter(Boolean).sort((a,b)=>b.y-a.y||a.x-b.x),rows=[];
 for(const frag of fragments){
  let row=null,delta=Infinity;
  for(const candidate of rows){const d=Math.abs(candidate.baselineY-frag.y);if(d<=2.2&&d<delta){row=candidate;delta=d}}
  if(!row){row={baselineY:frag.y,items:[],_sumY:0};rows.push(row)}
  row.items.push(frag);row._sumY+=frag.y;row.baselineY=row._sumY/row.items.length;
 }
 return rows.sort((a,b)=>b.baselineY-a.baselineY).map((row,i)=>{
  row.items.sort((a,b)=>a.x-b.x);
  const text=row.items.map(x=>x.text).join(' ').replace(/\s+/g,' ').trim(),x=Math.min(...row.items.map(x=>x.x)),y=Math.min(...row.items.map(x=>x.y)),x2=Math.max(...row.items.map(x=>x.x+x.width)),y2=Math.max(...row.items.map(x=>x.y+x.height)),width=Math.max(0,x2-x),height=Math.max(0,y2-y),pw=Math.max(0,finite(pageWidth)),ph=Math.max(0,finite(pageHeight)),top=ph?ph-y2:null;
  return{ref:'p'+pageNumber+':l'+(i+1),page:pageNumber,order:i+1,text,baselineY:row.baselineY,bbox:{x,y,width,height,x2,y2},normalized:pw&&ph?{left:clamp01(x/pw),bottom:clamp01(y/ph),top:clamp01(top/ph),width:clamp01(width/pw),height:clamp01(height/ph)}:null,items:row.items};
 })
}
function rowLines(items){return buildRows(items).map(r=>r.text).filter(Boolean)}
function plainRows(text,pageNumber){
 return String(text||'').split(/\r?\n/).map(clean).filter(Boolean).map((line,i)=>({ref:'p'+pageNumber+':l'+(i+1),page:pageNumber,order:i+1,text:line,baselineY:null,bbox:null,normalized:null,items:[]}))
}
function buildDocumentMap(pages=[],meta={}){
 const mapped=(pages||[]).map((page,index)=>{
  const number=Number(page?.number)||index+1,width=Number.isFinite(Number(page?.width))?Number(page.width):null,height=Number.isFinite(Number(page?.height))?Number(page.height):null,rotation=finite(page?.rotation),source=page?.source||meta.mode||'native';
  const rows=Array.isArray(page?.geometry?.rows)&&page.geometry.rows.length?page.geometry.rows:plainRows(page?.text||((page?.lines||[]).join('\n')),number);
  const text=clean(page?.text||rows.map(r=>r.text).join('\n'));
  const geometryAvailable=rows.some(r=>r?.bbox&&Array.isArray(r?.items)&&r.items.length);
  return{number,width,height,rotation,source,geometryStatus:geometryAvailable?'available':'unavailable',text,lineCount:rows.length,lines:rows};
 });
 const geometryPages=mapped.filter(p=>p.geometryStatus==='available').length,mode=meta.mode||'native';
 return{version:MAP_VERSION,kind:'document-map',source:{name:String(meta.name||''),mimeType:String(meta.mimeType||''),sizeBytes:Number(meta.sizeBytes)||0},extraction:{mode,ocr:!!meta.ocr,ocrPartial:!!meta.ocrPartial,nativeChars:Number(meta.nativeChars)||0,geometry:geometryPages===mapped.length&&mapped.length?'available':geometryPages?'partial':'unavailable'},pageCount:Number(meta.numPages)||mapped.length,pages:mapped,text:mapped.map(p=>p.text).filter(Boolean).join('\n\n')}
}
const POSITIVE_SIGNALS=[
 ['edict','Edital',3,/\bEDITAL\b/],
 ['selection','Concurso/processo seletivo',3,/\b(?:CONCURSO\s+PUBLICO|PROCESSO\s+SELETIVO|SELECAO\s+PUBLICA|CERTAME)\b/],
 ['objective','Prova objetiva',3,/\b(?:PROVA\s+(?:TEORICO[- ]?)?OBJETIVA|PROVA\s+ESCRITA\s+OBJETIVA|PROVA\s+DE\s+CONHECIMENTOS|MULTIPLA\s+ESCOLHA)\b/],
 ['program','Conteúdo programático',2,/\b(?:CONTEUDO\s+PROGRAMATICO|PROGRAMA\s+DAS\s+PROVAS|PROGRAMA\s+DA\s+PROVA)\b/],
 ['cargo','Cargo/função',1,/\b(?:CARGO|CARGOS|FUNCAO|FUNCOES|EMPREGO|EMPREGOS|ESPECIALIDADE|ESPECIALIDADES)\b/],
 ['vacancy','Vagas',1,/\b(?:VAGA|VAGAS|CADASTRO\s+DE\s+RESERVA|CADASTRO\s+RESERVA)\b/],
 ['registration','Inscrições',1,/\bINSCRIC(?:AO|OES)\b/],
 ['schedule','Cronograma',1,/\bCRONOGRAMA\b/],
 ['requirements','Requisitos/escolaridade',1,/\b(?:REQUISITO|REQUISITOS|ESCOLARIDADE)\b/]
];
const NEGATIVE_SIGNALS=[
 ['boleto','Boleto bancário',4,/\bBOLETO\s+BANCARIO\b/],
 ['digitable','Linha digitável',4,/\bLINHA\s+DIGITAVEL\b/],
 ['barcode','Código de barras',3,/\bCODIGO\s+DE\s+BARRAS\b/],
 ['payerReceipt','Recibo do pagador',2,/\bRECIBO\s+DO\s+PAGADOR\b/],
 ['ourNumber','Nosso número',2,/\bNOSSO\s+NUMERO\b/],
 ['documentValue','Valor do documento',2,/\bVALOR\s+DO\s+DOCUMENTO\b/],
 ['mechanical','Autenticação mecânica',2,/\bAUTENTICACAO\s+MECANICA\b/],
 ['beneficiary','Beneficiário',1.5,/\bBENEFICIARIO\b/],
 ['payer','Pagador',1.5,/\bPAGADOR\b/],
 ['cedent','Cedente',1.5,/\bCEDENTE\b/]
];
function validationEntries(input){
 const map=input?.kind==='document-map'?input:input?.documentMap?.kind==='document-map'?input.documentMap:buildDocumentMap(input?.pages||[],{numPages:input?.numPages,nativeChars:input?.nativeChars,ocr:input?.ocr,ocrPartial:input?.ocrPartial,mode:input?.ocr?'ocr':'native'});
 const entries=[];for(const page of map.pages||[])for(const line of page.lines||[]){const text=clean(typeof line==='string'?line:line?.text);if(text)entries.push({ref:typeof line==='string'?'p'+page.number+':l'+(entries.length+1):(line.ref||'p'+page.number),text,folded:fold(text)})}
 if(!entries.length&&map.text)String(map.text).split(/\r?\n/).map(clean).filter(Boolean).forEach((text,i)=>entries.push({ref:'text:l'+(i+1),text,folded:fold(text)}));
 return{map,entries}
}
function collectSignals(entries,definitions){
 return definitions.map(([id,label,weight,rx])=>{const refs=[];for(const row of entries){if(rx.test(row.folded)){refs.push(row.ref);if(refs.length>=4)break}}return{id,label,weight,found:refs.length>0,refs}}).filter(x=>x.found)
}
function validateDocument(input){
 const {map,entries}=validationEntries(input),positive=collectSignals(entries,POSITIVE_SIGNALS),negative=collectSignals(entries,NEGATIVE_SIGNALS),positiveScore=positive.reduce((a,x)=>a+x.weight,0),negativeScore=negative.reduce((a,x)=>a+x.weight,0),ids=new Set(positive.map(x=>x.id));
 const identity=ids.has('edict')&&ids.has('selection'),objective=ids.has('objective'),structure=['cargo','vacancy','registration','schedule','requirements','program'].filter(x=>ids.has(x)).length,strongNonEdict=negativeScore>=7&&positiveScore<8&&!identity;
 let status='rejected';
 if(!strongNonEdict&&((identity&&(objective||structure>=2))||(ids.has('selection')&&objective&&structure>=2)||positiveScore>=10))status='confirmed';
 else if(!strongNonEdict&&positiveScore>=5&&(ids.has('edict')||ids.has('selection')||objective))status='review';
 const confidence=status==='confirmed'?Math.min(.99,.72+positiveScore*.02):status==='review'?Math.min(.84,.55+positiveScore*.025):Math.min(.99,.66+negativeScore*.02);
 return{status,isEdict:status==='confirmed',likelyEdict:status!=='rejected',confidence:Math.round(confidence*100)/100,positiveScore,negativeScore,positiveEvidence:positive,negativeEvidence:negative,message:status==='rejected'?'Este PDF não parece ser um edital de concurso.':status==='review'?'O PDF tem sinais de edital, mas a identificação precisa ser revisada.':'Edital de concurso identificado.',documentMap:map}
}
async function pdfjs(){const m=await import(PDFJS);m.GlobalWorkerOptions.workerSrc=PDFWORKER;return m}
function loadScript(src){return new Promise((resolve,reject)=>{const old=[...document.scripts].find(s=>s.src===src);if(old){if(window.Tesseract)return resolve();old.addEventListener('load',resolve,{once:true});old.addEventListener('error',reject,{once:true});return}const s=document.createElement('script');s.src=src;s.async=true;s.onload=resolve;s.onerror=()=>reject(new Error('Falha ao carregar OCR'));document.head.appendChild(s)})}
async function readNative(file,progress=()=>{}){
 const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.length<5||String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw new Error('PDF inválido ou corrompido');
 let lib,pdf;try{lib=await pdfjs();pdf=await lib.getDocument({data:bytes}).promise}catch(e){if(e?.name==='PasswordException')throw new Error('Este PDF é protegido por senha');throw new Error('Não foi possível ler o PDF')}
 const pages=[],all=[];for(let i=1;i<=pdf.numPages;i++){progress({kind:'read',current:i,total:pdf.numPages});const page=await pdf.getPage(i),vp=page.getViewport({scale:1}),tc=await page.getTextContent(),rows=buildRows(tc.items,i,vp.width,vp.height),lines=rows.map(r=>r.text).filter(Boolean),text=lines.join('\n');pages.push({number:i,width:vp.width,height:vp.height,rotation:vp.rotation||0,source:'native',lines,text,geometry:{coordinateSystem:'pdf-bottom-left',rows}});all.push(text);if(i%6===0)await new Promise(r=>setTimeout(r,0))}
 const nativeChars=all.join('').replace(/\s/g,'').length,documentMap=buildDocumentMap(pages,{name:file?.name,mimeType:file?.type,sizeBytes:file?.size,numPages:pdf.numPages,nativeChars,mode:'native'});
 return{pdf,pages,text:all.join('\n\n'),numPages:pdf.numPages,nativeChars,ocr:false,ocrPartial:false,documentMap}
}
async function ocrFallback(native,progress=()=>{}){
 await loadScript(TESS);if(!window.Tesseract?.recognize)throw new Error('OCR indisponível');
 const n=native.numPages,chosen=[];for(let i=1;i<=Math.min(8,n);i++)chosen.push(i);if(n>8)for(let i=1;i<=8;i++)chosen.push(Math.max(1,Math.min(n,Math.round(i*n/8))));
 const pageNumbers=[...new Set(chosen)].sort((a,b)=>a-b).slice(0,16),out=[];for(let k=0;k<pageNumbers.length;k++){const i=pageNumbers[k];progress({kind:'ocr',current:k+1,total:pageNumbers.length,page:i});const page=await native.pdf.getPage(i),baseVp=page.getViewport({scale:1}),vp=page.getViewport({scale:1.45}),canvas=document.createElement('canvas');canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);await page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport:vp}).promise;const result=await window.Tesseract.recognize(canvas,'por',{logger:()=>{}}),text=result?.data?.text||'',lines=text.split(/\r?\n/).map(clean).filter(Boolean);out.push({number:i,width:baseVp.width,height:baseVp.height,rotation:baseVp.rotation||0,source:'ocr',text,lines,geometry:{coordinateSystem:'unavailable',rows:plainRows(text,i)}});await new Promise(r=>setTimeout(r,0))}
 const joined=out.map(x=>x.text).join('\n\n'),documentMap=buildDocumentMap(out,{name:native.documentMap?.source?.name,mimeType:native.documentMap?.source?.mimeType,sizeBytes:native.documentMap?.source?.sizeBytes,numPages:n,nativeChars:native.nativeChars,mode:'ocr',ocr:true,ocrPartial:pageNumbers.length<n});
 return{...native,pages:out,text:joined,ocr:true,ocrPartial:pageNumbers.length<n,documentMap}
}
async function read(file,progress=()=>{}){
 const native=await readNative(file,progress),result=native.nativeChars>=Math.max(350,native.numPages*25)?native:(progress({kind:'ocr-start',current:0,total:native.numPages}),await ocrFallback(native,progress).catch(()=>{throw new Error('Este edital parece digitalizado. O OCR não pôde ser concluído; tente novamente com internet ou continue manualmente.')}));
 result.validation=validateDocument(result.documentMap);return result
}
window.PLANO_ARQ_PDF_READER={version:VERSION,mapVersion:MAP_VERSION,read,readNative,ocrFallback,rowLines,buildRows,buildDocumentMap,validateDocument};
})();