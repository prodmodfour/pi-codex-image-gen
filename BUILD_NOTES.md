# BUILD_NOTES.md

## Current state

Created from `prodmodfour/autonomous-build-template` style for an autonomous build of `pi-codex-image-gen`.

The scaffold contains:

* ticket-driven autonomous workflow files;
* a package skeleton for a TypeScript Pi package;
* quality-gate scripts;
* initial docs and implementation guide;
* clear live-validation policy for permissive Pi/Codex testing.

## Initial assumptions to verify

* Pi packages use a `package.json` `pi` manifest with `extensions` and `skills` paths.
* Pi extensions can register tools through `pi.registerTool`.
* Pi/Codex authentication can be accessed at runtime through the `openai-codex` provider/model registry.
* Codex image generation currently uses a Responses-style backend stream containing an image-generation call with base64 result data.
* `gpt-image-2` is the backend image model reported by Codex for image generation.

The build agent must verify current docs and live behaviour before finalizing backend assumptions.

## Known publishing caveat

The unscoped package name `pi-codex-image-gen` appears to exist publicly. Keep the local package name as requested, but document publishing constraints during release-readiness work.

## Ticket 000 notes

Completed skeleton/readiness work:

* Confirmed the Pi package manifest uses `pi.extensions` and `pi.skills` entries consistent with current Pi package docs.
* Kept `extensions/codex-image-gen.ts` thin and backend-free; backend work remains for later tickets.
* Added missing expected architecture directories for future auth, config, Codex client/parser, output, save, and test fixtures.
* Strengthened package-shape tests for discoverability keywords and skeleton directories.
* Added `package-lock.json` so the quality gate can use `npm ci` without leaving generated lockfile changes.
* Updated `.gitignore` for package artifacts, logs, local Pi runtime state, private config, and generated images.

Limitations/blockers:

* No Codex backend, config loading, auth extraction, image saving, or real Pi execution is implemented yet; those remain scoped to later tickets.
* Live validation has not been attempted and is reserved for Ticket 007.

## Last completed ticket

Ticket 000 — Confirm current assumptions and finish package skeleton.

## Last quality gates

2026-05-21 — `bash scripts/quality-gate.sh` passed.

## Next recommended ticket

Ticket 001 — Implement public tool API, validation, and config.
