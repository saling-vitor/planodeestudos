# Plano ARQ · Contrato de versionamento

Este documento separa **versão de produto** de **versões técnicas de compatibilidade**.

## Produto

- Baseline publicada/congelada: **1.0.0**
- Alvo do ciclo atual: **1.1.0**
- Enquanto a V1.1 não for promovida, backups continuam registrando a baseline **1.0.0**.

A promoção da V1.1.0 deverá atualizar o contrato de produto de forma coordenada no gate de release. Não se deve alterar versões técnicas apenas para que “pareçam” iguais à versão do produto.

## Runtime e PWA

| Identificador | Valor | Função |
| --- | --- | --- |
| Data API | 3.5 | Contrato interno de dados/backups |
| Sync | 3.1 | Runtime de sincronização Supabase |
| PWA | 19.4 | Runtime de instalação/cache |
| Service Worker | 19.4-source | Fonte do worker antes do versionamento por SHA no deploy |
| Offline Pack | 19.4-production | Contrato do manifesto offline |

PWA, Service Worker e Offline Pack formam um grupo coordenado. Mudança incompatível em cache/offline deve atualizar esse grupo de forma consciente.

## Mapas de estudo

| Identificador | Situação |
| --- | --- |
| V134.0 | versão canônica do preconfig |
| MINDMAP_V139 | API canônica do runtime adaptativo |
| bridge 1.3 | contrato Portal ↔ mapa |
| MINDMAP_V133 → MINDMAP_V134 | alias obrigatório de compatibilidade |
| MINDMAP_V135 → MINDMAP_V139 | alias obrigatório de compatibilidade |

Os aliases **não são lixo**. Eles permanecem porque arquivos/estados anteriores podem referenciá-los. Só podem ser removidos junto com uma migração explícita e testes que comprovem preservação de progresso.

## Fonte de verdade

A representação estruturada deste documento é:

`data/version-contract.json`

O CI executa `scripts/validate_versions.py` e bloqueia divergências entre o contrato e os runtimes.

## Regra para release

Na preparação da V1.1.0:

1. concluir o gate funcional;
2. concluir o checklist manual obrigatório;
3. atualizar a versão de produto de forma coordenada;
4. rodar novamente todos os validadores;
5. congelar o commit;
6. somente então criar tag/release.
