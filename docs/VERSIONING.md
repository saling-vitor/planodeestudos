# Plano ARQ · Contrato de versionamento

Este documento separa **versão de produto** de **versões técnicas de compatibilidade**.

## Produto

- Baseline pública atual: **1.1.0**.
- SHA publicado: `79da5bfe2f486da208b6e04a3fc06e13eae9a54d`.
- Branch congelada: `release/v1.1.0`.
- Tag/GitHub Release: `v1.1.0`.
- `main`, branch de release e tag apontam para o mesmo estado aprovado.
- Novos backups da V1.1.0 registram **1.1.0**.

A próxima linha de desenvolvimento parte de `develop/v1.2`. A versão estruturada do produto **não deve ser alterada para 1.2.0 apenas por abrir a branch**; isso ocorrerá quando o escopo do próximo ciclo for formalmente iniciado.

As versões técnicas internas permanecem independentes da versão do produto.

## Runtime e PWA

| Identificador | Valor | Função |
| --- | --- | --- |
| Data API | 3.5 | Contrato interno de dados/backups |
| Sync | 3.1 | Runtime de sincronização Supabase |
| PWA | 19.4 | Versão-base canônica declarada em `assets/js/pa-pwa-v01.js` |
| Service Worker | 19.4-source | Valor derivado automaticamente da versão-base |
| Offline Pack | 19.4-production | Valor derivado automaticamente da versão-base |
| Deploy PWA | 19.4-<sha8> | Valor derivado automaticamente da versão-base + SHA do deploy |
| Automação | 1.1 | Motor read-only de sugestões e prioridades do Hoje |

PWA, Service Worker e Offline Pack formam um grupo coordenado. A partir da V1.2, **o número-base é escrito em um único ponto**: `const VERSION` de `assets/js/pa-pwa-v01.js`.

`scripts/sync_pwa_version.py` deriva o Service Worker; `scripts/build_offline_pack.py` deriva o manifesto offline; e o workflow de Pages deriva `<versão-base>-<sha8>` no deploy. O YAML de produção não contém mais `19.4` hardcoded.

O valor versionado em `service-worker.js` no repositório é apenas um snapshot derivado para uso direto/local; antes de qualquer gate ou deploy ele é sincronizado novamente a partir da fonte canônica.

## Mapas de estudo

| Identificador | Situação |
| --- | --- |
| V134.0 | versão canônica do preconfig |
| MINDMAP_V139 | API canônica do runtime adaptativo |
| bridge 1.1 | metadado dos 14 mapas empacotados V02; compatibilidade preservada |
| bridge runtime 1.3 | contrato emitido pelo runtime atual |
| Study Blueprint 1.3 | contrato do fluxo de geração/importação/auditoria H1/H2/H3 |
| MINDMAP_V133 → MINDMAP_V134 | alias obrigatório de compatibilidade |
| MINDMAP_V135 → MINDMAP_V139 | alias obrigatório de compatibilidade |

Os aliases **não são lixo**. Eles permanecem porque arquivos/estados anteriores podem referenciá-los. Só podem ser removidos junto com uma migração explícita e testes que comprovem preservação de progresso.

A diferença de bridge também é intencionalmente documentada: os **14 mapas empacotados atuais declaram 1.1**, enquanto o runtime e o Study Blueprint estão em **1.3**. Como os 14 mapas passam integralmente pela auditoria real, a V1.1 preserva essa compatibilidade em vez de regravar metadados apenas para igualar números. Novos mapas gerados/auditados pelo fluxo H3 usam o contrato atual.

## Fonte de verdade

A representação estruturada do produto e das regras técnicas é:

`data/version-contract.json`

Para PWA, o contrato **aponta para a fonte canônica**, em vez de repetir o número-base. O CI executa `scripts/validate_versions.py` e `scripts/validate_pwa_cache.py` e bloqueia:

- divergência entre runtime e Service Worker;
- divergência do Offline Pack;
- versão-base hardcoded no workflow de Pages;
- versão-base hardcoded no gerador do pacote offline;
- ausência do sincronizador canônico no deploy.

O gate contínuo é `.github/workflows/validate-development.yml` e atende `develop/**`, portanto não precisa ser copiado apenas porque o ciclo muda de V1.2 para V1.3. Gates históricos de RC/release continuam preservados separadamente.

## Release V1.1.0 — concluída

1. gate funcional: **concluído**;
2. checklist manual 80% / 125% / 150%: **concluído**;
3. versão de produto coordenada em **1.1.0**;
4. validadores e regressão final: **concluídos**;
5. SHA final congelado: `79da5bfe2f486da208b6e04a3fc06e13eae9a54d`;
6. promoção para `main`: **concluída**;
7. deploy real + auditorias: **concluídos**;
8. tag/release `v1.1.0`: **publicada**.

Qualquer ciclo posterior deve começar em branch de desenvolvimento nova e preservar esta baseline.
