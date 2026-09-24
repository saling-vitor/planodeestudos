# Plano ARQ

Portal estático de estudos para concursos de Arquitetura, publicado por GitHub Pages e preparado para PWA/offline.

## Produção

- URL: `https://saling-vitor.github.io/planodeestudos/`
- Branch: `main`
- Deploy: `.github/workflows/pages.yml`
- 14 mapas em `materials/`
- 3 simulados em `simulados/`
- edital/documentos oficiais em `edital/`

O workflow valida a fonte, gera os dados derivados, executa um preflight estrito e só então publica. Se faltar uma parte obrigatória, a versão anterior do Pages é preservada.

## Estrutura limpa

- `assets/` — recursos compartilhados; CSS/JS/imagens comuns dos mapas não são duplicados em cada HTML.
- `data/*.json` — fontes estáticas canônicas.
- `data/*.js` e catálogos grandes — gerados no deploy, não precisam ser mantidos manualmente.
- `materials/` — mapas contendo apenas conteúdo/dados específicos; runtime e visual comum ficam em `assets/`.
- `scripts/` — geradores + preflight estrutural.
- `cloud/` — schema/modelos sem credenciais; não é publicado no Pages.

## Segurança

Credenciais pessoais de Supabase/Google Drive não ficam gravadas no repositório. O preflight também procura padrões de chaves antes da publicação.

## Desenvolvimento local

Antes de servir a pasta, gere os dados derivados:

```bash
python scripts/build_static_data.py
python scripts/build_materials_manifest.py
python scripts/build_topic_catalogs.py
python scripts/build_simulations_manifest.py
python scripts/build_files_manifest.py
python scripts/build_offline_pack.py
python scripts/validate_production.py --strict
python -m http.server 8080
```

Abra `http://localhost:8080/`.
