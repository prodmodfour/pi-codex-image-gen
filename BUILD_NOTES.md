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

## Ticket 001 notes

Completed public API/config work:

* Implemented `src/tool/codexImageGenApi.ts` with tool constants, JSON-schema-compatible parameters, defaults, normalization, enum helpers, and structured sanitized validation errors.
* Implemented `src/config/codexImageGenConfig.ts` for defaults, global config, project config, and env override loading. Precedence is built-in defaults, global config, project config, then environment.
* Supported documented env overrides: `PI_CODEX_IMAGE_MODEL`, `PI_CODEX_IMAGE_SAVE_MODE`, and `PI_CODEX_IMAGE_SAVE_DIR`.
* Added unit tests for input normalization, defaults, invalid values, custom-save validation, config file/env precedence, and config error reporting.
* Updated README and docs for tool parameters, config paths, precedence, env overrides, and config/security caveats.
* Switched local TypeScript source imports to `.ts` specifiers with `allowImportingTsExtensions` so Node 22's native TypeScript test runner can import the source modules directly without a build step.

Limitations/blockers:

* Codex auth extraction, request construction, SSE parsing, retries, image saving, and real Pi execution are still not implemented; those remain scoped to later tickets.
* The default routing model is set to `gpt-5.5` based on the installed Pi model resolver source. Live image-generation validation has not been attempted and remains reserved for Ticket 007.

## Ticket 002 notes

Completed Codex backend communication work:

* Implemented `src/auth/codexAuth.ts` to normalize Pi-supplied in-memory `openai-codex` auth, decode JWT claims in memory, extract ChatGPT account id metadata, and throw sanitized auth errors without reading credential files.
* Implemented `src/codex/buildRequest.ts` for the current Codex Responses request shape: default base URL `https://chatgpt.com/backend-api/codex`, `/responses` path, bearer and `ChatGPT-Account-Id` headers, session/thread headers, `store=false`, `stream=true`, one user message, one `image_generation` tool, and `gpt-image-2` with the requested output format.
* Implemented `src/codex/parseSse.ts` for incremental SSE parsing, split chunks, `[DONE]`, response id, text deltas, usage, backend errors, and final `image_generation_call.result` extraction.
* Implemented `src/codex/CodexImageClient.ts` with injectable `fetch`, `sleep`, random jitter, retry policy, cancellation handling, bounded 429/5xx/network retries, and sanitized structured errors for HTTP failure, rate limit, backend refusal, missing image data, malformed SSE, cancellation, and transport failure.
* Added fake backend tests for auth extraction/missing auth, request construction, split SSE parsing, malformed SSE, successful streamed image response, retryable 429, non-retryable 401, backend refusal, no-image response, and cancellation.
* Updated architecture, extension spec, security, troubleshooting, and usage docs for the backend communication layer and its non-live validation boundaries.

Verification sources/assumptions:

* Checked current OpenAI image-generation docs for Responses `image_generation` tool support, output formats, `gpt-5.5` routing examples, and `gpt-image-2` backend notes.
* Checked current `openai/codex` source for ChatGPT-authenticated base URL selection (`https://chatgpt.com/backend-api/codex`), `/responses` path, `ChatGPT-Account-Id`, session/thread headers, request body fields, and stream event handling.

Limitations/blockers:

* No live Codex request was made in this ticket; live validation remains reserved for Ticket 007.
* The Pi tool registration still returns the skeleton not-implemented response until Ticket 004 wires the client into the extension.
* Image saving and Pi result formatting remain scoped to Ticket 003.

## Ticket 003 notes

Completed image save/result formatting work:

* Implemented `src/save/imageSave.ts` with `none`, `project`, `global`, and `custom` save-mode resolution.
* Implemented documented save paths: project saves under `<cwd>/.pi/generated-images/<session-id>/`, global saves under `<agent-dir>/generated-images/<session-id>/`, custom saves under the configured directory with relative paths resolved under `cwd`, and `none` skips disk writes.
* Added path-part sanitization for session ids and image-generation ids, deterministic filename extension mapping, custom-save validation, and atomic-ish temporary-file-plus-rename writes.
* Implemented `src/output/formatToolResult.ts` with concise text summaries, inline Pi image content using `image/png`, `image/jpeg`, or `image/webp`, and details metadata for provider, routing model, backend image model, output format, save mode, saved path, response id, image-generation id, revised prompt, and usage.
* Added unit tests for save target resolution, sanitization, write/no-write behavior, MIME mapping, and result formatting.
* Strengthened generated-image ignore/guard coverage for nested `generated-images` directories and updated README/docs for save locations, result shape, and security behavior.

Limitations/blockers:

* The Pi tool registration still returns the skeleton not-implemented response until Ticket 004 wires validation, auth, client, saving, and formatting into the extension.
* No live Codex request was made in this ticket; live validation remains reserved for Ticket 007.

## Ticket 004 notes

Completed Pi wiring/help/skill work:

* Implemented `src/pi/registerCodexImageGenTool.ts` so `codex_generate_image` now loads config, normalizes input, retrieves in-memory `openai-codex` auth with `ctx.modelRegistry.getApiKeyForProvider("openai-codex")`, calls the Codex image client, saves according to the selected save mode, and formats the Pi text/image result.
* Kept `extensions/codex-image-gen.ts` as a thin entrypoint and expanded the local Pi contract test seam for commands, UI notifications, session ids, and agent-dir hints.
* Added `/codex-image-gen` help command registration when `pi.registerCommand` is available; it displays parameters, save modes, and safety notes without being required for tool use.
* Added Pi fake API tests for tool metadata, command registration/help display, config/auth/client/save/output execution flow, and skill frontmatter.
* Added Agent Skills frontmatter to `skills/imagegen/SKILL.md` with concise guidance to use the tool only for explicit image-generation requests.
* Updated README and docs for the wired execution pipeline, help command, agent-dir/session handling, usage, installation, architecture, extension spec, and troubleshooting.

