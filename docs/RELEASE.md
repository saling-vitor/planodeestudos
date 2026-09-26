# Plano ARQ · Release V1.0.0

Documento canônico da primeira versão de produção.

## Estado de produção

- Release: `1.0.0`.
- Branch de produção: `main`.
- Runtime local: `BUILD_MAINTENANCE=false`.
- Service Worker: `MAINTENANCE_MODE=false`.
- Modo de operação: local-first.
- Service Worker, cache offline e atualização PWA estão liberados.
- Supabase, Google Drive e automações operam conforme a configuração efetiva de cada dispositivo.

## Gate obrigatório

Toda publicação da V1.0.0 deve satisfazer, no mesmo estado de código:

1. release canônica `1.0.0` no runtime e em `data/cloud-config.json`;
2. `BUILD_MAINTENANCE=false` e `MAINTENANCE_MODE=false`;
3. sucesso de todos os geradores e validadores estáticos;
4. sucesso da auditoria visual/funcional em desktop, iPad e celular;
5. sucesso do fluxo operacional de novo concurso;
6. sucesso do smoke test PWA no deploy real fora da manutenção;
7. ausência de arquivos temporários, backups ou resíduos de desenvolvimento rastreados.

A tag/release `v1.0.0` deve apontar exatamente para o commit já publicado e aprovado por esse gate.
