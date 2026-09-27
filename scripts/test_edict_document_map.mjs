import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/pa-edict-pdf-v01.js',import.meta.url),'utf8');
const context={window:{},console,setTimeout,clearTimeout,Uint8Array,ArrayBuffer};
vm.createContext(context);
vm.runInContext(source,context,{filename:'pa-edict-pdf-v01.js'});
const R=context.window.PLANO_ARQ_PDF_READER;
assert.ok(R,'PDF reader não exportado');
assert.equal(R.version,'1.1');

const items=[
 {str:'EDITAL DE ABERTURA',transform:[10,0,0,10,40,760],width:105,height:10,fontName:'F1',dir:'ltr'},
 {str:'Nº 01/2026',transform:[10,0,0,10,155,760],width:58,height:10,fontName:'F1',dir:'ltr'},
 {str:'PROVA OBJETIVA',transform:[10,0,0,10,40,730],width:92,height:10,fontName:'F1',dir:'ltr'}
];
const rows=R.buildRows(items,1,595,842);
assert.equal(rows.length,2,'linhas geométricas não agrupadas corretamente');
assert.equal(rows[0].text,'EDITAL DE ABERTURA Nº 01/2026');
assert.equal(rows[0].items[0].x,40,'coordenada X foi perdida');
assert.equal(rows[0].bbox.x,40,'bbox da linha incorreto');
assert.ok(rows[0].normalized&&rows[0].normalized.left>0,'bbox normalizado ausente');

const validText=[
 'EDITAL DE ABERTURA Nº 01/2026',
 'CONCURSO PÚBLICO PARA PROVIMENTO DE CARGOS',
 'CARGOS, VAGAS E REQUISITOS',
 'INSCRIÇÕES',
 'PROVA OBJETIVA',
 'CONTEÚDO PROGRAMÁTICO',
 'CRONOGRAMA'
].join('\n');
const validMap=R.buildDocumentMap([{number:1,width:595,height:842,rotation:0,text:validText,lines:validText.split('\n')}],{name:'edital.pdf',mimeType:'application/pdf',sizeBytes:1200,numPages:1,mode:'native'});
assert.equal(validMap.kind,'document-map');
assert.equal(validMap.pageCount,1);
assert.equal(validMap.pages[0].lines[0].ref,'p1:l1');
const valid=R.validateDocument(validMap);
assert.equal(valid.status,'confirmed','edital genérico deveria ser confirmado');
assert.equal(valid.likelyEdict,true);

const boletoText=[
 'BOLETO BANCÁRIO',
 'LINHA DIGITÁVEL 00190.00009 01234.567890',
 'Beneficiário: Instituto Exemplo',
 'Pagador: Candidato',
 'Nosso Número 123456',
 'Valor do Documento R$ 120,00',
 'Recibo do Pagador',
 'Taxa de inscrição do concurso público'
].join('\n');
const boletoMap=R.buildDocumentMap([{number:1,text:boletoText,lines:boletoText.split('\n')}],{name:'boleto.pdf',numPages:1,mode:'native'});
const boleto=R.validateDocument(boletoMap);
assert.equal(boleto.status,'rejected','boleto não pode ser aceito como edital');
assert.equal(boleto.message,'Este PDF não parece ser um edital de concurso.');

const reviewText=['EDITAL Nº 02/2026','CARGOS E VAGAS','INSCRIÇÕES'].join('\n');
const review=R.validateDocument(R.buildDocumentMap([{number:1,text:reviewText,lines:reviewText.split('\n')}],{numPages:1}));
assert.equal(review.status,'review','documento plausível, mas incompleto, deve ir para revisão em vez de ser inventado/confirmado');

console.log('OBJ-01 OK · DocumentMap, geometria e validação de documento');
