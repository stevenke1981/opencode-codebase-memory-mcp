#!/usr/bin/env bash
set -euo pipefail

GLOBAL_CONFIG="${HOME}/.config"
INSTALL_DIR="${GLOBAL_CONFIG}/opencode-codebase-memory-mcp"
REPO="https://github.com/stevenke1981/opencode-codebase-memory-mcp.git"
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "opencode-codebase-memory-mcp global installer"
echo "Install dir: ${INSTALL_DIR}"

if [[ ! -d "${INSTALL_DIR}/.git" ]]; then
  if [[ -d "${ROOT}/.git" ]]; then
    echo "Seeding global install dir from current repo..."
    mkdir -p "${INSTALL_DIR}"
    rsync -a --exclude node_modules --exclude .git "${ROOT}/" "${INSTALL_DIR}/"
  else
    echo "Cloning to ${INSTALL_DIR} ..."
    mkdir -p "${GLOBAL_CONFIG}"
    git clone "${REPO}" "${INSTALL_DIR}"
  fi
elif [[ "${ROOT}" != "${INSTALL_DIR}" ]]; then
  echo "Updating ${INSTALL_DIR} ..."
  git -C "${INSTALL_DIR}" pull --ff-only
fi

cd "${INSTALL_DIR}"
node scripts/install-global.mjs "$@"