# Auditoria — Novo Concurso por importação de edital

Data: 2026-09-25  
Escopo: ETAPA A — arquitetura atual, modelo de dados e fluxo existente.  
Status: concluída. Nenhum comportamento de produção foi substituído nesta etapa.

## 1. Fluxo atual confirmado

O fluxo de criação está integralmente em `index.html`.

Hoje o modal possui três passos manuais:

1. Identificação;
2. Edital e prova;
3. Confirmar.

Campos atuais:
- nome curto;
- órgão;
- cargo;
- banca;
- cidade/UF;
- edital;
- data da prova;
- observação.

Ao confirmar, `nextWizard()`:
- gera um slug/ID;
- acrescenta o registro em `planoarq:contests:v1`;
- define `planoarq:active-contest:v1`;
- abre `#contest/<id>`.

O PDF não participa da criação. A própria interface atual orienta o usuário a vincular o edital depois.

## 2. Persistência existente

### Índice de concursos
Fonte estática:
- `data/contests.json` → `data/contests.js`.

Fonte local editável:
- `planoarq:contests:v1`.

As páginas mesclam seed + local pelo `id`.

### Dados por concurso já existentes
O projeto usa chaves locais por concurso, por exemplo:
- `planoarq:planning::<contestId>`;
- `planoarq:generated-plan::<contestId>`;
- `planoarq:session-log::<contestId>`;
- `planoarq:review-activity::<contestId>`;
- `planoarq:file-favorites::<contestId>`;
- estados/notas dos mapas.

O padrão `::<contestId>` deve ser preservado.

### Supabase
A nuvem atual não possui uma tabela relacional específica de concursos. Ela sincroniza registros do localStorage pela tabela:
- `public.plano_arq_sync_records`.

Isso é compatível com adicionar novos registros estruturados por concurso sem criar outra arquitetura de sincronização.

**Gap identificado:** `keyContest()` em `pa-sync-v03.js` resolve IDs usando apenas `window.PLANO_ARQ_CONTESTS` (seed estático). Concursos criados localmente podem ser enviados com `contest_id = global`, embora o `record_key` continue preservado. A implementação do novo fluxo deve corrigir o resolvedor para considerar seed + `planoarq:contests:v1`.

## 3. Central do Edital atual

`edital.html` consome:

- identidade do concurso de seed + `planoarq:contests:v1`;
- estrutura de prova de `data/exam-schemas.json/js`;
- documentos de `data/files.js` e, como fallback, `schema.documents`;
- mapas estáticos para cobertura.

A estrutura de prova existente já é adequada para reutilização:
- `stages[]`;
- etapa objetiva;
- `sections[]`;
- questões;
- pontos por questão;
- total de pontos;
- mínimos;
- `schedule[]`;
- `rules[]`;
- `documents[]`.

**Gap identificado:** um concurso criado pelo wizard atual não ganha `examSchemaId` nem schema dinâmico; por isso a Central do Edital não recebe automaticamente etapas, cronograma, regras ou documentos.

## 4. Planejamento atual

`planejamento.html` procura:

1. um schema em `PLANO_ARQ_EXAM_SCHEMAS`;
2. se não existir, converte `contest.examBlueprint` por `legacySchemaFromContest()`.

O Planejamento já calcula os percentuais preferencialmente pelos pontos de cada componente, com fallback para número de questões.

**Conclusão:** não é necessário criar outro motor de pesos. O novo fluxo deve alimentar o mesmo formato de estágio/seções já consumido pelo Planejamento.

## 5. Arquivos atual

`arquivos.html` consome o manifesto estático `PLANO_ARQ_FILES`.

Hoje não existe registro dinâmico persistente de documentos importados pelo usuário nem armazenamento do blob PDF dentro do modelo do concurso.

O PDF do novo fluxo precisa de duas camadas:
- metadados estruturados no perfil do edital;
- conteúdo binário armazenado separadamente.

Não colocar PDF/base64 no localStorage.

## 6. Modelo dinâmico escolhido

Para evitar duplicar o concurso inteiro e, ao mesmo tempo, não sobrecarregar `planoarq:contests:v1`, a extensão dinâmica será um registro por concurso:

`planoarq:edital-profile::<contestId>`

Esse registro será a **fonte estruturada comum do edital para concursos criados/importados pelo usuário**.

Estrutura prevista:

