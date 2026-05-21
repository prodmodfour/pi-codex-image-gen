# Troubleshooting

This guide maps common `pi-codex-image-gen` failures to safe checks and fixes. Keep shared bug reports sanitized: do not include credentials, token snippets, private prompts, raw backend payloads, generated private images, or full terminal logs.

## Quick checks

From the package root:

```bash
node --version
npm --version
bash scripts/quality-gate.sh
```

In a Pi session:

```text
/codex-image-gen
```

If the help command is unavailable, the Pi runtime may not support extension commands or command registration may have failed. The tool can still work if `codex_generate_image` is registered.

## Package does not load in Pi

Symptoms:

* `codex_generate_image` is not available;
* `/codex-image-gen` is absent;
* Pi reports an extension startup error.

Checks:

1. Load from the package root for a temporary test:
   ```bash
   cd /absolute/path/to/pi-codex-image-gen
   pi -e .
   ```
2. Confirm `package.json` contains:
   ```json
   {
     "pi": {
       "extensions": ["./extensions/codex-image-gen.ts"],
       "skills": ["./skills"]
     }
   }
   ```
3. Run `/reload` after changing package files.
4. Run `bash scripts/quality-gate.sh` outside Pi.
5. Inspect only sanitized Pi startup errors. Do not share private logs or credential paths.

If `/codex-image-gen` is absent but the tool is available, command registration is optional and does not block image generation.

## Missing `openai-codex` credentials

Possible messages:

* `Missing openai-codex credentials.`
* `Could not retrieve openai-codex credentials from Pi.`

Cause: Pi did not provide an in-memory credential for the `openai-codex` provider.

Fix:

1. Start interactive Pi.
2. Run:
   ```text
   /login
   ```
3. Select the ChatGPT/Codex provider/account.
4. Retry the tool call.

Do not read credential files and do not paste tokens into config.

## Malformed auth or missing account metadata

Possible messages:

* `openai-codex auth token is malformed.`
* `openai-codex auth is missing ChatGPT account metadata.`
* `openai-codex ChatGPT account metadata is malformed.`

Cause: Pi returned a token or auth object that did not include usable ChatGPT account id metadata, or the token payload could not be decoded.

Fix:

1. Re-run Pi `/login` for ChatGPT/Codex.
2. Make sure the desired account/workspace is selected.
3. Restart or `/reload` Pi if the old session cached provider state.
4. If the problem persists after fresh login, the Pi provider contract may have changed; update `src/auth/codexAuth.ts`, tests, and [EXTENSION_SPEC.md](EXTENSION_SPEC.md).

## HTTP 401 or 403

Possible message:

```text
Codex rejected openai-codex authentication (HTTP 401/403). Re-run Pi /login or check account entitlement.
```

Likely causes:

* expired or revoked provider token;
* wrong ChatGPT/Codex account selected;
* workspace does not permit Codex image generation;
* subscription or entitlement is unavailable;
* backend contract changed.

Fix:

1. Re-run `/login` in Pi.
2. Confirm the account/workspace has Codex access.
3. Try a minimal harmless prompt with `save=none`.
4. If 401/403 persists, record a sanitized blocker for live validation rather than trying to bypass account or workspace controls.

## HTTP 429 / rate limited

Possible message:

```text
Codex rate limited image generation. Try again later or after your usage limit resets.
```

Behavior: the client retries bounded transient 429 responses with exponential backoff and jitter. If the error is still returned, the limit did not clear during the retry window.

Fix:

* wait for rate or usage limits to reset;
* reduce live smoke-test attempts;
* use `save=none` for display-only checks to avoid extra file cleanup;
* do not add loops or bypass logic.

## 5xx or network failure

Possible messages:

* `Codex image generation failed with HTTP 5xx.`
* `Codex image generation failed due to a network or stream transport error.`

Behavior: the client retries HTTP 5xx and network/stream transport failures until the bounded retry policy is exhausted.

Fix:

1. Check local network availability.
2. Retry later.
3. If reproducible with authenticated live validation, record sanitized status, Pi version, package ref, and whether non-live quality gates pass.

## Backend refusal or safety block

Possible message:

```text
Codex did not complete image generation. The request may have been refused or blocked by account or safety limits.
```

Causes:

* content-safety refusal;
* account/workspace restriction;
* backend returned an error event;
* prompt was ambiguous or not an explicit image-generation request.

Fix:

* use a harmless, explicit test prompt;
* remove sensitive or disallowed content;
* do not attempt to bypass safety systems;
* record only sanitized refusal summaries.

## Backend returns text but no image

Possible message:

```text
Codex completed without returning image data. Try a more explicit image-generation prompt.
```

Causes:

* model did not call the image-generation tool;
* response was text-only;
* backend event shape changed;
* image result field moved or was omitted.

Fix:

1. Ask explicitly: `Use codex_generate_image to create ...`.
2. Keep the prompt short and clearly image-oriented.
3. If live validation repeatedly returns no image, update `src/codex/parseSse.ts`, fake fixtures/tests, and [EXTENSION_SPEC.md](EXTENSION_SPEC.md) after confirming the new event shape.

## Malformed streamed event

Possible message:

```text
Codex returned malformed streamed event data.
```

Cause: the SSE stream contained invalid JSON or a shape the parser treats as malformed.

Fix:

* confirm non-live parser tests still pass;
* avoid committing raw backend streams if they contain private prompts or account data;
* create a sanitized fake fixture that reproduces only the structural issue;
* update parser/tests/spec together.

## `save=custom` missing `saveDir`

Possible messages:

* `saveDir is required when save is "custom" unless a custom save directory is configured.`
* `saveDir is required when save mode is custom.`

Fix: provide `saveDir` in one of these places:

Tool call:

```json
{
  "prompt": "Abstract geometric placeholder, no text",
  "save": "custom",
  "saveDir": ".tmp/codex-image-tests"
}
```

Config file:

```json
{
  "saveMode": "custom",
  "saveDir": ".pi/generated-images-custom"
}
```

Environment:

```bash
PI_CODEX_IMAGE_SAVE_MODE=custom PI_CODEX_IMAGE_SAVE_DIR=.tmp/codex-image-tests pi -e .
```

## Save path or generated image not found

Expected save locations:

| Mode | Location |
| --- | --- |
| `project` | `<cwd>/.pi/generated-images/<session-id>/` |
| `global` | `<agent-dir>/generated-images/<session-id>/` |
| `custom` | `<saveDir>/<session-id>/` |
| `none` | no file is written |

Checks:

* inspect `details.savedPath` in the tool result;
* confirm the selected save mode;
* check directory permissions and disk space;
* remember that session ids and image-generation ids are sanitized in paths;
* relative custom paths resolve under the current workspace;
* `save=none` still returns an inline image but intentionally has no saved path.

## Config validation errors

Config JSON must be an object with optional `model`, `saveMode`, and `saveDir`. Unknown keys are rejected.

Valid example:

```json
{
  "model": "gpt-5.5",
  "saveMode": "project"
}
```

Invalid examples:

```json
[]
```

```json
{
  "save": "project"
}
```

The supported key is `saveMode`, not `save`.

## Package-name publishing conflict

The unscoped npm name `pi-codex-image-gen` is known to resolve publicly (`npm view` returned `pi-codex-image-gen@0.1.9` on 2026-05-21). If npm install or publish fails because of name ownership or provenance concerns:

* do not publish under a name you do not control;
* use local path or git installs for validation;
* choose a scoped package such as `@<scope>/pi-codex-image-gen` if releasing;
* use a private registry package under an organization-owned scope when appropriate;
* document the chosen install source in [RELEASE.md](RELEASE.md).
