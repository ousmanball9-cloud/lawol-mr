"""Vérifie que le Python embarqué dans les workflows compile réellement.

Un YAML valide ne prouve pas que le script qu'il contient s'exécute : une
indentation ou une coquille ne se verrait qu'en production. Ce contrôle est
hors-ligne et rejouable.
"""
from __future__ import annotations

import pathlib
import sys

import yaml

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ok = True
for f in sorted(pathlib.Path(".github/workflows").glob("*.yml")):
    d = yaml.safe_load(f.read_text(encoding="utf-8"))
    for job in (d.get("jobs") or {}).values():
        for step in job.get("steps") or []:
            run = step.get("run") or ""
            if "python3 - <<'PY'" not in run:
                continue
            corps = run.split("python3 - <<'PY'", 1)[1].split("\nPY", 1)[0]
            try:
                compile(corps, f"{f.name}:{step.get('name')}", "exec")
                print(f"  [OK] {f.name} · {step.get('name')}")
            except SyntaxError as exc:
                ok = False
                print(f"  [KO] {f.name} · {step.get('name')} — {exc}")

print("VERDICT :", "OK" if ok else "KO")
sys.exit(0 if ok else 1)
