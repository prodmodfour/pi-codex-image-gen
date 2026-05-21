#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/pretty-print.sh
source "$SCRIPT_DIR/lib/pretty-print.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

pp_banner "Generated/private-file guard"

python3 - <<'PY'
from __future__ import annotations
import sys
from pathlib import Path

root = Path('.')
forbidden_exact = {
    '.env',
    '.npmrc',
}
forbidden_prefixes = {
    'node_modules/',
    '.agent/',
    '.pi/',
    '.codex/',
    'generated-images/',
    'coverage/',
    'dist/',
    'build/',
    '.tmp/',
    'tmp/',
}
forbidden_suffixes = {
    '.tgz',
    '.log',
    '.pem',
    '.p12',
    '.pfx',
    '.key',
    '.generated.png',
    '.generated.jpg',
    '.generated.jpeg',
    '.generated.webp',
}
forbidden_names = {
    'auth.json',
    'credentials.json',
    'credential.json',
    'access-token.json',
    'refresh-token.json',
    'id_rsa',
    'id_dsa',
    'id_ecdsa',
    'id_ed25519',
}
image_suffixes = {'.png', '.jpg', '.jpeg', '.webp'}
allowed_image_prefixes = {'docs/', 'test/fixtures/'}
violations: list[str] = []

for path in root.rglob('*'):
    if not path.is_file():
        continue
    posix = path.as_posix()
    if posix.startswith('./'):
        posix = posix[2:]
    if posix.startswith('.git/'):
        continue

    lower_name = path.name.lower()
    lower_posix = posix.lower()
    if posix in forbidden_exact:
        violations.append(posix)
        continue
    if any(posix == prefix.rstrip('/') or posix.startswith(prefix) for prefix in forbidden_prefixes):
        violations.append(posix)
        continue
    if '/generated-images/' in f'/{posix}/':
        violations.append(posix)
        continue
    if lower_name in forbidden_names:
        violations.append(posix)
        continue
    if any(lower_posix.endswith(suffix) for suffix in forbidden_suffixes):
        violations.append(posix)
        continue
    if path.suffix.lower() in image_suffixes and not any(posix.startswith(prefix) for prefix in allowed_image_prefixes):
        violations.append(posix)

if violations:
    print('Generated/private files are present and must not be committed:', file=sys.stderr)
    for item in sorted(set(violations)):
        print(f'  {item}', file=sys.stderr)
    sys.exit(1)
PY

pp_success "Generated/private-file guard passed."
