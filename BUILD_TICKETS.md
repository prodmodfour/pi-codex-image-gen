# BUILD_TICKETS.md

AUTOMATION_STATUS: IN_PROGRESS

Ticket statuses:

* TODO
* IN_PROGRESS
* DONE
* BLOCKED

The build loop must select the lowest-numbered TODO or IN_PROGRESS ticket.

---

## 000 — Confirm current assumptions and finish package skeleton

Status: DONE

Review `PROJECT_BRIEF.md`, `docs/IMPLEMENTATION_GUIDE.md`, and the existing skeleton.

Required:

* Verify the package skeleton compiles or update it until `npm run typecheck` can pass.
* Confirm `package.json` has the requested package name, Pi manifest, scripts, and discoverability keywords.
* Add missing source directories from the expected architecture.
* Add a package-shape test if not already present.
* Add or update `.gitignore` for generated Pi images, logs, node modules, package tarballs, and private config.
* Keep this ticket focused on skeleton/readiness only; do not implement the Codex image backend yet.
* Run `scripts/quality-gate.sh`.
* Update `BUILD_TICKETS.md` and `BUILD_NOTES.md`.
* Commit with a conventional commit message.

---

## 001 — Implement public tool API, validation, and config

Status: DONE

Implement the stable public contract for `codex_generate_image`.

Required:

* Add `src/tool/codexImageGenApi.ts` with constants, supported enums, public schema, normalized input types, validation, defaults, and structured validation errors.
* Add `src/config/codexImageGenConfig.ts` with documented config loading from:
  * global `~/.pi/agent/extensions/codex-image-gen.json` or Pi's current agent dir helper if available;
  * project `<cwd>/.pi/extensions/codex-image-gen.json`;
  * env overrides `PI_CODEX_IMAGE_SAVE_MODE`, `PI_CODEX_IMAGE_SAVE_DIR`, and `PI_CODEX_IMAGE_MODEL` or better names documented consistently.
* Validate config and normalize bad values into actionable errors.
* Do not read credential files.
* Unit-test validation/defaults/config precedence.
* Update docs for tool parameters and config.
* Run `scripts/quality-gate.sh`.
* Update tickets and notes.
* Commit.

---

## 002 — Implement Codex auth, request construction, SSE parsing, and retries

Status: DONE

Build the backend communication layer with fake tests first.

Required:

* Add `src/auth/codexAuth.ts` that accepts an in-memory token from Pi and extracts required account metadata without reading credential files.
* Add `src/codex/buildRequest.ts` for request body and headers. Verify current endpoint/header/body assumptions against docs/source/live observation where possible before finalizing.
* Add `src/codex/parseSse.ts` to parse text/event-stream chunks, ignore `[DONE]`, handle partial chunks, extract text deltas, response id, usage, errors, and the final image-generation call.
* Add `src/codex/CodexImageClient.ts` with injectable `fetch`, `sleep`, and retry policy.
* Retry bounded transient 429/5xx/network failures with exponential backoff and jitter.
* Throw sanitized structured errors for missing image data, backend refusal, HTTP failure, malformed SSE, and cancellation.
* Unit/fake integration tests must not call real Codex.
* Do not log or expose bearer tokens.
* Run `scripts/quality-gate.sh`.
* Update tickets and notes.
* Commit.

---

## 003 — Implement image save modes and Pi tool result formatting

Status: DONE

Add storage and formatting behaviour.

Required:

* Add `src/save/imageSave.ts` with save modes `none`, `project`, `global`, `custom`.
* Save paths:
  * `project`: `<cwd>/.pi/generated-images/<session-id>/`
  * `global`: `<agent-dir>/generated-images/<session-id>/`
  * `custom`: `<configured-dir>/<session-id>/`, with relative paths resolved under `cwd`
  * `none`: do not write an image file
* Sanitize session ids and image ids used in path parts.
* Use atomic-ish writes or Pi's file mutation queue when available.
* Add `src/output/formatToolResult.ts` that returns:
  * text summary;
  * inline image content with base64 data and correct MIME type;
  * details including provider, routing model, backend image model, output format, save mode, saved path, response id, image generation id, revised prompt, and usage.
* Unit-test save path resolution, sanitization, MIME mapping, and result formatting.
* Ensure generated images are ignored and blocked by generated-file guard.
* Run `scripts/quality-gate.sh`.
* Update tickets and notes.
* Commit.

---

## 004 — Wire the Pi extension, help surface, and imagegen skill

Status: DONE

Connect implementation to Pi.

Required:

