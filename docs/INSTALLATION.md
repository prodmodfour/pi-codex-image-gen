# Installation

This document should be completed during ticket 006 after the package is implemented.

## Local development load

```bash
git clone <repo-url> pi-codex-image-gen
cd pi-codex-image-gen
npm install
bash scripts/quality-gate.sh
pi -e .
```

## Project-local install

```bash
pi install -l /absolute/path/to/pi-codex-image-gen
pi
```

## Git install

```bash
pi install -l git:github.com/<owner>/pi-codex-image-gen@<tag-or-commit>
```

## Optional configuration

After loading/installing the package, configure defaults with JSON files or environment variables. Config files are not credential files and must not contain tokens.

Global config:

```bash
mkdir -p ~/.pi/agent/extensions
cat > ~/.pi/agent/extensions/codex-image-gen.json <<'JSON'
{
  "model": "gpt-5.5",
  "saveMode": "global"
}
JSON
```

Project config:

```bash
mkdir -p .pi/extensions
cat > .pi/extensions/codex-image-gen.json <<'JSON'
{
  "saveMode": "project"
}
JSON
```

Environment overrides take highest precedence for a process:

```bash
PI_CODEX_IMAGE_SAVE_MODE=none pi -e .
```

Supported environment variables: `PI_CODEX_IMAGE_MODEL`, `PI_CODEX_IMAGE_SAVE_MODE`, and `PI_CODEX_IMAGE_SAVE_DIR`.

## npm install caveat

The requested unscoped package name may already be publicly owned. Use the final release docs for the correct npm command, scoped package, private registry, or git/local install path.
