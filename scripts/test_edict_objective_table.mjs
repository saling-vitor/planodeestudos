import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/pa-edict-parser-v01.js',import.meta.url),'utf8');
const context={window:{},console};
vm.createContext(context);
vm.runInContext(source,context,{filename:'pa-edict-parser-v01.js'});
const P=context.window.PLANO_ARQ_EDICT_PARSER;
assert.ok(P?.parseObjectiveTable,'Parser genérico da tabela objetiva não exportado');

const item=(text,x)=>({text,x,width:Math.max(20,text.length*5)});
const line=(page,order,text,items=[])=>({ref:`p${page}:l${order}`,page,order,text,items});
const doc=(rows)=>({documentMap:{kind:'document-map',pages:[{number:1,lines:rows}]},pages:[{number:1,lines:rows.map(x=>x.text),text:rows.map(x=>x.text).join('\n')}],text:rows.map(x=>x.text).join('\n'),numPages:1,nativeChars:900});
const loc=(rows)=>P.locateObjective(doc(rows),null,[]);

const geometryRows=[
 line(1,1,'PROVA OBJETIVA',[item('PROVA OBJETIVA',40)]),
 line(1,2,'Disciplina Nº de Questões Peso Pontuação',[item('Disciplina',40),item('Nº de Questões',280),item('Peso',390),item('Pontuação',470)]),
 line(1,3,'Língua Portuguesa 10 1,0 10,0',[item('Língua Portuguesa',40),item('10',280),item('1,0',390),item('10,0',470)]),
 line(1,4,'Geopolítica Regional 20 2,0 40,0',[item('Geopolítica Regional',40),item('20',280),item('2,0',390),item('40,0',470)]),
 line(1,5,'TOTAL 30 50,0',[item('TOTAL',40),item('30',280),item('50,0',470)]),
 line(1,6,'CONTEÚDO PROGRAMÁTICO',[item('CONTEÚDO PROGRAMÁTICO',40)])
];
let location=loc(geometryRows),table=P.parseObjectiveTable(doc(geometryRows),location);
assert.equal(table.mode,'geometry');
assert.equal(table.status,'parsed');
assert.equal(table.sections.length,2);
assert.equal(table.sections[0].label,'Língua Portuguesa');
assert.equal(table.sections[0].questions,10);
assert.equal(table.sections[0].pointsPerQuestion,1);
assert.equal(table.sections[0].totalPoints,10);
assert.equal(table.sections[1].label,'Geopolítica Regional','disciplinas desconhecidas não podem depender de lista fixa');
assert.equal(table.totalQuestions,30);
assert.equal(table.totalPoints,50);
assert.equal(table.sections.some(x=>/^TOTAL/i.test(x.label)),false);

const delimitedRows=[
 line(1,1,'PROVA ESCRITA OBJETIVA'),
 line(1,2,'Componente Curricular | Quantidade de Questões | Valor por Questão | Total de Pontos'),
 line(1,3,'Arquitetura Hospitalar | 12 | 2,5 | 30,0'),
 line(1,4,'Planejamento Urbano | 8 | 2,5 | 20,0'),
 line(1,5,'CONTEÚDO PROGRAMÁTICO')
];
location=loc(delimitedRows);table=P.parseObjectiveTable(doc(delimitedRows),location);
assert.equal(table.mode,'delimited');
assert.equal(table.sections.length,2);
assert.equal(table.sections[0].questions,12);
assert.equal(table.sections[0].pointsPerQuestion,2.5);
assert.equal(table.sections[1].totalPoints,20);

const textRows=[
 line(1,1,'PROVA DE CONHECIMENTOS'),
 line(1,2,'Matérias Número de Questões Pontuação'),
 line(1,3,'Língua Portuguesa 15 15'),
 line(1,4,'Conhecimentos Específicos 35 70'),
 line(1,5,'PROVA DE TÍTULOS')
];
location=loc(textRows);table=P.parseObjectiveTable(doc(textRows),location);
assert.equal(table.mode,'text');
assert.equal(table.sections.length,2);
assert.equal(table.sections[1].questions,35);
assert.equal(table.sections[1].totalPoints,70);
assert.equal(table.sections[1].pointsPerQuestion,2,'peso pode ser calculado quando questão e total são explícitos');

