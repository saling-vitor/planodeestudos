import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/pa-edict-parser-v01.js',import.meta.url),'utf8');
const context={window:{},console};
vm.createContext(context);
vm.runInContext(source,context,{filename:'pa-edict-parser-v01.js'});
const P=context.window.PLANO_ARQ_EDICT_PARSER;
assert.ok(P?.buildEvidenceReport,'OBJ-07 não exportada');

const line=(p,o,text)=>({ref:`p${p}:l${o}`,page:p,order:o,text,items:[]});
const doc=(texts)=>{const rows=texts.map((text,i)=>line(1,i+1,text));return{documentMap:{kind:'document-map',pages:[{number:1,lines:rows}]},pages:[{number:1,lines:rows.map(x=>x.text),text:rows.map(x=>x.text).join('\n')}],text:rows.map(x=>x.text).join('\n'),numPages:1,nativeChars:1400}};

let parsed=P.parseDocument(doc([
 'EDITAL Nº 01/2026',
 'PREFEITURA MUNICIPAL DE EXEMPLO',
 'Banca organizadora: FUNDATEC',
 'CARGO 406: ARQUITETO E URBANISTA',
 'GRUPO DE PROVA: G04',
 'PROVA OBJETIVA',
 'Disciplina | Questões | Pontuação',
 'Arquitetura Hospitalar | 20 | 40',
 'A prova objetiva terá caráter eliminatório e classificatório.',
 'Duração da prova: 3 horas.',
 'Pontuação mínima geral de 20 pontos.',
 'Aplicação da Prova Objetiva 25/10/2026',
 'CONTEÚDO PROGRAMÁTICO',
 'ARQUITETURA HOSPITALAR',
 'Dimensionamento funcional e fluxos hospitalares.'
]),{code:'406',name:'Arquiteto e Urbanista',group:'G04',source:'explicit'});

assert.equal(parsed.evidence.version,'1.0');
assert.ok(parsed.evidence.fields.position.confidence>=.85);
assert.ok(parsed.evidence.fields.position.sourceRefs.length>0);
assert.ok(parsed.evidence.fields.examDate.sourceRefs.includes('p1:l12'));
assert.equal(parsed.evidence.fields.objectiveLocation.status,parsed.objectiveLocation.status);
assert.equal(parsed.evidence.fields.objectiveTable.status,parsed.objectiveTable.status==='parsed'?'confirmed':'review');
assert.ok(parsed.evidence.fields.objectiveLocation.sourceRefs.length>0);
assert.ok(parsed.evidence.fields.objectiveTable.sourceRefs.length>0);
assert.equal(parsed.evidence.fields.program.status,'confirmed');
assert.equal(parsed.evidence.hasConflicts,false);
assert.equal(parsed.schema.evidence.version,'1.0');
assert.equal(parsed.meta.conflictCount,0);
assert.equal(parsed.draft._status.examDate,'confirmed');

parsed=P.parseDocument(doc([
 'EDITAL Nº 02/2026',
 'CARGO 406: ARQUITETO',
 'PROVA OBJETIVA',
 'Disciplina | Questões | Pontuação',
 'Arquitetura Hospitalar | 10 | 20',
 'Duração da prova: 3 horas.',
 'Tempo para realização da prova: 4 horas.',
 'Aplicação da Prova Objetiva 18/10/2026',
 'Realização da Prova Objetiva 25/10/2026',
 'Pontuação mínima geral de 20 pontos.',
 'O candidato deverá obter no mínimo 50% da pontuação.',
 'CONTEÚDO PROGRAMÁTICO',
 'ARQUITETURA HOSPITALAR',
 'Fluxos hospitalares e dimensionamento.'
]),{code:'406',name:'Arquiteto',group:'',source:'explicit'});

const ids=parsed.conflicts.map(x=>x.id);
assert.ok(ids.includes('exam-date-conflict'));
assert.ok(ids.includes('duration-conflict'));
assert.ok(ids.includes('minimum-conflict'));
assert.equal(parsed.evidence.hasConflicts,true);
assert.equal(parsed.evidence.overall.status,'review');
assert.equal(parsed.evidence.fields.examDate.status,'review');
assert.ok(parsed.evidence.fields.examDate.confidence<=.42);
assert.ok(parsed.evidence.fields.examDate.conflictIds.includes('exam-date-conflict'));
assert.ok(parsed.conflicts.find(x=>x.id==='exam-date-conflict').sourceRefs.includes('p1:l8'));
assert.ok(parsed.conflicts.find(x=>x.id==='exam-date-conflict').sourceRefs.includes('p1:l9'));

const synthetic=P.buildEvidenceReport(doc(['PROVA OBJETIVA']),{
 title:'',officialName:'',organizationAcronym:'',selected:null,board:'',city:'',cityName:'',uf:'',notice:'',publicationDate:'',
 objectiveLocation:{status:'missing',sourceRefs:[]},objectiveTable:{status:'missing',sourceRefs:[]},exam:{sections:[],totalQuestions:null,totalPoints:null},
 examDate:'',durationMinutes:null,objectiveMinimum:null,objectiveRules:{evidence:{}},programExtraction:{status:'missing',blocks:[],sourceRefs:[]}
});
assert.equal(synthetic.fields.organization.status,'missing');
assert.equal(synthetic.fields.objectiveTable.status,'missing');
assert.equal(synthetic.needsReview,true);

console.log('OBJ-07 OK · confidence, sourceRefs e conflitos');
