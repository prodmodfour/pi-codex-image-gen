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

## Last completed ticket

None yet.

## Last quality gates

None yet.

## Next recommended ticket

Ticket 000 — Confirm current assumptions and finish package skeleton.
