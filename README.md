# pi-codex-image-gen autonomous build system

This repository is a ready-to-run autonomous build scaffold for a Pi package named `pi-codex-image-gen`.

The intended final package registers a Pi tool named `codex_generate_image` that generates images through the user's existing Pi/OpenAI Codex ChatGPT authentication instead of requiring OpenAI Platform API-key billing.

## What is included

```text
AGENTS.md                 autonomous agent rules and permissions
PROJECT_BRIEF.md          project-specific brief for the build agent
BUILD_TICKETS.md          ordered autonomous work queue
BUILD_NOTES.md            running state, blockers, and validation notes
scripts/build-loop.sh     ticket-driven autonomous build loop
scripts/run-agent.sh      Pi wrapper used by the loop
scripts/quality-gate.sh   non-live project quality gate
package.json              initial Pi package metadata and scripts
extensions/               Pi extension entrypoint skeleton
src/                      initial TypeScript skeleton and local Pi contract
test/                     initial package-shape tests
docs/                     implementation guide, runbooks, and safety docs
skills/imagegen/SKILL.md  initial skill helper
```

## Start the autonomous build

From a fresh checkout or unzipped copy:

```bash
cd pi-codex-image-gen-autonomous-system
bash scripts/prepare-autonomous-repo.sh
bash scripts/build-loop.sh --create-branch feature/autonomous-build --max-cycles 40
```

To keep commits local:

```bash
bash scripts/build-loop.sh --create-branch feature/autonomous-build --max-cycles 40 --no-push
```

The build loop will repeatedly invoke:

```bash
scripts/run-agent.sh "$PROMPT"
```

The default wrapper uses Pi:

```bash
pi --no-session -p @AGENTS.md @PROJECT_BRIEF.md @BUILD_TICKETS.md @BUILD_NOTES.md "$PROMPT"
```

## Local checks

The non-live quality gate does not require Pi or Codex credentials:

```bash
bash scripts/quality-gate.sh
```

The live validation ticket intentionally uses real Pi/Codex auth when available. It may consume Codex/ChatGPT usage and must not commit generated images or logs.

## Important publishing caveat

The requested unscoped package name is `pi-codex-image-gen`. That name appears to already exist publicly. The autonomous build should keep the local package name as requested, but release docs must mention that npm publishing may require package ownership, a scoped package name, or a private registry.

## Security summary

The final package must not read `~/.codex/auth.json`, must not ask the user to paste tokens, must not use `OPENAI_API_KEY` by default, and must not expose a personal ChatGPT/Codex subscription as a public proxy.

See `docs/SECURITY.md` and `docs/IMPLEMENTATION_GUIDE.md` before implementation.