```json
{
  "schema": 1,
  "contestId": "id",
  "source": {
    "kind": "pdf-import",
    "documentId": "id",
    "fileName": "edital.pdf",
    "importedAt": "ISO"
  },
  "identity": {
    "officialName": null,
    "organization": null,
    "city": null,
    "uf": null,
    "administrativeSphere": null,
    "noticeNumber": null,
    "noticeYear": null,
    "publicationDate": null,
    "version": null
  },
  "position": {
    "code": null,
    "name": null,
    "educationLevel": null,
    "specialty": null,
    "requirements": [],
    "vacancies": null,
    "reserveRegister": null,
    "workloadWeekly": null,
    "compensation": null,
    "benefits": [],
    "regime": null
  },
  "stages": [],
  "schedule": [],
  "rules": [],
  "syllabus": [],
  "documents": [],
  "extraction": {
    "status": "reviewed",
    "fields": {}
  }
}
```

### Por que este modelo
- mantém `planoarq:contests:v1` como índice/identidade resumida;
- preserva o padrão local-first existente;
- é sincronizável pelo motor atual;
- permite que Central do Edital e Planejamento consumam a mesma fonte;
- mantém `data/exam-schemas.json` como fallback estático dos concursos já existentes;
- evita duplicar prova/cronograma/regras em páginas independentes.

## 7. Resolvedor comum necessário

A implementação deverá criar um resolvedor único, reutilizado por Central do Edital e Planejamento:

1. localizar concurso (seed + local);
2. localizar `planoarq:edital-profile::<contestId>`;
3. se houver perfil local, ele é a fonte dinâmica prioritária;
4. se não houver, usar `data/exam-schemas` / modelo existente;
5. nunca manter três cópias independentes da mesma data, prova ou cronograma.

O resolvedor é uma camada de leitura/normalização, não um novo banco paralelo.

## 8. PDF — estratégia de armazenamento

### Metadados
Ficam em `planoarq:edital-profile::<contestId>.documents[]`.

### Blob local
Usar IndexedDB para o arquivo importado enquanto o Portal estiver local/offline.

### Nuvem
A arquitetura atual do Supabase possui apenas `plano_arq_sync_records`; não há Storage configurado no repositório.

Para disponibilizar o mesmo PDF em outro aparelho sem expor segredo:
- usar Supabase Storage autenticado;
- bucket privado;
- política por `auth.uid()`;
- caminho por usuário/concurso/documento;
- upload via sessão OTP existente e chave publishable.

Nenhuma `service_role` deve ir para o navegador.

Esta parte será integrada na ETAPA E; a ETAPA B/C pode trabalhar com o blob local sem bloquear o wizard.

## 9. Extração do PDF

A leitura deve ser client-side sempre que possível.

Pipeline previsto:
1. validar MIME/extensão/tamanho;
2. tentar leitura textual nativa;
3. classificar PDF textual x aparentemente digitalizado;
4. extrair blocos candidatos;
5. parser determinístico para campos/tabelas/datas/cargos;
6. interpretação adicional somente quando necessária;
7. OCR apenas para PDF sem texto útil.

Resultado de extração sempre preserva:
- valor;
- origem/trecho quando disponível;
- estado simples: confirmado / revisar / não encontrado;
- tipo: extraído / calculado / manual.

Nenhum campo ausente recebe valor inventado.

## 10. Vários cargos

O parser não pode escolher cargo automaticamente quando houver múltiplos candidatos plausíveis.

O wizard deverá:
1. identificar a lista;
2. pedir seleção;
3. filtrar cargo escolhido + regras gerais;
4. descartar da revisão final o conteúdo exclusivo dos outros cargos.

## 11. Compatibilidade

Não será exigida migração destrutiva.

Concursos existentes continuam funcionando porque:
- seed continua válido;
- `planoarq:contests:v1` permanece;
- `examSchemaId` continua suportado;
- `examBlueprint` legado continua suportado;
- o novo perfil é adicional e opcional.

## 12. ETAPA B — alteração exata planejada

Próximo bloco funcional:

- substituir o corpo do wizard em `index.html` por fluxo:
  1. **Edital**;
  2. **Revisar**;
  3. **Criar**;
- primeira tela com dropzone PDF como ação principal;
- botão **Criar manualmente** como fallback;
- manter formulário atual reutilizado no modo manual;
- adicionar estado de arquivo selecionado e validação inicial;
- não implementar parser completo ainda;
- não criar concurso antes da revisão;
- manter acessibilidade, teclado e responsividade.

## 13. Critérios de aceite desta auditoria

Confirmado no código atual:
- fluxo manual localizado;
- armazenamento atual identificado;
- consumo da Central do Edital identificado;
- consumo do Planejamento identificado;
- sincronização Supabase identificada;
- armazenamento de documentos atual identificado;
- gaps de concursos dinâmicos identificados;
- modelo evolutivo definido sem recriar concursos existentes;
- caminho seguro para PDF definido sem segredo privado no frontend.
