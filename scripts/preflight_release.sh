#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

say(){ printf '\n==> %s\n' "$1"; }

say "Auditoria estrutural da fonte"
python3 scripts/validate_production.py

say "Sincronizar versão PWA"
python3 scripts/sync_pwa_version.py

say "Gerar dados de produção"
python3 scripts/build_static_data.py
python3 scripts/build_materials_manifest.py
python3 scripts/build_topic_catalogs.py
python3 scripts/build_simulations_manifest.py
python3 scripts/build_files_manifest.py
python3 scripts/build_offline_pack.py

say "Importador OBJ-10 · suíte completa"
node scripts/test_edict_document_map.mjs
node scripts/test_edict_cargos_groups.mjs
node scripts/test_edict_objective_locator.mjs
node scripts/test_edict_objective_table.mjs
node scripts/test_edict_program_content.mjs
node scripts/test_edict_objective_rules.mjs
node scripts/test_edict_evidence_conflicts.mjs
node scripts/test_edict_review_screen.mjs
node scripts/test_edict_exam_schema_integration.mjs
node scripts/test_edict_regressions.mjs

say "Contrato gráfico"
python3 scripts/validate_layout_contract.py

say "CSS"
python3 scripts/validate_css.py

say "JavaScript"
python3 scripts/validate_javascript.py

say "OBJ-01 a OBJ-09 · repetição individual"
node scripts/test_edict_document_map.mjs
node scripts/test_edict_cargos_groups.mjs
node scripts/test_edict_objective_locator.mjs
node scripts/test_edict_objective_table.mjs
node scripts/test_edict_program_content.mjs
node scripts/test_edict_objective_rules.mjs
node scripts/test_edict_evidence_conflicts.mjs
node scripts/test_edict_review_screen.mjs
node scripts/test_edict_exam_schema_integration.mjs

say "PWA / cache"
python3 scripts/validate_pwa_cache.py

say "Produção strict"
python3 scripts/validate_production.py --strict

say "Automações AUT-01 / AUT-02 / AUT-03 / AUT-04"
python3 -c 'import selenium' >/dev/null
python3 -m http.server 8765 --bind 127.0.0.1 >/tmp/plano-arq-preflight-http.log 2>&1 &
server_pid=$!
cleanup(){ kill "$server_pid" 2>/dev/null || true; }
trap cleanup EXIT
sleep 1
python3 scripts/runtime_automation_v11.py http://127.0.0.1:8765/
python3 scripts/runtime_replan_v01.py http://127.0.0.1:8765/
python3 scripts/runtime_post_sim_v01.py http://127.0.0.1:8765/
python3 scripts/runtime_health_v01.py http://127.0.0.1:8765/

say "PREFLIGHT OK"
