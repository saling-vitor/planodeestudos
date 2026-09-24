# Plano ARQ

Portal estático de estudos para concursos de Arquitetura, publicado por GitHub Pages e preparado para PWA/offline.

## Produção

- URL: `https://saling-vitor.github.io/planodeestudos/`
- Branch de produção: `main`
- Deploy: `.github/workflows/pages.yml`
- 14 mapas de estudo em `materials/`
- 3 simulados em `simulados/`
- edital oficial em `edital/`

O workflow regenera os manifestos, executa um preflight estrutural e só então publica. O artefato do Pages exclui arquivos de manutenção (`.github/`, `scripts/`, `cloud/`, `docs/`, README e arquivos temporários).

## Estrutura

- `index.html` — Hoje / portal
- `biblioteca.html` — biblioteca de mapas
- `planejamento.html` — planejamento
- `edital.html` — central do edital
- `revisoes.html`, `questoes.html`, `desempenho.html` — ciclo de estudo
- `simulados.html`, `erros.html`, `diagnostico.html`, `historico.html` — acompanhamento
- `configuracoes.html` — dados, nuvem e preferências
- `assets/` — CSS/JavaScript compartilhado
- `data/` — catálogos e manifestos gerados
- `scripts/` — geradores usados no deploy
- `cloud/` — schema/modelos sem credenciais

## Segurança e dados

Não há URL/chave Supabase, credenciais Google nem pasta pessoal do Drive gravadas no código de produção. Essas configurações são fornecidas pelo usuário no próprio Portal.

## Desenvolvimento local

Service Worker e PWA exigem HTTP/HTTPS. Para testar localmente:

```bash
python -m http.server 8080
```

Abra `http://localhost:8080/`.
