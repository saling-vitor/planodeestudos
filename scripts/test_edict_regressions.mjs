import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const parserSource=fs.readFileSync(new URL('../assets/js/pa-edict-parser-v01.js',import.meta.url),'utf8');
const readerSource=fs.readFileSync(new URL('../assets/js/pa-edict-pdf-v01.js',import.meta.url),'utf8');
const blueprintSource=fs.readFileSync(new URL('../assets/js/pa-study-blueprint-v01.js',import.meta.url),'utf8');
const planning=fs.readFileSync(new URL('../planejamento.html',import.meta.url),'utf8');
const review=fs.readFileSync(new URL('../assets/js/pa-contest-import-v01.js',import.meta.url),'utf8');
const catalog=JSON.parse(fs.readFileSync(new URL('../data/exam-schemas.json',import.meta.url),'utf8'));

const parserContext={window:{},console};vm.createContext(parserContext);vm.runInContext(parserSource,parserContext,{filename:'pa-edict-parser-v01.js'});
const P=parserContext.window.PLANO_ARQ_EDICT_PARSER;assert.equal(P.version,'1.7');assert.ok(P.extractResponseModel);
const readerContext={window:{},console,setTimeout,clearTimeout,Uint8Array,ArrayBuffer};vm.createContext(readerContext);vm.runInContext(readerSource,readerContext,{filename:'pa-edict-pdf-v01.js'});
const R=readerContext.window.PLANO_ARQ_PDF_READER;
const store=new Map(),localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const blueprintContext={window:{dispatchEvent(){}},localStorage,CustomEvent:function(type,init){this.type=type;this.detail=init?.detail},console,DOMParser:undefined,CSS:{escape:x=>x}};
vm.createContext(blueprintContext);vm.runInContext(blueprintSource,blueprintContext,{filename:'pa-study-blueprint-v01.js'});
const B=blueprintContext.window.PLANO_ARQ_STUDY_BLUEPRINT;assert.equal(B.version,'1.5');

const line=(p,o,text)=>({ref:`p${p}:l${o}`,page:p,order:o,text,items:[]});
const doc=texts=>{const rows=texts.map((text,i)=>line(1,i+1,text));return{documentMap:{kind:'document-map',pages:[{number:1,lines:rows}]},pages:[{number:1,lines:rows.map(x=>x.text),text:rows.map(x=>x.text).join('\n')}],text:rows.map(x=>x.text).join('\n'),numPages:1,nativeChars:Math.max(1200,rows.map(x=>x.text).join('').length)}};
const objectiveOf=result=>result.schema.stages.find(x=>x.type==='objective');
const assertObjectiveOnly=result=>{assert.ok(objectiveOf(result),'Prova objetiva ausente');assert.deepEqual(Array.from(result.schema.stages,x=>x.type),['objective'])};
const section=result=>Object.fromEntries(objectiveOf(result).sections.map(x=>[x.label,x]));

// CASAN / Instituto AOCP — fatos reduzidos do edital fornecido pelo usuário.
let result=P.parseDocument(doc([
 'EDITAL DE CONCURSO PÚBLICO N.º 003/2026','COMPANHIA CATARINENSE DE ÁGUAS E SANEAMENTO – CASAN','Instituto AOCP',
 'Código do Cargo | Cargo','406 | Arquiteto e Urbanista','CARGO: ARQUITETO E URBANISTA','PROVA OBJETIVA',
 'Área de Conhecimento | Nº de Questões | Valor por Questão | Valor Total',
 'Língua Portuguesa | 10 | 1 | 10','Raciocínio Lógico - Matemático | 7 | 1 | 7','Conhecimentos Gerais - Atualidades | 3 | 1 | 3','Legislação | 5 | 1 | 5','Conhecimentos Específicos | 25 | 1 | 25',
 'A Prova Objetiva será composta de 50 questões, com 5 (cinco) alternativas e apenas uma correta.',
 'O candidato deverá obter no mínimo 25 pontos na Prova Objetiva.','A aplicação da Prova Objetiva terá duração de 4 horas.','Aplicação da Prova Objetiva 22/11/2026',
 'CONTEÚDO PROGRAMÁTICO','CONHECIMENTOS ESPECÍFICOS','Projeto arquitetônico; acessibilidade; planejamento urbano.','PROVA DE TÍTULOS','Avaliação classificatória de títulos.'
]),{code:'406',name:'Arquiteto e Urbanista',group:'',source:'explicit'});
assertObjectiveOnly(result);let o=objectiveOf(result);assert.equal(o.totalQuestions,50);assert.equal(o.totalPoints,50);assert.equal(o.alternatives,5);assert.equal(o.answerModel,'multiple-choice');assert.equal(o.minimum.value,25);assert.equal(o.durationMinutes,240);assert.equal(o.date,'2026-11-22');assert.ok(result.schema.content.length>=1);

