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

## npm install caveat

The requested unscoped package name may already be publicly owned. Use the final release docs for the correct npm command, scoped package, private registry, or git/local install path.
