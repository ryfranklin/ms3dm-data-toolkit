"""
Shared pytest fixtures and import-path setup.

The backend isn't a proper installable package, so tests need the backend/
directory on sys.path before importing `services.*` / `api.*`.
"""

import sys
from pathlib import Path

# Add backend/ (parent of tests/) to the path.
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
