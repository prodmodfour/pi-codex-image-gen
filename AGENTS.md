# AGENTS.md

You are working in an autonomous, ticket-driven build system for `pi-codex-image-gen`.

This repository is allowed to run as a permissive local build environment. The project owner explicitly permits the build agent to install missing development tooling, use `sudo` where necessary, run live Pi/Codex tests, and consume local Codex/ChatGPT usage for validation. Use that permission to finish the project, but keep the repository safe, auditable, and single-user by design.

## Required reading

Before making changes, read these files in full:

* `AGENTS.md`
* `PROJECT_BRIEF.md`
* `BUILD_TICKETS.md`
* `BUILD_NOTES.md`
* `docs/IMPLEMENTATION_GUIDE.md`
* `docs/SECURITY.md`

## Core workflow

When invoked by the build loop:

1. Select the lowest-numbered `TODO` or `IN_PROGRESS` ticket from `BUILD_TICKETS.md`.
2. Print a short `Now working on ...` line naming the selected ticket and immediate action.
3. Implement only that ticket.
4. Do not start future tickets.
5. Do not broaden scope.
6. Install missing prerequisites when they are needed for the selected ticket.
7. Add or update tests/validation where appropriate.
8. Add or update docs when setup, architecture, behaviour, security posture, limitations, or usage changes.
9. Run `scripts/quality-gate.sh`.
10. Update `BUILD_TICKETS.md`.
11. Update `BUILD_NOTES.md`.
12. Commit the completed ticket with a conventional commit message.
13. Leave the working tree clean.

## Permissive local build powers

The agent may:

* install Node.js, npm, TypeScript, Pi, Codex CLI, shell tools, package managers, and test dependencies;
* use `sudo` for system packages when the host requires it;
* run `npm install`, `npm ci`, `npm pack`, `pi -e .`, `pi install`, `codex login` checks, and live Codex/Pi smoke tests;
* create temporary files, generated images, and throwaway test projects under `.tmp/`, `.pi/generated-images/`, or `/tmp`;
* remove temporary files it created;
* browse current documentation and inspect public repositories needed for implementation.

Use these powers only for this repository and the selected ticket.

## Hard safety rules

Never commit or reveal:

* real secrets;
* access tokens;
* API keys;
* private keys;
* `~/.codex/auth.json`;
* ChatGPT/Codex access tokens;
* real `.env` files;
* private prompts, private source paths, or raw terminal logs containing account-specific diagnostics;
* generated image artifacts unless a ticket explicitly asks for a committed fixture and the fixture contains no private data.

Do not ask the user to paste credentials. Do not read, copy, parse, print, upload, or commit Codex credential files. Authentication must remain owned by Pi/Codex login flows and Pi's `openai-codex` provider.

## Billing and auth rules

This package must use the user's Pi/Codex ChatGPT login by default. It must not require `OPENAI_API_KEY` and must not silently fall back to OpenAI API billing.

The extension may retrieve the `openai-codex` provider token from Pi's model registry at runtime. It must treat that token as a secret, keep it in memory only, and never log it.

The package must not try to bypass ChatGPT, Codex, account, rate, workspace, or content-safety limits. It must not expose the user's subscription as a public or multi-user proxy.

## Scope control

Do not:

* rewrite the autonomous build loop unless the selected ticket requires it;
* rename the package unless `pi-codex-image-gen` is impossible for local package metadata and the issue is documented;
* add install telemetry or external analytics;
* add browser scraping;
* add a generic command-execution tool;
* add API-key image generation as the default path;
* commit generated/private files;
* suppress quality gates to pass a ticket.

## Live validation policy

The user wants live tests. Run them when the selected ticket asks for live validation and the local environment is authenticated. Live image-generation tests may consume Codex usage. Keep prompts harmless, short, and clearly test-oriented.

If live validation is blocked by missing interactive auth, missing Pi account setup, or unavailable Codex image-generation entitlements, record the exact blocker in `BUILD_NOTES.md`, mark only the live-validation ticket `BLOCKED`, and keep all non-live gates passing.

## Commit style

Use conventional commits:

```text
chore:
feat:
fix:
test:
docs:
refactor:
ci:
build:
```

## Completion

The project is complete only when:

* every non-blocked ticket is done;
* real live validation has passed, or the live-validation blocker is honestly documented;
* quality gates pass;
* docs match implementation;
* no secrets/private/generated files are committed;
* `AUTOMATION_STATUS: DONE` is set in `BUILD_TICKETS.md` by the final ticket.
