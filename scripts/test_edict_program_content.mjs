import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/pa-edict-parser-v01.js',import.meta.url),'utf8');
const context={window:{},console};
vm.createContext(context);
vm.runInContext(source,context,{filename:'pa-edict-parser-v01.js'});
const P=context.window.PLANO_ARQ_EDICT_PARSER;
assert.ok(P?.extractProgram,'Extrator genérico de conteúdo programático não exportado');

const line=(page,order,text)=>({ref:`p${page}:l${order}`,page,order,text,items:[]});
const doc=(pages)=>{const mapped=pages.map((rows,p)=>({number:p+1,lines:rows.map((text,i)=>line(p+1,i+1,text))}));return{documentMap:{kind:'document-map',pages:mapped},pages:mapped.map(x=>({number:x.number,lines:x.lines.map(y=>y.text),text:x.lines.map(y=>y.text).join('\n')})),text:mapped.flatMap(x=>x.lines.map(y=>y.text)).join('\n'),numPages:mapped.length,nativeChars:1200}};
const sections=[{id:'portugues',label:'Língua Portuguesa'},{id:'geopolitica',label:'Geopolítica Regional'},{id:'specific',label:'Conhecimentos Específicos'}];

let d=doc([['ANEXO II — CONTEÚDO PROGRAMÁTICO','LÍNGUA PORTUGUESA','Compreensão e interpretação de textos. Ortografia oficial.','GEOPOLÍTICA REGIONAL','Formação territorial. Dinâmicas urbanas contemporâneas.','CRONOGRAMA']]);
let result=P.extractProgram(d,null,sections,[]);
assert.equal(result.status,'parsed');
assert.equal(result.blocks.length,2);
assert.equal(result.blocks[1].label,'Geopolítica Regional');
assert.deepEqual(result.blocks[1].sourceRefs,['p1:l4','p1:l5']);

d=doc([['CONTEÚDO PROGRAMÁTICO','Língua Portuguesa: Interpretação textual; coesão e coerência.','Geopolítica Regional: Organização do espaço regional; redes urbanas.','CRONOGRAMA']]);
result=P.extractProgram(d,null,sections,[]);
assert.equal(result.blocks.length,2);
assert.match(result.blocks[1].text,/redes urbanas/i);

const cargos=[{code:'406',name:'Arquiteto e Urbanista',group:'G04'},{code:'407',name:'Contador',group:'G05'}];
d=doc([['CONTEÚDO PROGRAMÁTICO','CARGOS: TODOS','LÍNGUA PORTUGUESA','Interpretação de textos e gramática.','CARGO 406 - ARQUITETO E URBANISTA','CONHECIMENTOS ESPECÍFICOS','Projeto arquitetônico; conforto ambiental; acessibilidade.','CARGO 407 - CONTADOR','CONHECIMENTOS ESPECÍFICOS','Contabilidade pública; auditoria contábil.','CRONOGRAMA']]);
result=P.extractProgram(d,cargos[0],sections,cargos);
assert.equal(result.blocks.length,2);
assert.ok(result.blocks.some(x=>/Projeto arquitetônico/.test(x.text)));
assert.equal(result.blocks.some(x=>/Contabilidade pública/.test(x.text)),false);

d=doc([['CONTEÚDO PROGRAMÁTICO','GRUPO DE PROVA: G04','CONHECIMENTOS ESPECÍFICOS','Urbanismo; sistemas estruturais; instalações prediais.','GRUPO DE PROVA: G05','CONHECIMENTOS ESPECÍFICOS','Contabilidade geral; custos.','ANEXO III']]);
result=P.extractProgram(d,cargos[0],sections,cargos);
assert.equal(result.blocks.length,1);
assert.match(result.blocks[0].text,/Urbanismo/);
assert.equal(result.blocks[0].association,'group');

const arbitrary=[{id:'hospitalar',label:'Arquitetura Hospitalar'}];
d=doc([['PROGRAMA DAS PROVAS','ARQUITETURA HOSPITALAR','Fluxos limpos e sujos. Dimensionamento funcional. Humanização dos ambientes.','CRONOGRAMA']]);
result=P.extractProgram(d,{code:'406',name:'Arquiteto',group:''},arbitrary,[{code:'406',name:'Arquiteto'}]);
assert.equal(result.blocks[0].label,'Arquitetura Hospitalar');
assert.equal(result.blocks[0].status,'confirmed');

const parsed=P.parseDocument(doc([['EDITAL Nº 01/2026','CARGO 406: ARQUITETO E URBANISTA','PROVA OBJETIVA','Disciplina | Questões | Pontuação','Geopolítica Regional | 10 | 20','CONTEÚDO PROGRAMÁTICO','GEOPOLÍTICA REGIONAL','Formação territorial; políticas urbanas; redes regionais.','CRONOGRAMA']]),{code:'406',name:'Arquiteto e Urbanista',group:''});
assert.equal(parsed.schema.content.length,1);
assert.equal(parsed.schema.content[0].label,'Geopolítica Regional');
assert.equal(parsed.programExtraction.status,'parsed');
assert.equal(parsed.meta.programStatus,'parsed');

const missing=P.extractProgram(doc([['EDITAL Nº 01/2026','PROVA OBJETIVA','Sem programa nesta página.']]),null,sections,[]);
assert.equal(missing.status,'missing');
assert.equal(missing.blocks.length,0);

console.log('OBJ-05 OK · conteúdo programático genérico por cargo/grupo');
