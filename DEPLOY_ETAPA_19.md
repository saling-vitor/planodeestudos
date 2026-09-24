# ETAPA 19 · Publicação do Plano ARQ

Repositório de produção: `saling-vitor/planodeestudos`

URL esperada:

`https://saling-vitor.github.io/planodeestudos/`

## Upload do pacote

1. Extraia `Plano_ARQ_Etapa_19_GITHUB_PAGES_PRODUCAO_FINAL.zip`.
2. No repositório, use **Add file → Upload files**.
3. Arraste **o conteúdo interno da pasta** `Plano_ARQ_Etapa_19_GITHUB_PAGES_PRODUCAO`, não a pasta externa nem o ZIP.
4. Confirme o commit no branch `main`.

O pacote já contém:

- `.github/workflows/pages.yml`
- `manifest.webmanifest`
- `service-worker.js`
- `offline.html`
- `.nojekyll`
- páginas do Portal
- 14 mapas
- 3 simulados
- edital
- assets e manifestos

## Ativar GitHub Pages

Após o upload:

**Settings → Pages → Build and deployment → Source → GitHub Actions**

O workflow usa as ações oficiais atuais:

- `actions/checkout@v6`
- `actions/configure-pages@v5`
- `actions/upload-pages-artifact@v4`
- `actions/deploy-pages@v4`

## Origens de produção

Supabase / Site URL:

`https://saling-vitor.github.io/planodeestudos/`

Google OAuth / Authorized JavaScript origin:

`https://saling-vitor.github.io`

