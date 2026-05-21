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
text_suffixes = {'.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.sh', '.md', '.yml', '.yaml'}
text_names = {'package.json', 'package-lock.json'}
code_suffixes = {'.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.sh'}
skip_dirs = {'.git', 'node_modules', '.agent', '.pi', '.codex', 'coverage', 'dist', 'build'}
skip_files = {
    'scripts/check-no-secrets.sh',
}
secret_patterns = [
    ('OpenAI-style secret key', re.compile(r'\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b')),
    ('Anthropic-style secret key', re.compile(r'\bsk-ant-[A-Za-z0-9_-]{20,}\b')),
    ('GitHub token', re.compile(r'\bgh[pousr]_[A-Za-z0-9_]{30,}\b')),
    ('npm token', re.compile(r'\bnpm_[A-Za-z0-9]{30,}\b')),
    ('private key block', re.compile(r'-----BEGIN (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----')),
]
code_only_patterns = [
    ('raw refresh token field', re.compile(r'"refresh_token"\s*:', re.IGNORECASE)),
    ('raw access token field', re.compile(r'"access_token"\s*:', re.IGNORECASE)),
    ('raw id token field', re.compile(r'"id_token"\s*:', re.IGNORECASE)),
    ('Codex auth file path in runtime code', re.compile(r'\.codex/auth\.json')),
    ('default OpenAI API-key environment use', re.compile(r'\bOPENAI_API_KEY\b|process\.env\[["\']OPENAI_API_KEY["\']\]|process\.env\.OPENAI_API_KEY')),
]
violations: list[str] = []
for path in root.rglob('*'):
    if not path.is_file():
        continue
    posix = path.as_posix()
    if posix in skip_files:
        continue
    parts = set(path.parts)
    if parts & skip_dirs:
        continue
    if path.name not in text_names and path.suffix not in text_suffixes:
        continue
    try:
        text = path.read_text('utf-8')
    except UnicodeDecodeError:
        continue

    patterns = list(secret_patterns)
    if path.suffix in code_suffixes or path.name in text_names:
        patterns.extend(code_only_patterns)

    for label, pattern in patterns:
        for match in pattern.finditer(text):
            line_no = text.count('\n', 0, match.start()) + 1
            violations.append(f'{path}:{line_no}: {label}')

if violations:
    print('Potential secrets, credential file access, or forbidden API-key defaults found:', file=sys.stderr)
    for violation in violations:
        print(f'  {violation}', file=sys.stderr)
    sys.exit(1)
PY

pp_success "Secret guard passed."
