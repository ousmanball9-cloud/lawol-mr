"""Configuration des chemins pour que `apps.api...` soit importable depuis la racine du repo."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))