* Implement `src/pi/registerCodexImageGenTool.ts` so the registered tool uses the validation/config/auth/client/save/output modules.
* Keep `extensions/codex-image-gen.ts` as a thin entrypoint.
* Use Pi's `ctx.modelRegistry.getApiKeyForProvider("openai-codex")` or the current Pi API equivalent to obtain auth.
* Use Pi session/cwd/agent-dir helpers where available; keep local Pi API contract testable.
* Add an optional `/codex-image-gen` help command if the current Pi API supports commands cleanly; otherwise document why it was skipped.
* Add `skills/imagegen/SKILL.md` with concise guidance that triggers the tool only for explicit image-generation requests.
* Add tests with a fake Pi API to confirm registration metadata and execution flow.
* Update docs.
* Run `scripts/quality-gate.sh`.
* Update tickets and notes.
* Commit.

---

## 005 — Strengthen tests, guards, and packaging checks

Status: DONE

Make the package hard to regress.

Required:

* Add tests for:
  * missing `openai-codex` credentials;
  * malformed JWT/auth claims;
  * retryable 429 path;
  * non-retryable 401/403 path;
  * backend returns text but no image;
  * malformed SSE JSON;
  * aborted signal;
  * output format selection;
  * package manifest and package dry-run contents;
  * no default API-key dependency.
* Improve `scripts/check-no-secrets.sh` and `scripts/check-no-generated-private-files.sh` if needed.
* Ensure `npm run pack:check` rejects missing extension, skill, docs, source, tests, and scripts.
* Ensure `npm pack --dry-run` does not include generated images, `.agent/`, `.pi/`, node modules, logs, or credentials.
* Run `scripts/quality-gate.sh`.
* Update tickets and notes.
* Commit.

---

## 006 — Complete docs and operational runbooks

Status: DONE

Write production-quality docs.

Required docs:

* `README.md` with quick start, repo map, install/load commands, auth explanation, tool parameters, config, caveats, and safety notes.
* `docs/INSTALLATION.md` for local path, git, npm-style installation, and Pi one-session `pi -e .` loading.
* `docs/USAGE.md` with prompt examples and tool-call examples.
* `docs/ARCHITECTURE.md` with module boundaries and request/stream/save pipeline.
* `docs/SECURITY.md` with threat model, credential handling, usage limits, generated files, and public proxy non-goal.
* `docs/TROUBLESHOOTING.md` with missing auth, token expiry, 401/403, 429, backend refusal, save path issues, and no-image response.
* `docs/MANUAL_VALIDATION.md` with the exact live-validation checklist.
* `docs/RELEASE.md` with package dry-run and publishing caveats, including the likely public-name conflict.
* `docs/EXTENSION_SPEC.md` with frozen Pi/Codex assumptions and how to update them.
* Run `scripts/quality-gate.sh`.
* Update tickets and notes.
* Commit.

---

## 007 — Perform live Pi/Codex image-generation validation

Status: DONE

Use the permissive environment to do real validation.

Required:

* Verify local tools: `node --version`, `npm --version`, `pi --version`, and the relevant Codex/Pi auth state.
* Install missing tools if safe and needed.
* Do not inspect or print `~/.codex/auth.json` or any token.
* Load the package locally with `pi -e .` or `pi install -l /absolute/path/to/pi-codex-image-gen`.
* Run an explicit harmless prompt that asks Pi to invoke `codex_generate_image`, for example a tiny test icon or abstract geometric placeholder.
* Verify returned inline image content and saved path for at least `save=global` and `save=none`.
* Run `npm run smoke:codex-image` if implemented.
* Delete generated test images or confirm they are ignored and not committed.
* Record a sanitized pass/fail summary in `BUILD_NOTES.md` and `docs/MANUAL_VALIDATION.md`; do not commit raw logs.
* If live validation is blocked by unavailable auth/entitlement, mark this ticket `BLOCKED` with the exact blocker and keep all non-live gates passing.
* Run `scripts/quality-gate.sh` after cleanup.
* Update tickets and notes.
* Commit.

---

## 008 — Release readiness and repository polish

Status: TODO

Prepare for review or publishing.

Required:

* Run `npm pack --dry-run` and inspect package contents.
* Update version if appropriate, keeping `0.0.0` if not ready to publish.
* Confirm license files and notices are correct.
* Confirm docs mention that the public unscoped npm package name may already be owned by another maintainer; document scoped/private alternatives if necessary.
* Add optional CI only if it is lightweight and does not require live credentials.
* Ensure no generated/private files are committed.
* Run `scripts/quality-gate.sh`.
* Update tickets and notes.
* Commit.

---

## 099 — Final autonomous review and completion marker

Status: TODO

Perform final review.

Check:

* project brief goals are met;
* tickets are complete or blockers are honest;
* docs match implementation;
* quality gates pass;
* no secrets/private data are committed;
* generated/private files are not committed;
* package does not require `OPENAI_API_KEY` by default;
* package cannot act as a public multi-user proxy;
* live validation result or blocker is clearly recorded.

Run full quality gate.

If everything is complete, set the top-level automation status to:

```text
AUTOMATION_STATUS: DONE
```

Commit final review.

---
