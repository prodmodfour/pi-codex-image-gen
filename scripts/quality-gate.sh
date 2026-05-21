#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=scripts/lib/pretty-print.sh
source "$SCRIPT_DIR/lib/pretty-print.sh"

cd "$REPO_ROOT"

have() { command -v "$1" >/dev/null 2>&1; }
run_cmd() { pp_cmd "$*"; "$@"; }
warn() { pp_warn "$*"; }

NODE_MODULES_CREATED_BY_GATE=0

cleanup_node_modules() {
  if (( NODE_MODULES_CREATED_BY_GATE == 1 )) && [[ -e node_modules || -L node_modules ]]; then
    pp_info "Removing node_modules created by the quality gate."
    rm -rf node_modules
  fi
  NODE_MODULES_CREATED_BY_GATE=0
}

on_exit() {
  local status=$?
  if (( NODE_MODULES_CREATED_BY_GATE == 1 )); then
    cleanup_node_modules || status=$?
  fi
  exit "$status"
}
trap on_exit EXIT

npm_script_exists() {
  local script_name="$1"
  node --input-type=module -e '
    import { readFileSync } from "node:fs";
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const scripts = packageJson.scripts ?? {};
    process.exit(Object.prototype.hasOwnProperty.call(scripts, process.argv[1]) ? 0 : 1);
  ' "$script_name"
}

pp_banner "Quality gate"

pp_section "Shell syntax checks"
run_cmd bash scripts/check-shell-syntax.sh

pp_section "Secret guardrail"
run_cmd bash scripts/check-no-secrets.sh

pp_section "Generated/private-file guardrail"
run_cmd bash scripts/check-no-generated-private-files.sh

if [[ -f package.json ]]; then
  pp_section "Node project"
  if have npm; then
    if [[ ! -e node_modules && ! -L node_modules ]]; then
      NODE_MODULES_CREATED_BY_GATE=1
    fi

    if [[ -f package-lock.json ]]; then
      run_cmd npm ci
    else
      run_cmd npm install
    fi

    run_cmd npm run lint --if-present
    run_cmd npm run typecheck --if-present
    run_cmd npm test --if-present
    run_cmd npm run build --if-present

    if npm_script_exists "pack:check"; then
      run_cmd npm run pack:check
    else
      pp_info "No pack:check script detected; skipping package dry-run."
    fi

    pp_section "Cleanup"
    cleanup_node_modules
  else
    warn "npm not installed; skipping Node checks"
  fi
else
  pp_info "No package.json found; skipping Node checks."
fi

pp_section "Post-check generated/private-file guardrail"
run_cmd bash scripts/check-no-generated-private-files.sh

pp_section "Summary"
pp_success "Quality gate passed."
