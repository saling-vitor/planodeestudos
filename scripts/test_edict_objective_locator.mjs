import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/pa-edict-parser-v01.js',import.meta.url),'utf8');
const context={window:{},console};
vm.createContext(context);
vm.runInContext(source,context,{filename:'pa-edict-parser-v01.js'});
const P=context.window.PLANO_ARQ_EDICT_PARSER;
assert.ok(P,'Parser não exportado');
assert.ok(P.locateObjective&&P.objectiveHeading,'Exports da OBJ-03 ausentes');

const line=(page,order,text)=>({ref:`p${page}:l${order}`,page,order,text});
const docFromPages=pages=>{
  const mapped=pages.map((lines,i)=>({number:i+1,lines:lines.map((text,j)=>line(i+1,j+1,text))}));
  return{documentMap:{kind:'document-map',pages:mapped},pages:mapped.map(p=>({number:p.number,lines:p.lines.map(x=>x.text),text:p.lines.map(x=>x.text).join('\n')})),text:mapped.flatMap(p=>p.lines.map(x=>x.text)).join('\n'),numPages:mapped.length,nativeChars:1000};
};

for(const heading of ['PROVA OBJETIVA','PROVA TEÓRICO-OBJETIVA','PROVA ESCRITA OBJETIVA','PROVA DE CONHECIMENTOS','PROVA DE MÚLTIPLA ESCOLHA']){
  const found=P.locateObjective(docFromPages([[heading,'Disciplina Questões Pontos']]),null,[]);
  assert.equal(found.type,'objective');
  assert.equal(found.label,'Prova Objetiva');
  assert.equal(found.status,'confirmed');
  assert.equal(found.headingRef,'p1:l1');
}

const grouped=docFromPages([
 ['GRUPO DE PROVA: G04','CARGOS: 406 ARQUITETO E URBANISTA','PROVA OBJETIVA','Disciplinas e quantidade de questões','Língua Portuguesa 10','CONTEÚDO PROGRAMÁTICO'],
 ['GRUPO DE PROVA: G05','CARGOS: 407 ENGENHEIRO CIVIL','PROVA TEÓRICO-OBJETIVA','Disciplinas e quantidade de questões','Matemática 10']
]);
const cargos=[{code:'406',name:'Arquiteto e Urbanista',group:'G04'},{code:'407',name:'Engenheiro Civil',group:'G05'}];
let found=P.locateObjective(grouped,cargos[0],cargos);
assert.equal(found.status,'confirmed');
assert.equal(found.page,1);
assert.equal(found.association,'group');
assert.ok(found.sourceRefs.includes('p1:l1'));
assert.equal(found.endRef,'p1:l5');

found=P.locateObjective(grouped,cargos[1],cargos);
assert.equal(found.status,'confirmed');
assert.equal(found.page,2);
assert.equal(found.association,'group');

const cargoSpecific=docFromPages([
 ['CARGO: ARQUITETO','PROVA ESCRITA OBJETIVA','Conhecimentos Gerais'],
 ['CARGO: CONTADOR','PROVA ESCRITA OBJETIVA','Conhecimentos Gerais']
]);
found=P.locateObjective(cargoSpecific,{code:'',name:'Arquiteto',group:''},[{name:'Arquiteto'},{name:'Contador'}]);
assert.equal(found.status,'confirmed');
assert.equal(found.page,1);
assert.equal(found.association,'cargo');

const ambiguous=docFromPages([
 ['PROVA OBJETIVA','Tabela da prova'],
 ['PROVA DE CONHECIMENTOS','Outra tabela']
]);
found=P.locateObjective(ambiguous,null,[]);
assert.equal(found.status,'review');
assert.equal(found.reason,'multiple-plausible-objective-regions');
assert.equal(found.alternatives.length,1);

const wrongGroup=docFromPages([['GRUPO G05','PROVA OBJETIVA','Tabela']]);
found=P.locateObjective(wrongGroup,{code:'406',name:'Arquiteto',group:'G04'},[{code:'406',name:'Arquiteto',group:'G04'}]);
assert.equal(found.status,'missing','não pode usar estrutura explicitamente ligada a outro grupo');

const nonObjective=docFromPages([['PROVA PRÁTICA','AVALIAÇÃO DE TÍTULOS','TAF','CURSO DE FORMAÇÃO']]);
found=P.locateObjective(nonObjective,{name:'Arquiteto'},[{name:'Arquiteto'}]);
assert.equal(found.status,'missing');

const scheduleOnly=docFromPages([['Cronograma','Aplicação da Prova Objetiva 18/10/2026','Resultado da Prova Objetiva 30/10/2026']]);
found=P.locateObjective(scheduleOnly,null,[]);
assert.equal(found.status,'missing','evento de cronograma não pode ser confundido com heading da estrutura');

const parsed=P.parseDocument(grouped,cargos[0]);
assert.equal(parsed.objectiveLocation.status,'confirmed');
assert.equal(parsed.objectiveLocation.page,1);
assert.equal(parsed.meta.objectiveLocationStatus,'confirmed');

console.log('OBJ-03 OK · localizador da prova objetiva por cargo/grupo');
