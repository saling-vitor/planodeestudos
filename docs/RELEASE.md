# Plano ARQ · Release V1.2.0

Documento canônico da versão publicada **1.2.0**.

## Estado final

- Release: `1.2.0`.
- SHA publicado: `5985e4a53604b00c221112b9ad09d6ca82e6128e`.
- Branch congelada: `release/v1.2.0`.
- Tag/GitHub Release: `v1.2.0`.
- `main`, branch de release e tag apontam para o mesmo SHA.
- Functional freeze: `84afc81faf45af6d67ee9e3441d5f1204734bccd`.
- RC aprovado: `1.2.0-rc.1`.
- QA manual Chrome 80%, 125% e 150%: **aprovado**.
- `BUILD_MAINTENANCE=false`.
- `MAINTENANCE_MODE=false`.

## Gates concluídos

- Gate V1.2 RC #3: **success**;
- Gate V1.2 Release #5: **success**;
- Publicar Plano ARQ #606: **success**;
- auditoria visual no deploy real: **success**;
- fluxo operacional de concurso novo no deploy real: **success**;
- PWA antes/depois do deploy: **success**.

## Reconciliação de produção

Durante a preparação final houve um hotfix emergencial de navegação no `main`. O estado final V1.2 preservou esse histórico, removeu a publicação estática temporária do estado canônico e restaurou o workflow oficial de Pages com geração/validação integral do pacote.

## Regra de imutabilidade

A V1.2.0 está encerrada. Não alterar:

- `release/v1.2.0`;
- tag `v1.2.0`;
- histórico do GitHub Release.

Trabalho posterior parte de `develop/v1.3`.