// Tapera / FUNDATEC — cargo sem prefixo CP, tabela de nível superior e etapas externas ignoradas.
result=P.parseDocument(doc([
 'EDITAL N° 217/2026 — CONCURSO PÚBLICO N° 01/2026','PREFEITURA MUNICIPAL DE TAPERA/RS','Executora: FUNDATEC','2 Arquiteto','PROVA TEÓRICO-OBJETIVA',
 'Disciplina | Nº de Questões | Pontos por Questão | Acertos Mínimos',
 'Língua Portuguesa | 10 | 2 | 1','Matemática/Raciocínio Lógico | 5 | 2 | 1','Conhecimentos Gerais | 5 | 2 | 1','Legislação | 10 | 2 | 1','Conhecimentos Específicos | 10 | 2 | 5','Informática | 5 | 2 | 1',
 'A prova terá duração de 3 horas.','As questões serão de múltipla escolha, com 4 (quatro) alternativas (A, B, C e D).','Pontuação mínima geral de 45 pontos.','Aplicação da Prova Teórico-Objetiva 11/10/2026',
 'CONTEÚDO PROGRAMÁTICO','CONHECIMENTOS ESPECÍFICOS','Acessibilidade; conforto ambiental; execução e fiscalização de obras públicas.','PROVA DE TÍTULOS','PROVA PRÁTICA','AVALIAÇÃO PSICOLÓGICA'
]),{code:'2',name:'Arquiteto',group:'',source:'explicit'});
assertObjectiveOnly(result);o=objectiveOf(result);assert.equal(o.totalQuestions,45);assert.equal(o.totalPoints,90);assert.equal(o.alternatives,4);assert.equal(o.answerModel,'multiple-choice');assert.equal(o.minimum.value,45);assert.equal(o.durationMinutes,180);assert.equal(o.date,'2026-10-11');assert.equal(o.sections.length,6);assert.equal(section(result)['Conhecimentos Específicos'].minimumQuestions,5);

// Canguçu / Instituto Objetiva — grupo G04 seleciona a objetiva correta.
const cangucuText=['CONCURSO PÚBLICO Nº 001/2026','MUNICÍPIO DE CANGUÇU/RS','Realização: INSTITUTO OBJETIVA','Cargo | Grupo de Prova','Arquiteto | G04','GRUPO DE PROVA: G04','PROVA OBJETIVA','Disciplina | Nº de Questões | Peso por Questão | Peso Total de cada Disciplina','Língua Portuguesa | 12 | 1,5 | 18','Raciocínio Lógico | 8 | 1 | 8','Conhecimentos Gerais | 6 | 1 | 6','Legislação | 8 | 1,5 | 12','Conhecimentos Específicos | 16 | 3,5 | 56','A prova objetiva será composta por questões de múltipla escolha, com até 04 alternativas.','Serão aprovados os candidatos que obtiverem 60% ou mais na nota final da prova objetiva.','Aplicação da Prova Objetiva — Grupo G04 01/11/2026','PROGRAMA DE ESTUDOS','CONHECIMENTOS ESPECÍFICOS','Projeto arquitetônico; urbanismo; legislação profissional.','PROVA DE TÍTULOS','PROVA PRÁTICA — outros cargos'];
const cargos=P.cargos(cangucuText.join('\n'),cangucuText,null),arq=cargos.find(x=>x.name==='Arquiteto');assert.ok(arq);assert.equal(arq.group,'G04');
result=P.parseDocument(doc(cangucuText),arq);assertObjectiveOnly(result);o=objectiveOf(result);assert.equal(result.draft.examGroup,'G04');assert.equal(o.totalQuestions,50);assert.equal(o.totalPoints,100);assert.equal(o.alternatives,4);assert.equal(o.minimum.kind,'percentage');assert.equal(o.minimum.value,60);assert.equal(section(result)['Conhecimentos Específicos'].totalPoints,56);

// Banca desconhecida + sete disciplinas arbitrárias: nenhuma lista fixa de nomes/bancas.
const unknownRows=['EDITAL Nº 09/2026','ORGANIZADORA XYZ PESQUISA','Cargo: Especialista em Planejamento Urbano','PROVA DE CONHECIMENTOS','Disciplina | Questões | Pontuação','Administração Pública | 5 | 5','Direito Constitucional | 5 | 5','Arquitetura Hospitalar | 5 | 5','Geoprocessamento | 5 | 5','Mobilidade Urbana | 5 | 5','História Regional | 5 | 5','Políticas de Habitação | 5 | 5','CONTEÚDO PROGRAMÁTICO','MOBILIDADE URBANA','Sistemas de transporte; desenho viário; acessibilidade.'];
result=P.parseDocument(doc(unknownRows),{code:'',name:'Especialista em Planejamento Urbano',group:'',source:'explicit'});assertObjectiveOnly(result);o=objectiveOf(result);assert.equal(result.draft.board,'');assert.equal(o.sections.length,7);assert.equal(o.totalQuestions,35);assert.equal(o.date,'');assert.equal(o.durationMinutes,null);assert.equal(o.minimum,null);

