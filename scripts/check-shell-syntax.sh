#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/pretty-print.sh
source "$SCRIPT_DIR/lib/pretty-print.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

pp_banner "Shell syntax check"

mapfile -t shell_files < <(find . \
  -path './.git' -prune -o \
  -path './node_modules' -prune -o \
  -path './.agent/logs' -prune -o \
  -type f -name '*.sh' -print | sort)

if (( ${#shell_files[@]} == 0 )); then
  pp_info "No shell files found."
  exit 0
fi

for file in "${shell_files[@]}"; do
  pp_cmd "bash -n $file"
  bash -n "$file"
done

pp_success "Shell syntax passed."