Verification:

* `bash scripts/quality-gate.sh` passed on 2026-05-21. A first local attempt failed because manually installed `node_modules/` existed before the gate; after removing it, the gate created and cleaned dependencies normally and passed.

Limitations/blockers:

* No live Codex request was made in this ticket; live validation remains reserved for Ticket 007.
* Backend request/event assumptions still need real authenticated validation before release.

## Ticket 005 notes

Completed regression/guard/packaging hardening:

* Added backend regression tests for malformed JWT payloads, missing/malformed ChatGPT account claims, all supported output-format request selections, non-retryable 401 and 403 failures, malformed SSE mapped through the client, and fetch abort cancellation.
* Added Pi execution coverage for missing `openai-codex` credentials that verifies the client is not called without auth.
* Added package dry-run tests that verify required extension, skill, docs, source, tests, and scripts are included while generated images, private runtime state, logs, credentials, build output, package tarballs, and dependencies are excluded.
* Strengthened the default no-API-key coverage by checking package dependencies and runtime source for `OPENAI_API_KEY` fallback usage.
* Updated the npm `files` allowlist so tests and operational scripts are part of the dry-run validated package contents.
* Strengthened `scripts/check-package-contents.mjs` to enforce required files by category, reject forbidden package paths, reject OpenAI API SDK dependencies, and scan packed runtime source for API-key fallback references.
* Strengthened `scripts/check-no-secrets.sh` with broader token/private-key patterns, code-only raw token-field checks, Codex auth-file path checks, and runtime API-key fallback detection.
* Strengthened `scripts/check-no-generated-private-files.sh` to block `.agent/`, `.pi/`, `.codex/`, generated images, logs, credentials, build output, temp directories, package tarballs, and private-key material.
* Updated release docs to describe the expanded package dry-run expectations.

Verification:

* `bash scripts/quality-gate.sh` passed on 2026-05-21.

Limitations/blockers:

* No live Codex request was made in this ticket; live validation remains reserved for Ticket 007.

## Ticket 006 notes

Completed documentation/runbook work:

* Rewrote `README.md` from autonomous scaffold notes into package-facing documentation with quick start, install/load commands, auth explanation, tool contract, config, save modes, result shape, repo map, caveats, and safety notes.
* Completed `docs/INSTALLATION.md` with prerequisites, non-live verification, one-session `pi -e .` loading, project/global local installs, git and npm-style installs, auth setup, config examples, and load-success checks.
* Completed `docs/USAGE.md` with explicit image-generation guidance, prompt examples, JSON-style tool-call examples, parameter validation details, config precedence, save modes, result shape, and operational boundaries.
* Expanded `docs/ARCHITECTURE.md` with module responsibilities and the full registration/config/auth/request/retry/SSE/save/result pipeline.
* Expanded `docs/SECURITY.md` with threat model, credential-handling rules, config boundaries, usage limits, generated-image handling, public-proxy non-goal, backend-error hygiene, and operational checks.
* Completed `docs/TROUBLESHOOTING.md` with load issues, missing auth, malformed auth/account metadata, 401/403, 429, 5xx/network errors, backend refusal, no-image responses, malformed SSE, custom save errors, save path issues, config errors, and npm name conflict guidance.
* Completed `docs/MANUAL_VALIDATION.md` with the exact live-validation checklist for tools, non-live gate, safe auth, package load, `save=global`, `save=none`, optional format checks, smoke hook handling, cleanup, and sanitized result recording.
* Expanded `docs/RELEASE.md` with quality/dry-run checks, package content expectations, name-ownership caveats, versioning, npm/git release procedures, post-release validation, and rollback notes.
* Expanded `docs/EXTENSION_SPEC.md` with frozen Pi manifest, tool schema, config, auth, Codex request/stream, retry, save, result, and skill assumptions plus the update process.
* Updated the guarded smoke script messaging so it accurately points live validation to Ticket 007/manual validation without implementing a live smoke path in this docs ticket.

Verification:

* `bash scripts/quality-gate.sh` passed on 2026-05-21.

Limitations/blockers:

* No live Codex request was made in this ticket; live validation remains reserved for Ticket 007.
* `scripts/smoke-real-codex-image.mjs` remains a guarded hook rather than a real consuming smoke test; Ticket 007 may implement or bypass it according to the live-validation checklist.

## Automation harness notes

2026-05-21 — Fixed the autonomous build-loop log/lock location. Earlier cycles wrote active logs under `.agent/logs/build-loop/`, while the repository guardrails and cleanup treat `.agent/` as private runtime state. If an agent removed `.agent/` to keep the tree clean, the next cycle's `tee` could fail with `No such file or directory` even after the ticket commit succeeded. The loop now stores logs and its lock under an external state directory by default, with `PI_CODEX_IMAGE_GEN_BUILD_LOOP_STATE_DIR` available as an override. Validation: `bash scripts/quality-gate.sh` passed.

## Last completed ticket

Ticket 006 — Complete docs and operational runbooks.

## Last quality gates

2026-05-21 — `bash scripts/quality-gate.sh` passed.

## Next recommended ticket

Ticket 007 — Perform live Pi/Codex image-generation validation.
