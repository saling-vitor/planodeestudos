import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/pa-study-blueprint-v01.js',import.meta.url),'utf8');
const planning=fs.readFileSync(new URL('../planejamento.html',import.meta.url),'utf8');
const store=new Map();
const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const window={dispatchEvent(){}};
const context={window,localStorage,CustomEvent:function(type,init){this.type=type;this.detail=init?.detail},console,DOMParser:undefined,CSS:{escape:x=>x},structuredClone};
vm.createContext(context);vm.runInContext(source,context,{filename:'pa-study-blueprint-v01.js'});
const B=window.PLANO_ARQ_STUDY_BLUEPRINT;
assert.equal(B.version,'1.5');assert.ok(B.allocationForSchema);assert.ok(B.loadOrBuild);
const schema1={notice:'Edital 01/2026',position:'Arquiteto',stages:[{id:'objective',type:'objective',sections:[
 {id:'a',label:'Conhecimentos Gerais',questions:20,totalPoints:30,planWeight:60,sourceRefs:['p1:l1']},
 {id:'b',label:'Conhecimentos Específicos',questions:30,totalPoints:60,planWeight:30,sourceRefs:['p1:l2']},
 {id:'c',label:'Legislação',questions:10,totalPoints:10,planWeight:10,sourceRefs:['p1:l3']}
]}],content:[
 {sectionId:'a',label:'Português e Raciocínio',text:'Português; Raciocínio Lógico',sourceRefs:['p2:l1'],status:'confirmed'},
 {sectionId:'b',label:'Conhecimentos Específicos',text:'Projeto arquitetônico; Conforto ambiental',sourceRefs:['p2:l2'],status:'confirmed'}
]};
let a=B.allocationForSchema(schema1);
assert.equal(a.mode,'planWeight');assert.equal(a.fractions.a,.6);assert.equal(a.fractions.b,.3);assert.equal(a.fractions.c,.1);assert.equal(a.unallocatedWeight,0);
let bp=B.buildAndSave('c1',schema1,{title:'Concurso A',position:'Arquiteto'});
assert.equal(bp.sections.find(x=>x.id==='a').weightPct,60);assert.equal(bp.maps.find(x=>x.sectionId==='c').status,'awaiting-content');assert.equal(bp.maps.find(x=>x.sourceLabel==='Português e Raciocínio').sectionId,'a');assert.ok(bp.maps.find(x=>x.sectionId==='a').sourceRefs.includes('p2:l1'));
const mapA=bp.maps.find(x=>x.sectionId==='a');B.linkMaterial('c1',mapA.id,{id:'material-a'});
const schema2=structuredClone(schema1);schema2.stages[0].sections[0].planWeight=50;schema2.stages[0].sections[2].planWeight=20;
bp=B.loadOrBuild('c1',schema2,{title:'Concurso A'});
assert.notEqual(bp.sourceSignature,B.signature(schema1));assert.equal(bp.sourceSignature,B.signature(schema2));assert.equal(bp.sections.find(x=>x.id==='a').weightPct,50);assert.equal(bp.maps.find(x=>x.id===mapA.id).materialId,'material-a');
const incomplete={stages:[{type:'objective',sections:[{id:'x',label:'X',planWeight:60},{id:'y',label:'Y',planWeight:30}]}]};a=B.allocationForSchema(incomplete);assert.equal(Math.round(a.unallocatedWeight*100),10);
const byPoints={stages:[{type:'objective',sections:[{id:'x',label:'X',totalPoints:30},{id:'y',label:'Y',totalPoints:70}]}]};a=B.allocationForSchema(byPoints);assert.equal(a.mode,'points');assert.equal(a.fractions.x,.3);assert.equal(a.fractions.y,.7);
for(const token of ['loadOrBuild?.(contestId,examSchema,contest)','allocationForSchema?.(examSchema)','linkedIds=new Set(prepared.map(x=>x.materialId)','let unmappedWeight=schemaUnallocatedWeight','examSchemaSignature:studyBlueprint?.sourceSignature',"allocationMode:allocationReport.mode||'unknown'",'overallocatedWeight:schemaOverallocatedWeight'])assert.ok(planning.includes(token),'Planejamento sem integração: '+token);
assert.equal(planning.includes('nos 14 mapas'),false);
const unknown=B.allocationForSections([{id:'u1',label:'Sem peso A'},{id:'u2',label:'Sem peso B'}]);
assert.equal(unknown.mode,'review');assert.equal(unknown.fractions.u1,0);assert.equal(unknown.fractions.u2,0);assert.equal(unknown.unallocatedWeight,1);
console.log('OBJ-09 OK · ExamSchema, Blueprint e Planejamento integrados');
