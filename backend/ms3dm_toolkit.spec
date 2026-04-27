# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for the bundled desktop build.

Produces a folder distribution at `backend/dist/ms3dm-toolkit/` containing
`ms3dm-toolkit.exe` plus all dependencies. The built React app is bundled
in `static/` and Flask serves it on the same port as the API.

Build:
    pyinstaller ms3dm_toolkit.spec --clean --noconfirm
"""
from pathlib import Path

block_cipher = None

# `SPECPATH` is set by PyInstaller to the directory containing this spec.
project_root = Path(SPECPATH).parent           # repo root
backend_dir = Path(SPECPATH)                   # ./backend
frontend_dist = project_root / 'frontend' / 'dist'

if not frontend_dist.is_dir():
    raise SystemExit(
        f"Frontend bundle not found at {frontend_dist}. "
        "Run `npm run build` in the frontend/ directory first "
        "(the build.ps1 / build.sh wrapper does this for you)."
    )


a = Analysis(
    [str(backend_dir / 'app.py')],
    pathex=[str(backend_dir)],
    binaries=[],
    # The bundled frontend is shipped under `static/` so app.py's
    # `_resource_root() / 'static'` finds it at runtime.
    datas=[
        (str(frontend_dist), 'static'),
    ],
    hiddenimports=[
        # Runtime deps PyInstaller can miss because they're imported via strings
        'pyodbc',
        'duckdb',
        'flask',
        'flask_cors',
        'werkzeug',
        'jinja2',
        'dotenv',
        # Blueprints — imported by name in app.py via `from api.X import Y`
        'api.config',
        'api.quality',
        'api.docs',
        'api.expectations',
        'api.scheduler',
        'api.catalog',
        'api.storage',
        'api.dbt',
        'api.local_etl',
        'api.setup',
        # Services
        'services.metadata_store',
        'services.app_config',
        'services.db_connector',
        'services.duckdb_query',
        'services.quality_checker',
        'services.expectation_engine',
        'services.dbt_manager',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Trim the bundle — desktop app doesn't need these
        'tkinter',
        'matplotlib',
        'IPython',
        'jupyter',
        'notebook',
        'pytest',
        'sphinx',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='ms3dm-toolkit',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,           # keep console window so users see startup logs
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='ms3dm-toolkit',
)
