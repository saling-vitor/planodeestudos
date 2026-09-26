# Plano ARQ · Contrato de versionamento

Este documento separa **versão de produto** de **versões técnicas de compatibilidade**.

## Produto

- Baseline pública atual antes da promoção: **1.0.0**.
- Versão final preparada: **1.1.0**.
- Branch final: `release/v1.1.0`.
- Na branch final, `productBaseline` é **1.1.0** e novos backups passam a registrar **1.1.0**.

As versões técnicas internas permanecem independentes da versão do produto; não são alteradas apenas para “parecerem” iguais à V1.1.0.

## Runtime e PWA

| Identificador | Valor | Função |
| --- | --- | --- |
| Data API | 3.5 | Contrato interno de dados/backups |
| Sync | 3.1 | Runtime de sincronização Supabase |
| PWA | 19.4 | Runtime de instalação/cache |
| Service Worker | 19.4-source | Fonte do worker antes do versionamento por SHA no deploy |
| Offline Pack | 19.4-production | Contrato do manifesto offline |
| Automação | 1.1 | Motor read-only de sugestões e prioridades do Hoje |

PWA, Service Worker e Offline Pack formam um grupo coordenado. Mudança incompatível em cache/offline deve atualizar esse grupo de forma consciente.

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

A representação estruturada deste documento é:

`data/version-contract.json`

O CI executa `scripts/validate_versions.py` e bloqueia divergências entre o contrato e os runtimes.

## Regra para release

Na preparação da V1.1.0:

1. gate funcional: **concluído**;
2. checklist manual 80% / 125% / 150%: **concluído**;
3. versão de produto atualizada de forma coordenada para **1.1.0** na branch final;
4. rodar novamente todos os validadores e a regressão final;
5. congelar o commit aprovado;
6. promover esse commit para `main`;
7. validar o deploy real;
8. somente então criar tag/release `v1.1.0`.
