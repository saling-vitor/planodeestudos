import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/pa-edict-parser-v01.js',import.meta.url),'utf8');
const context={window:{},console};
vm.createContext(context);
vm.runInContext(source,context,{filename:'pa-edict-parser-v01.js'});
const P=context.window.PLANO_ARQ_EDICT_PARSER;
assert.ok(P,'Parser não exportado');
assert.ok(P.cargos&&P.resolveCargoGroup,'Exports da OBJ-02 ausentes');

function list(text,doc=null){return P.cargos(text,text.split(/\n/),doc)}

let rows=list('CARGO CP 01: ARQUITETO\nCARGO CP 02: ENGENHEIRO CIVIL');
assert.equal(rows.length,2);
assert.equal(rows[0].code,'CP 01');
assert.equal(rows[0].name,'Arquiteto');

rows=list('Código do Cargo | Cargo | Grupo de Prova\n406 | Arquiteto e Urbanista | G04\n407 | Engenheiro Civil | G05');
assert.equal(rows.length,2);
assert.equal(rows[0].code,'406');
assert.equal(rows[0].name,'Arquiteto e Urbanista');
assert.equal(rows[0].group,'G04');

rows=list('Cargo | Tipo de Prova\nArquiteto | Tipo 2\nContador | Tipo 3');
assert.equal(rows.length,2);
assert.equal(rows[0].code,'');
assert.equal(rows[0].group,'Tipo 2');

rows=list('2 Arquiteto Grupo A\n3 Contador Grupo B');
assert.equal(rows.length,2);
assert.equal(rows[0].code,'2');
assert.equal(rows[0].name,'Arquiteto');
assert.equal(rows[0].group,'Grupo A');

rows=list('Cargo\nArquiteto — G04');
assert.equal(rows.length,1);
assert.equal(rows[0].name,'Arquiteto');
assert.equal(rows[0].group,'G04');

rows=list('Cargo\nArquiteto');
assert.equal(rows.length,1);
assert.equal(rows[0].name,'Arquiteto');
assert.equal(rows[0].code,'');

const geoDoc={documentMap:{pages:[{number:1,lines:[
 {text:'Código do Cargo Cargo Grupo de Prova',items:[
  {text:'Código do Cargo',x:40,width:60},{text:'Cargo',x:150,width:40},{text:'Grupo de Prova',x:430,width:90}
 ]},
 {text:'406 Arquiteto e Urbanista G04',items:[
  {text:'406',x:40,width:22},{text:'Arquiteto e Urbanista',x:150,width:150},{text:'G04',x:430,width:28}
 ]},
 {text:'407 Engenheiro Civil G05',items:[
  {text:'407',x:40,width:22},{text:'Engenheiro Civil',x:150,width:110},{text:'G05',x:430,width:28}
 ]}
]}]}};
rows=P.cargos('Código do Cargo Cargo Grupo de Prova\n406 Arquiteto e Urbanista G04\n407 Engenheiro Civil G05',['Código do Cargo Cargo Grupo de Prova','406 Arquiteto e Urbanista G04','407 Engenheiro Civil G05'],geoDoc);
assert.ok(rows.some(x=>x.code==='406'&&x.name==='Arquiteto e Urbanista'&&x.group==='G04'),'Tabela geométrica não associou cargo ao grupo');

const parsed=P.parseDocument({
 text:'EDITAL Nº 01/2026\nCódigo do Cargo | Cargo | Grupo de Prova\n406 | Arquiteto e Urbanista | Área 3',
 pages:[{lines:['EDITAL Nº 01/2026','Código do Cargo | Cargo | Grupo de Prova','406 | Arquiteto e Urbanista | Área 3']}],
 numPages:1,nativeChars:120
},null);
assert.equal(parsed.draft.position,'Arquiteto e Urbanista');
assert.equal(parsed.draft.positionCode,'406');
assert.equal(parsed.draft.examGroup,'Área 3');
assert.equal(parsed.schema.examGroup,'Área 3');

const nearby=P.resolveCargoGroup({code:'406',name:'Arquiteto e Urbanista'},'',[
 '406 Arquiteto e Urbanista',
 'Grupo de Prova: G04'
]);
assert.equal(nearby,'G04');

console.log('OBJ-02 OK · cargos e grupos genéricos');
