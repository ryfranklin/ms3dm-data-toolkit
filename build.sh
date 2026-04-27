#!/usr/bin/env bash
# MS3DM Toolkit — local dev build (macOS / Linux)
#
# Useful for verifying the PyInstaller spec works before pushing to CI.
# Produces a non-Windows binary that won't run on user machines — use
# build.ps1 (or push a tag to fire .github/workflows/release.yml) for the
# real Windows build.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

SKIP_FRONTEND="${SKIP_FRONTEND:-0}"
SKIP_INSTALL="${SKIP_INSTALL:-0}"

echo "==> Repo root: $REPO_ROOT"

if [[ "$SKIP_FRONTEND" != "1" ]]; then
    echo "==> Building frontend..."
    pushd frontend >/dev/null
    [[ "$SKIP_INSTALL" == "1" ]] || npm install
    npm run build
    popd >/dev/null
fi

[[ -f frontend/dist/index.html ]] || {
    echo "Frontend build missing — expected frontend/dist/index.html" >&2
    exit 1
}

echo "==> Setting up Python virtualenv..."
pushd backend >/dev/null
if [[ ! -d .venv ]]; then
    python3 -m venv .venv
fi
# shellcheck source=/dev/null
source .venv/bin/activate

if [[ "$SKIP_INSTALL" != "1" ]]; then
    python -m pip install --upgrade pip
    python -m pip install -r requirements.txt
    python -m pip install pyinstaller==6.6.0
fi

echo "==> Running PyInstaller..."
rm -rf build dist
pyinstaller ms3dm_toolkit.spec --clean --noconfirm
deactivate
popd >/dev/null

[[ -d backend/dist/ms3dm-toolkit ]] || {
    echo "PyInstaller didn't produce backend/dist/ms3dm-toolkit/" >&2
    exit 1
}

echo "==> Packaging zip..."
mkdir -p dist
ZIP_NAME="ms3dm-toolkit-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m).zip"
ZIP_PATH="$REPO_ROOT/dist/$ZIP_NAME"
rm -f "$ZIP_PATH"
(cd backend/dist/ms3dm-toolkit && zip -rq "$ZIP_PATH" .)

ZIP_MB=$(du -m "$ZIP_PATH" | cut -f1)
echo
echo "==> Done."
echo "    Output: $ZIP_PATH (${ZIP_MB} MB)"
echo "    Note: this binary runs on $(uname -s), not Windows."
