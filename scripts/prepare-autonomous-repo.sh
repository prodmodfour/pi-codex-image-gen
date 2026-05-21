#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=scripts/lib/pretty-print.sh
source "$SCRIPT_DIR/lib/pretty-print.sh"
cd "$REPO_ROOT"

pp_banner "Prepare autonomous repo"

if ! command -v git >/dev/null 2>&1; then
  pp_error "git is required. Install git and rerun."
  exit 127
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  pp_cmd "git init"
  git init
fi

if [[ -z "$(git config user.email || true)" ]]; then
  pp_warn "git user.email is not configured. Setting a local placeholder."
  git config user.email "autonomous-build@example.local"
fi

if [[ -z "$(git config user.name || true)" ]]; then
  pp_warn "git user.name is not configured. Setting a local placeholder."
  git config user.name "Autonomous Build Agent"
fi

chmod +x scripts/*.sh scripts/*.mjs scripts/lib/*.sh

if [[ -n "$(git status --porcelain)" ]]; then
  pp_cmd "git add ."
  git add .
  pp_cmd "git commit -m 'chore: initialise pi-codex-image-gen autonomous build'"
  git commit -m 'chore: initialise pi-codex-image-gen autonomous build'
else
  pp_info "Working tree already clean; no initial commit needed."
fi

pp_success "Repository is ready. Run scripts/build-loop.sh --create-branch feature/autonomous-build --max-cycles 40"
