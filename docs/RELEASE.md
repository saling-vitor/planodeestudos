# Plano ARQ · Release V1.2.0

Documento canônico da preparação final **1.2.0**.

## Estado

- Release alvo: `1.2.0`.
- Branch final: `release/v1.2.0`.
- RC aprovado: `1.2.0-rc.1`.
- SHA do RC com QA aprovado: `93e163880e4f06b09c5ddac221c85938c984437f`.
- Functional freeze: `84afc81faf45af6d67ee9e3441d5f1204734bccd`.
- Runtime final preparado: `1.2.0`.
- `BUILD_MAINTENANCE=false`.
- `MAINTENANCE_MODE=false`.
- QA manual Chrome 80%, 125% e 150%: **aprovado**.
- V1.1.0 permanece a produção pública até a promoção do SHA final para `main`.

## Gate obrigatório

A V1.2.0 só pode ser promovida quando o mesmo SHA da branch final satisfizer:

1. versão canônica `1.2.0` no runtime, backups e `data/cloud-config.json`;
2. contrato de versões em `final-preparation`;
3. `BUILD_MAINTENANCE=false` e `MAINTENANCE_MODE=false`;
4. validadores de produção, layout, CSS, JavaScript, PWA/cache e versões;
5. auditor de manutenção do CSS dos mapas;
6. auditor de modularização do Portal;
7. validação do functional freeze e allowlist pós-freeze;
8. QA manual 80%, 125% e 150% aprovado;
9. Data Safety e automação read-only;
10. auditoria real dos 14 mapas;
11. cold-offline;
12. auditoria visual completa do Portal;
13. fluxo operacional de concurso novo;
14. ausência de resíduos/temporários rastreados.

## Promoção

Somente um SHA com **Gate V1.2 Release verde** pode ser promovido para `main`.

Após o deploy real aprovado:

- congelar `release/v1.2.0`;
- criar tag `v1.2.0` no SHA publicado;
- publicar GitHub Release `Plano ARQ V1.2.0`;
- fechar o contrato como `released`.

A tag/release **não deve ser criada antes do deploy real aprovado**.
