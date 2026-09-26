# Plano ARQ · Release Gate

Documento canônico para a transição da release candidate atual para a primeira versão de produção.

## Estado atual

- Release candidate: `1.0.0-rc`.
- Branch de produção: `main`.
- Manutenção de build: **ativa**.
- Runtime local: `BUILD_MAINTENANCE=true`.
- Service Worker: `MAINTENANCE_MODE=true`.
- Dados locais permanecem ativos; serviços externos e PWA/offline ficam pausados durante a manutenção.
- Nenhuma tag ou release `v1.0.0` deve ser criada antes do deploy final aprovado.

## Gate obrigatório para V1.0.0

A liberação deve ser feita como uma alteração coordenada no mesmo commit:

1. alterar o identificador canônico de release de `1.0.0-rc` para `1.0.0`;
2. alinhar `data/cloud-config.json` para `1.0.0`;
3. definir `BUILD_MAINTENANCE=false` no runtime;
4. definir `MAINTENANCE_MODE=false` no Service Worker;
5. atualizar README e `docs/NUVEM.md` para estado de produção;
6. executar todos os geradores e validadores estáticos;
7. publicar no GitHub Pages;
8. exigir sucesso da auditoria visual/funcional em desktop, iPad e celular;
9. exigir sucesso do fluxo operacional de novo concurso;
10. exigir sucesso do smoke test PWA no deploy real, já fora da manutenção;
11. somente depois do deploy aprovado, criar a tag e release `v1.0.0`.

## Critérios de bloqueio

Não liberar a V1.0.0 se ocorrer qualquer um destes casos:

- divergência entre release do runtime e `data/cloud-config.json`;
- divergência entre `BUILD_MAINTENANCE` e `MAINTENANCE_MODE`;
- falha em CSS, JavaScript, PWA/cache ou validação estrutural;
- falha na auditoria responsiva/funcional;
- falha no fluxo de criação de concurso;
- falha no PWA do deploy real;
- existência de arquivos temporários, backups ou resíduos de desenvolvimento rastreados no repositório.

A tag `v1.0.0` representa o estado já publicado e validado, nunca um commit ainda aguardando testes.
