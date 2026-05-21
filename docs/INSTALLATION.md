# Installation

This guide covers loading and installing `pi-codex-image-gen` for local single-user Pi sessions.

The package is distributed as TypeScript source. Pi loads the extension directly; there is no required build artifact. Development checks still require Node.js and npm.

## Prerequisites

* Node.js 20 or newer.
* npm.
* Pi installed (`pi --version`).
* For live image generation: a Pi `/login` session for the ChatGPT/Codex provider (`openai-codex`).

Do not inspect, copy, or paste Codex credential files or tokens while installing this package.

## Verify a checkout

From the package root:

```bash
npm ci
bash scripts/quality-gate.sh
```

The quality gate is non-live. It runs shell checks, secret/private-file guards, TypeScript typechecking, unit/fake integration tests, build validation, and npm package dry-run validation. It must pass without Pi/Codex credentials.

## Temporary one-session load

Use this for development or manual validation without changing Pi settings:

```bash
cd /absolute/path/to/pi-codex-image-gen
pi -e .
```

`-e`/`--extension` loads the package for the current Pi run only. It does not permanently install the package. In the Pi session, run:

```text
/codex-image-gen
```

if the command API is available, then explicitly ask Pi to use `codex_generate_image`.

## Project-local install

Use this when a specific project should load the package automatically:

```bash
cd /path/to/your/project
pi install -l /absolute/path/to/pi-codex-image-gen
pi
```

The `-l` flag writes the package source to the project Pi settings (`.pi/settings.json`). Project settings may be shared with a team, so review the package source and make sure generated images and local `.pi/` runtime state remain uncommitted.

Remove the project-local install with the same source string:

```bash
pi remove -l /absolute/path/to/pi-codex-image-gen
```

## User-global local-path install

If you want the package in all Pi sessions for the current user, omit `-l`:

```bash
pi install /absolute/path/to/pi-codex-image-gen
```

This writes to user Pi settings under the active Pi agent directory. Remove it with:

```bash
pi remove /absolute/path/to/pi-codex-image-gen
```

## Git install

Once a trusted remote exists, install a pinned ref:

```bash
pi install -l git:github.com/<owner>/pi-codex-image-gen@<tag-or-commit>
```

For global user install, omit `-l`:

```bash
pi install git:github.com/<owner>/pi-codex-image-gen@<tag-or-commit>
```

Pinning a tag or commit keeps the installed package auditable and avoids surprise backend-contract changes.

## npm-style install

The requested unscoped package name is `pi-codex-image-gen`, but that public name may already be owned by another maintainer. Do not publish or install by unscoped name unless ownership and provenance are confirmed.

If the unscoped name is legitimately published by this project:

```bash
pi install npm:pi-codex-image-gen@<version>
```

If released under a scope or private registry:

```bash
pi install npm:@<scope>/pi-codex-image-gen@<version>
```

See [RELEASE.md](RELEASE.md) for publishing caveats and package dry-run requirements.

## Authentication setup

This package does not perform login itself. It asks Pi for the in-memory `openai-codex` provider credential at tool-call time.

In interactive Pi:

```text
/login
```

Choose the ChatGPT/Codex provider. If image generation later fails with missing auth, expired auth, missing account metadata, or HTTP 401/403, re-run `/login` and select the correct account/workspace.

The default tool path does not read or use `OPENAI_API_KEY`.

## Optional configuration

Configuration files set defaults only. They must not contain credentials or tokens.

Global config, using Pi's default agent directory:

```bash
mkdir -p ~/.pi/agent/extensions
cat > ~/.pi/agent/extensions/codex-image-gen.json <<'JSON'
{
  "model": "gpt-5.5",
  "saveMode": "global"
}
JSON
```

If Pi is running with a different agent directory (for example through `PI_CODING_AGENT_DIR`), the global config path follows that agent directory.

Project config:

```bash
mkdir -p .pi/extensions
cat > .pi/extensions/codex-image-gen.json <<'JSON'
{
  "saveMode": "project"
}
JSON
```

Environment overrides for one process:

```bash
PI_CODEX_IMAGE_SAVE_MODE=none pi -e /absolute/path/to/pi-codex-image-gen
```

Supported environment variables:

| Variable | Purpose |
| --- | --- |
| `PI_CODEX_IMAGE_MODEL` | Default Codex routing model |
| `PI_CODEX_IMAGE_SAVE_MODE` | Default save mode: `none`, `project`, `global`, or `custom` |
| `PI_CODEX_IMAGE_SAVE_DIR` | Default custom save directory |

Precedence is built-in defaults, global config, project config, then environment overrides.

## Confirming load success

A successful load registers:

* the tool `codex_generate_image`;
* the skill `imagegen`;
* the optional command `/codex-image-gen` when the Pi runtime supports command registration.

If `/codex-image-gen` is not present but the tool is available, command registration may be unavailable in that Pi runtime. If the tool is absent, run `/reload`, confirm the package path, and check sanitized Pi extension startup errors.
