import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/pa-edict-parser-v01.js',import.meta.url),'utf8');
const context={window:{},console};
vm.createContext(context);
vm.runInContext(source,context,{filename:'pa-edict-parser-v01.js'});
const P=context.window.PLANO_ARQ_EDICT_PARSER;
assert.ok(P?.extractObjectiveRules,'OBJ-06 não exportada');

const line=(p,o,text,items=[])=>({ref:`p${p}:l${o}`,page:p,order:o,text,items});
const doc=(rows)=>({documentMap:{kind:'document-map',pages:[{number:1,lines:rows}]},pages:[{number:1,lines:rows.map(x=>x.text),text:rows.map(x=>x.text).join('\n')}],text:rows.map(x=>x.text).join('\n'),numPages:1,nativeChars:900});
const simpleRows=[
 line(1,1,'PROVA OBJETIVA'),
 line(1,2,'A prova objetiva terá caráter eliminatório e classificatório.'),
 line(1,3,'A duração da prova será de 4h30min.'),
 line(1,4,'Para aprovação, será exigida pontuação mínima de 60 pontos.'),
 line(1,5,'Aplicação da Prova Objetiva: 18/10/2026'),
 line(1,6,'Resultado da Prova Objetiva: 30/10/2026')
];
let d=doc(simpleRows),loc=P.locateObjective(d,null,[]),rules=P.extractObjectiveRules(d,loc,{sections:[]});
assert.equal(rules.date,'2026-10-18');
assert.equal(rules.durationMinutes,270);
assert.equal(rules.character,'Eliminatório e classificatório');
assert.equal(rules.minimum.kind,'points');
assert.equal(rules.minimum.value,60);

const textualRows=[
 line(1,1,'PROVA DE CONHECIMENTOS'),
 line(1,2,'Aplicação da prova de conhecimentos em 18 de outubro de 2026.'),
 line(1,3,'Tempo para realização da prova: 240 minutos.'),
 line(1,4,'O candidato deverá obter no mínimo 50% da pontuação.')
];
d=doc(textualRows);loc=P.locateObjective(d,null,[]);rules=P.extractObjectiveRules(d,loc,{sections:[]});
assert.equal(rules.date,'2026-10-18');
assert.equal(rules.durationMinutes,240);
assert.equal(rules.minimum.kind,'percentage');
assert.equal(rules.minimum.value,50);

const tableRows=[
 line(1,1,'PROVA OBJETIVA'),
 line(1,2,'Disciplina | Questões | Pontuação | Pontuação Mínima'),
 line(1,3,'Língua Portuguesa | 10 | 10 | 5'),
 line(1,4,'Arquitetura Hospitalar | 20 | 40 | 20'),
 line(1,5,'CONTEÚDO PROGRAMÁTICO')
];
d=doc(tableRows);loc=P.locateObjective(d,null,[]);const table=P.parseObjectiveTable(d,loc);
assert.equal(table.sections[0].minimumPoints,5);
assert.equal(table.sections[1].minimumPoints,20);
rules=P.extractObjectiveRules(d,loc,table);
assert.equal(rules.sectionMinimums.length,2);

const parsed=P.parseDocument(doc([
 line(1,1,'EDITAL Nº 01/2026'),
 line(1,2,'PROVA OBJETIVA'),
 line(1,3,'Disciplina | Questões | Pontuação'),
 line(1,4,'Arquitetura Hospitalar | 20 | 40'),
 line(1,5,'A prova objetiva terá caráter eliminatório e classificatório.'),
 line(1,6,'Duração da prova: 3 horas.'),
 line(1,7,'Pontuação mínima geral de 20 pontos.'),
 line(1,8,'Aplicação da Prova Objetiva 25/10/2026'),
 line(1,9,'CONTEÚDO PROGRAMÁTICO'),
 line(1,10,'ARQUITETURA HOSPITALAR'),
 line(1,11,'Dimensionamento funcional e fluxos hospitalares.')
]),null);
assert.equal(parsed.draft.examDate,'2026-10-25');
assert.equal(parsed.draft.durationMinutes,180);
assert.equal(parsed.schema.stages[0].minimum.value,20);
assert.equal(parsed.schema.stages[0].character,'Eliminatório e classificatório');
assert.equal(parsed.meta.objectiveRulesStatus,'parsed');

assert.equal(P.parseAnyDate('18 de outubro de 2026'),'2026-10-18');
assert.equal(P.parseDurationMinutes('duração: 4h30min'),270);
console.log('OBJ-06 OK · data, duração, regras e mínimos');