// Certo/Errado e penalização ficam representáveis, sem inventar fórmula.
let ceDoc=doc(['EDITAL Nº 10/2026','PROVA OBJETIVA','Disciplina | Questões | Pontuação','Conhecimentos Técnicos | 20 | 20','Os itens serão julgados como CERTO ou ERRADO.','Uma resposta errada anula uma resposta certa.']);
let loc=P.locateObjective(ceDoc,null,[]),rm=P.extractResponseModel(ceDoc,loc);assert.equal(rm.answerModel,'true-false');assert.equal(rm.alternatives,2);assert.equal(rm.scoringModel,'negative-marking');assert.match(rm.scoringRuleRaw,/errada anula/i);assert.ok(rm.sourceRefs.length>=1);

// Conflitos continuam explícitos para revisão.
result=P.parseDocument(doc(['EDITAL Nº 11/2026','CARGO: ARQUITETO','PROVA OBJETIVA','Disciplina | Questões | Pontuação','Arquitetura | 10 | 10','Aplicação da Prova Objetiva 18/10/2026','Realização da Prova Objetiva 25/10/2026','CONTEÚDO PROGRAMÁTICO','ARQUITETURA','Projetos.']),{code:'',name:'Arquiteto',group:'',source:'explicit'});assert.ok(result.conflicts.some(x=>x.id==='exam-date-conflict'));assert.equal(result.evidence.fields.examDate.status,'review');

// O boleto fornecido pelo usuário é representado sem dados pessoais e precisa ser rejeitado.
const boletoText=['BOLETO BANCÁRIO','Beneficiário','Nosso Número','Número do Documento','Vencimento','Valor do Documento','Pagador','Recibo do Pagador','PIX Cobrança','Taxa de inscrição de concurso'].join('\n');
const boletoMap=R.buildDocumentMap([{number:1,text:boletoText,lines:boletoText.split('\n')}],{name:'boleto.pdf',numPages:1,mode:'native'}),boleto=R.validateDocument(boletoMap);assert.equal(boleto.status,'rejected');assert.equal(boleto.message,'Este PDF não parece ser um edital de concurso.');

// Planejamento/Blueprint: lacunas nunca recebem peso igual silenciosamente.
let a=B.allocationForSections([{id:'a',label:'A'},{id:'b',label:'B'}]);assert.equal(a.mode,'review');assert.equal(a.fractions.a,0);assert.equal(a.fractions.b,0);assert.equal(a.unallocatedWeight,1);
a=B.allocationForSections([{id:'a',label:'A',planWeight:70},{id:'b',label:'B'}]);assert.equal(a.mode,'partial-planWeight');assert.equal(a.fractions.a,.7);assert.equal(a.fractions.b,0);assert.equal(Math.round(a.unallocatedWeight*100),30);
a=B.allocationForSections([{id:'a',label:'A',totalPoints:30},{id:'b',label:'B',totalPoints:70}]);assert.equal(a.mode,'points');assert.equal(a.fractions.a,.3);assert.equal(a.fractions.b,.7);
const bp=B.build('reg-obj',{position:'Arquiteto',stages:[{type:'objective',sections:[{id:'a',label:'Arquitetura',questions:10,totalPoints:20}]}],content:[{label:'Arquitetura',sectionId:'a',text:'Projeto; conforto.',stageType:'objective'},{label:'Títulos acadêmicos',text:'Doutorado; mestrado.',stageType:'titles'},{label:'Prova prática',text:'Execução prática.',stage:'practical'}]},{title:'Teste'},null);
assert.equal(bp.sourceBlocks.length,1);assert.equal(bp.sourceBlocks[0].label,'Arquitetura');assert.equal(bp.maps.some(x=>/Títulos|Prova prática/i.test(x.title)),false);
assert.ok(planning.includes("allocationForSchema?.(examSchema)"));assert.ok(planning.includes("let mode='review'"));assert.equal(planning.includes("let mode='equal'"),false);
assert.ok(review.includes('Modelo de respostas'));assert.ok(review.includes('id="rwAnswerModel"'));

// Fixtures históricos existentes permanecem como regressão de compatibilidade, sem alteração dos dados cadastrados.
const byId=Object.fromEntries(catalog.schemas.map(x=>[x.id,x])),obj=id=>byId[id].stages.find(x=>x.type==='objective');
assert.equal(obj('demhab-poa-arquiteto-2026').totalQuestions,60);assert.equal(obj('demhab-poa-arquiteto-2026').totalPoints,100);assert.deepEqual(obj('demhab-poa-arquiteto-2026').sections.map(x=>x.totalPoints),[80,10,10]);
assert.equal(obj('fixture-casan-aocp-arquiteto-2026').totalQuestions,50);assert.equal(obj('fixture-casan-aocp-arquiteto-2026').totalPoints,50);
assert.equal(obj('fixture-tapera-fundatec-arquiteto-2026').totalQuestions,45);assert.equal(obj('fixture-tapera-fundatec-arquiteto-2026').totalPoints,90);
assert.equal(obj('fixture-cangucu-objetiva-arquiteto-2026').totalQuestions,50);assert.equal(obj('fixture-cangucu-objetiva-arquiteto-2026').totalPoints,100);assert.ok(byId['fixture-cangucu-objetiva-arquiteto-2026'].rules.some(x=>/G04/.test(x)));

console.log('OBJ-10 OK · regressões universais de edital, resposta, pesos, Blueprint e não-edital');
