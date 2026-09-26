# Plano ARQ · Release V1.1.0

Documento canônico da versão final **1.1.0**.

## Estado de produção

- Release alvo: `1.1.0`.
- Branch final: `release/v1.1.0`.
- Branch de produção após promoção: `main`.
- Runtime local: `BUILD_MAINTENANCE=false`.
- Service Worker: `MAINTENANCE_MODE=false`.
- Modo de operação: local-first.
- Compatibilidade com dados, URLs, localStorage, backups, contestId e identificadores da V1.0.0 preservada.
- A baseline V1.0.0 continua congelada em `release/v1.0.0`.

## Gate obrigatório

A V1.1.0 só pode ser promovida quando o mesmo estado de código satisfizer:

1. versão canônica `1.1.0` no runtime de dados, backups e `data/cloud-config.json`;
2. `BUILD_MAINTENANCE=false` e `MAINTENANCE_MODE=false`;
3. validadores de produção, layout, CSS, JavaScript, PWA/cache e versões sem erros;
4. Data Safety e automação read-only aprovadas;
5. auditoria dos 14 mapas em 84 casos aprovada;
6. cold-offline aprovado;
7. auditoria do Portal em 286 casos aprovada;
8. QA manual em Chrome real aprovado em 80%, 125% e 150%;
9. Gate V1.1 Release verde na branch final;
10. ausência de temporários, backups de desenvolvimento ou resíduos rastreados.

Após o deploy real do `main`, a tag/GitHub Release `v1.1.0` deve apontar exatamente para o commit publicado e aprovado.

## QA já concluído

O Release Candidate passou pelo QA manual em 80%, 125% e 150% e pelo Gate V1.1 Release antes da preparação final.

A preparação final altera apenas metadados de versão, documentação e contratos de release. Nenhuma nova funcionalidade entra após o feature freeze.
