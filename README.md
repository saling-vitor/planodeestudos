# Plano ARQ

Portal estático de estudos para concursos, publicado por GitHub Pages e preparado para PWA/offline.

## Produção

- URL: `https://saling-vitor.github.io/planodeestudos/`
- Branch: `main`
- Deploy: `.github/workflows/pages.yml`
- Release candidate atual: `1.0.0-rc`
- 14 mapas em `materials/`
- 3 simulados em `simulados/`
- edital/documentos oficiais em `edital/`

O workflow gera os dados derivados e só publica depois de validar estrutura, contrato gráfico, CSS, JavaScript, referências e pacote PWA.

**Estado atual pré-V1.0.0:** manutenção de build ativa. Os dados locais continuam funcionando normalmente, enquanto Supabase, Google Drive automático, Service Worker, pacote offline e automações em segundo plano permanecem pausados. A liberação exige alterar em conjunto o runtime local e o Service Worker no mesmo deploy validado.

## Arquitetura visual canônica

O Portal usa uma única camada compartilhada. Páginas individuais não devem criar versões próprias de sidebar, hero, topbar ou controles.

- `assets/css/pa-tokens-v01.css` — única fonte de cores, tipografia e tokens.
- `assets/css/pa-shell-v16.css` — shell canônico: sidebar, topbar, largura do conteúdo, heroes, métricas, navegação mobile e breakpoints.
- `assets/css/pa-components-v01.css` — componentes canônicos: botões, campos, filtros, tabs, painéis, listas, tabelas e estados vazios.
- `assets/js/pa-shell-v16.js` — única fonte da navegação lateral, drawer, identificação do concurso, menu comum e navegação mobile.

Os nomes dos arquivos permanecem estáveis por compatibilidade de cache/referências, mas o conteúdo interno é canônico e não contém camadas históricas Vxx.

### Regras

- Toda página interna usa uma `<aside class="pa-sidebar"></aside>` vazia; o shell gera o menu.
- CSS específico da página vem primeiro; depois `tokens → shell → components`.
- CSS local contém somente componentes exclusivos do módulo.
- Heroes seguem apenas três famílias: 3 métricas diretas, 4 métricas diretas ou bloco 2×2.
- O breakpoint principal de tablet/iPad é 900px.
- O CI bloqueia sidebars hardcoded, cascata invertida, paletas locais e camadas históricas.

## Dados e build

- `data/*.json` — fontes estáticas canônicas.
- `data/*.js` e catálogos grandes — gerados no deploy.
- `materials/` — conteúdo específico dos mapas; runtime/visual comum ficam em `assets/`. Metadados de geração que não participam do runtime/build são removidos da fonte final.
- `scripts/` — geradores e validadores de produção.
- `cloud/` e `docs/` — manutenção; não são publicados no Pages.

## PWA e cache

- `pwa-diagnostico.html` é um probe técnico publicado exclusivamente para a validação automatizada do PWA no CI; não é uma página de navegação do usuário e não deve ser removido enquanto `runtime_pwa_smoke.py` depender dele.
- HTML, CSS, JavaScript, dados, mapas, simulados e edital usam **network first** quando há rede.
- O cache funciona como fallback quando a rede falha.
- Imagens locais usam atualização em segundo plano; imagens externas imutáveis podem usar cache.
- Cada deploy versiona os caches de shell/runtime pelo SHA.
- O Service Worker ativa a versão nova imediatamente, remove caches antigos e recarrega uma sessão já controlada quando o controller muda.
- O pacote offline do usuário é preservado entre deploys e só é substituído depois de um novo download completo.
- O registro do Service Worker usa `updateViaCache: none` e verifica atualização novamente ao retomar o app.

## Segurança

Credenciais pessoais de Supabase/Google Drive não ficam gravadas no repositório. O preflight procura padrões de chaves antes da publicação.

## Desenvolvimento local

```bash
python scripts/build_static_data.py
python scripts/build_materials_manifest.py
python scripts/build_topic_catalogs.py
python scripts/build_simulations_manifest.py
python scripts/build_files_manifest.py
python scripts/build_offline_pack.py
python scripts/validate_layout_contract.py
python scripts/validate_css.py
python scripts/validate_javascript.py
python scripts/validate_pwa_cache.py
python scripts/validate_production.py --strict
python -m http.server 8080
```

Abra `http://localhost:8080/`.
