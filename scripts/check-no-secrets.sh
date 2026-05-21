#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/pretty-print.sh
source "$SCRIPT_DIR/lib/pretty-print.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

pp_banner "Secret guard"

python3 - <<'PY'
from __future__ import annotations
import re
import sys
from pathlib import Path

root = Path('.')
include_suffixes = {'.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.sh'}
include_names = {'package.json', 'package-lock.json'}
skip_dirs = {'.git', 'node_modules', '.agent', '.pi', 'coverage', 'dist', 'build'}
patterns = [
    ('OpenAI-style secret key', re.compile(r'\bsk-[A-Za-z0-9_-]{20,}\b')),
    ('private key block', re.compile(r'-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----')),
    ('raw refresh token field', re.compile(r'"refresh_token"\s*:', re.IGNORECASE)),
    ('raw access token field', re.compile(r'"access_token"\s*:', re.IGNORECASE)),
    ('Codex auth file path in code', re.compile(r'\.codex/auth\.json')),
]
violations: list[str] = []
for path in root.rglob('*'):
    if not path.is_file():
        continue
    if path.as_posix() == 'scripts/check-no-secrets.sh':
        continue
    parts = set(path.parts)
    if parts & skip_dirs:
        continue
    if path.name not in include_names and path.suffix not in include_suffixes:
        continue
    try:
        text = path.read_text('utf-8')
    except UnicodeDecodeError:
        continue
    for label, pattern in patterns:
        for match in pattern.finditer(text):
            line_no = text.count('\n', 0, match.start()) + 1
            violations.append(f'{path}:{line_no}: {label}')

if violations:
    print('Potential secrets or forbidden credential references found:', file=sys.stderr)
    for violation in violations:
        print(f'  {violation}', file=sys.stderr)
    sys.exit(1)
PY

pp_success "Secret guard passed."
