#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

FILES = [
    ("contests.json", "contests.js", "PLANO_ARQ_CONTESTS", False),
    ("navigation.json", "navigation.js", "PLANO_ARQ_NAVIGATION", True),
    ("exam-schemas.json", "exam-schemas.js", "PLANO_ARQ_EXAM_SCHEMAS", False),
    ("cloud-config.json", "cloud-config.js", "PLANO_ARQ_CLOUD", True),
]

for source_name, output_name, variable, compact in FILES:
    source = DATA / source_name
    if not source.is_file():
        raise SystemExit(f"Fonte estática ausente: {source.relative_to(ROOT)}")

    payload = json.loads(source.read_text("utf-8"))
    kwargs = {"ensure_ascii": False}
    if compact:
        kwargs["separators"] = (",", ":")

    (DATA / output_name).write_text(
        f"window.{variable}=" + json.dumps(payload, **kwargs) + ";\n",
        encoding="utf-8",
    )

print(f"{len(FILES)} módulos JS estáticos gerados a partir dos JSON.")
