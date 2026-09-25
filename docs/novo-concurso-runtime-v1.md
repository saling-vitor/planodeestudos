# Novo Concurso · contrato de dados v1

Auditoria da ETAPA A do assistente de importação de edital.

## Estado reutilizado

- O cadastro canônico de concursos continua em `planoarq:contests:v1`, mesclado com `data/contests.json`.
- A Central do Edital continua consumindo o mesmo conceito de `exam schema` já usado em `data/exam-schemas.json`.
- O Planejamento continua derivando pesos e distribuição das seções da prova a partir do `exam schema`.
- O manifesto estático de documentos continua em `data/files.json`; documentos importados pelo usuário passam a ter uma camada dinâmica compatível, sem substituir o manifesto do repositório.
- Supabase Sync continua sincronizando valores de `localStorage`. Não foi criada uma segunda base de dados.

## Extensão local-first

`assets/js/pa-data-v03.js` passa a ser a porta comum para dados dinâmicos do concurso:

- `contestById(id)` / `saveContest(record)`
- `examSchemaForContest(id)` / `saveExamSchema(id, schema)`
- `contestFiles(id)` / `saveContestFiles(id, files)` / `upsertContestFile(id, file)`
- `saveImportDraft(id, draft)` / `loadImportDraft(id)`
- `contestBundle(id)`

Chaves dinâmicas:

- `planoarq:exam-schema::<contestId>`
- `planoarq:contest-files::<contestId>`
- `planoarq:contest-import-draft::<draftId>`

Essas chaves são compatíveis com backup/reset e com a sincronização já existente.

## Fonte única por tipo de dado

**Identificação e cargo:** registro do concurso.

**Estrutura da prova, etapas, critérios, conteúdo e cronograma:** exam schema do concurso. O novo importador deve enriquecer este objeto em vez de criar outro modelo concorrente.

**Documentos:** metadados no manifesto estático ou na camada dinâmica de documentos. O PDF binário não deve ser serializado em `localStorage`.

**Planejamento:** lê o exam schema; não mantém uma cópia independente de questões/pesos.

## PDF binário

O projeto atual não possui Supabase Storage configurado e o schema Supabase existente contém apenas registros JSON de sincronização. Portanto, a primeira implementação funcional do PDF deve usar armazenamento binário local separado (IndexedDB) e metadados sincronizáveis. Uma etapa posterior pode adicionar Supabase Storage sem alterar o contrato de metadados.

Nenhum segredo privado será colocado no GitHub Pages.

## Compatibilidade

Concursos atuais e fixtures estáticos continuam válidos. Leitura dinâmica é local-first e faz fallback para os catálogos estáticos existentes.

O próximo bloco de implementação é a ETAPA B: novo modal, upload visível e fallback manual, usando este contrato.