const calculateRows=[
 line(1,1,'PROVA OBJETIVA'),
 line(1,2,'Disciplina | Questões | Peso'),
 line(1,3,'Direito Administrativo | 10 | 1,5'),
 line(1,4,'Direito Constitucional | 10 | 2,0'),
 line(1,5,'CONTEÚDO PROGRAMÁTICO')
];
location=loc(calculateRows);table=P.parseObjectiveTable(doc(calculateRows),location);
assert.equal(table.totalPoints,35);
assert.equal(table.sections[0].totalPoints,15);
assert.equal(table.sections[0].totalPointsSource,'calculated');


const multilineRows=[
 line(1,1,'13. DA PROVA TEÓRICO-OBJETIVA',[item('13.',60),item('DA',80),item('PROVA',100),item('TEÓRICO-OBJETIVA',140)]),
 line(1,2,'13.1. A Prova Teórico-Objetiva será composta de 60 questões objetivas.'),
 line(1,3,'Pontuação',[item('Pontuação',398)]),
 line(1,4,'Nº Total de Pontuação',[item('Nº',244),item('Total',290),item('de',312),item('Pontuação',337)]),
 line(1,5,'Disciplinas Peso Mínima',[item('Disciplinas',171),item('Peso',269),item('Mínima',405)]),
 line(1,6,'Questões Pontos Mínima/Disciplina',[item('Questões',230),item('Pontos',292),item('Mínima/Disciplina',323)]),
 line(1,7,'Geral',[item('Geral',409)]),
 line(1,8,'Língua Portuguesa 10 1,00 10,00 4,00',[item('Língua',158),item('Portuguesa',186),item('10',244),item('1,00',271),item('10,00',296),item('4,00',350)]),
 line(1,9,'Legislação 10 1,00 10,00 4,00',[item('Legislação',158),item('10',244),item('1,00',271),item('10,00',296),item('4,00',350)]),
 line(1,10,'Conhecimentos',[item('Conhecimentos',158)]),
 line(1,11,'40 2,00 80,00 40,00',[item('40',244),item('2,00',271),item('80,00',296),item('40,00',348)]),
 line(1,12,'Específicos',[item('Específicos',158)]),
 line(1,13,'TOTAL 60 - 100,00 - -',[item('TOTAL',158),item('60',244),item('-',278),item('100,00',293),item('-',357),item('-',418)]),
 line(1,14,'CONTEÚDO PROGRAMÁTICO')
];
location=loc(multilineRows);table=P.parseObjectiveTable(doc(multilineRows),location);
assert.equal(location.sourceLabel,'13. DA PROVA TEÓRICO-OBJETIVA');
assert.equal(table.mode,'geometry');
assert.equal(table.sections.length,3,'cabeçalho geométrico em múltiplas linhas precisa preservar todos os componentes');
assert.equal(table.totalQuestions,60);
assert.equal(table.totalPoints,100);
assert.equal(table.sections[0].totalPoints,10);
assert.equal(table.sections[2].questions,40);
assert.equal(table.sections[2].totalPoints,80);
assert.equal(table.sections[2].minimum.value,40);

const missing=P.parseObjectiveTable(doc([line(1,1,'PROVA DE TÍTULOS'),line(1,2,'Experiência profissional')]),{status:'missing'});
assert.equal(missing.status,'missing');
assert.equal(missing.sections.length,0);

const parsed=P.parseDocument(doc(geometryRows),null);
assert.equal(parsed.objectiveTable.mode,'geometry');
assert.equal(parsed.draft.sections.length,2);
assert.equal(parsed.schema.stages[0].totalQuestions,30);
assert.equal(parsed.meta.objectiveTableStatus,'parsed');

console.log('OBJ-04 OK · parser genérico da tabela da prova objetiva');
