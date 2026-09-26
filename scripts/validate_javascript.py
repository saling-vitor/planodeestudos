#!/usr/bin/env python3
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
import shutil
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


class ScriptParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.scripts = []
        self._capture = False
        self._skip = False
        self._buf = []
        self._line = 0

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "script":
            return
        a = {k.lower(): (v or "") for k, v in attrs}
        if a.get("src"):
            self._capture = False
            return
        typ = a.get("type", "").strip().lower()
        self._skip = typ in {
            "application/json",
            "application/ld+json",
            "importmap",
            "speculationrules",
        }
        self._capture = True
        self._buf = []
        self._line = self.getpos()[0]

    def handle_data(self, data):
        if self._capture:
            self._buf.append(data)

    def handle_endtag(self, tag):
        if tag.lower() != "script" or not self._capture:
            return
        if not self._skip:
            code = "".join(self._buf)
            if code.strip():
                self.scripts.append((self._line, code))
        self._capture = False
        self._skip = False
        self._buf = []


def check_node(path: Path, label: str):
    result = subprocess.run(
        ["node", "--check", str(path)],
        text=True,
        capture_output=True,
    )
    if result.returncode:
        detail = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(f"{label}:\n{detail}")


def check_invalid_dataset_notation(text: str, label: str):
    for match in re.finditer(r"dataset\.[A-Za-z_$][A-Za-z0-9_$]*-", text):
        line = text.count("\n", 0, match.start()) + 1
        snippet = text[match.start():match.start()+48].split("\n",1)[0]
        raise RuntimeError(
            f"{label}: acesso dataset inválido na linha {line}: {snippet!r}; "
            "use dataset.camelCase ou dataset['nome-com-hifen']"
        )


def main():
    if not shutil.which("node"):
        raise SystemExit("Node.js não encontrado; validação JavaScript indisponível.")

    checked_external = 0
    checked_inline = 0

    js_files = [ROOT / "service-worker.js"]
    js_files += sorted((ROOT / "assets" / "js").glob("*.js"))
    js_files += sorted((ROOT / "data").glob("*.js"))

    for path in js_files:
        text = path.read_text("utf-8", errors="replace")
        check_invalid_dataset_notation(text, str(path.relative_to(ROOT)))
        if path.name == "study-map-preconfig-v01.js" and re.search(r"map-mode|map-focus|focusBranch", text):
            raise RuntimeError("study-map-preconfig-v01.js: runtime legado de map-mode/map-focus detectado")
        if path.name in {"study-map-preconfig-v01.js", "study-map-runtime-v01.js"}:
            observers = len(re.findall(r"\\bnew\\s+MutationObserver\\s*\\(", text))
            budget = 2 if path.name == "study-map-preconfig-v01.js" else 1
            if observers > budget:
                raise RuntimeError(
                    f"{path.name}: {observers} MutationObservers ativos; orçamento V1.1 é {budget}"
                )
            if re.search(r"observe\\(document\\.documentElement,\\s*\\{[^}]*subtree\\s*:\\s*true[^}]*childList\\s*:\\s*true", text):
                raise RuntimeError(f"{path.name}: observer global do documentElement voltou ao runtime")
        if path.name == "study-map-preconfig-v01.js":
            if "PLANO_ARQ_STUDY_STATE_BUS" not in text or "mindmap:study-state-changed" not in text:
                raise RuntimeError("study-map-preconfig-v01.js: barramento único de estado ausente")
            direct = len(re.findall(r"attributeFilter\\s*:\\s*\\[\\s*['\"]data-study-state['\"]\\s*\\]", text))
            if direct != 1:
                raise RuntimeError(
                    f"study-map-preconfig-v01.js: esperado 1 observer de data-study-state; encontrado {direct}"
                )
        if path.name == "study-map-runtime-v01.js":
            if re.search(r"attributeFilter\\s*:\\s*\\[\\s*['\"]data-study-state['\"]\\s*\\]", text):
                raise RuntimeError("study-map-runtime-v01.js: observer paralelo de data-study-state detectado")
        check_node(path, str(path.relative_to(ROOT)))
        checked_external += 1

    html_files = sorted(ROOT.glob("*.html"))
    html_files += sorted((ROOT / "materials").glob("*.html"))
    html_files += sorted((ROOT / "simulados").glob("*.html"))

    with tempfile.TemporaryDirectory(prefix="planoarq-js-") as tmp:
        tmpdir = Path(tmp)
        seq = 0
        for html in html_files:
            html_text = html.read_text("utf-8", errors="replace")
            check_invalid_dataset_notation(html_text, str(html.relative_to(ROOT)))
            parser = ScriptParser()
            parser.feed(html_text)
            for line, code in parser.scripts:
                seq += 1
                temp = tmpdir / f"inline-{seq:04d}.js"
                temp.write_text(code, "utf-8")
                check_node(
                    temp,
                    f"{html.relative_to(ROOT)} · script inline iniciado na linha {line}",
                )
                checked_inline += 1

    print(
        f"JavaScript OK: {checked_external} arquivo(s) externo(s) "
        f"+ {checked_inline} script(s) inline."
    )


if __name__ == "__main__":
    main()
