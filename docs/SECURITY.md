# Security

`pi-codex-image-gen` is designed for local, single-user Pi sessions. It must never become a public proxy for a user's ChatGPT/Codex subscription, a credential extraction tool, or a bypass for Codex/ChatGPT limits.

## Threat model

Protected assets:

* Pi/Codex/ChatGPT credentials and refresh material;
* account and workspace metadata;
* private prompts and session history;
* generated images that may encode private prompt content;
* local filesystem paths and project data;
* the user's Codex/ChatGPT usage quota and subscription entitlements.

Primary risks:

* accidental logging or committing of tokens;
* reading credential files outside Pi's runtime auth API;
* exposing a personal subscription through a shared service;
* saving sensitive generated images into version control;
* dumping raw backend errors that contain prompt or account context;
* silently switching from ChatGPT/Codex subscription auth to API-key billing.

## Credential handling

The extension obtains credentials only from Pi's runtime model/provider API for the `openai-codex` provider. The current implementation calls:

```ts
ctx.modelRegistry.getApiKeyForProvider("openai-codex")
```

at tool-call time, then keeps the returned token in memory only for the duration of the request.

The package must not:

* read Codex credential files directly;
* read OS credential stores directly;
* ask users to paste access tokens;
* log bearer tokens;
* write tokens to disk;
* include token contents in errors, test fixtures, docs, or commits;
* use `OPENAI_API_KEY` as a default fallback path.

The auth module may decode a Pi-supplied JWT payload in memory to extract non-secret routing metadata such as the ChatGPT account id. It does not verify token signatures and does not persist, print, or return token material.

## Config files are not credential files

The config loader reads only documented non-secret settings:

* `<agent-dir>/extensions/codex-image-gen.json`, normally `~/.pi/agent/extensions/codex-image-gen.json`;
* `<cwd>/.pi/extensions/codex-image-gen.json`;
* environment overrides `PI_CODEX_IMAGE_MODEL`, `PI_CODEX_IMAGE_SAVE_MODE`, and `PI_CODEX_IMAGE_SAVE_DIR`.

Supported config keys are `model`, `saveMode`, and `saveDir`. Do not place tokens, account secrets, private prompts, or API keys in these files.

Project `.pi/` files are ignored and blocked by repository guardrails by default because they can contain local runtime state.

## Billing and usage boundaries

When authenticated through `openai-codex`, image generation uses the user's ChatGPT/Codex access and may consume included or metered Codex/ChatGPT usage depending on the account and workspace.

The extension cannot and must not bypass:

* account login requirements;
* workspace selection;
* model or image-generation entitlements;
* rate limits;
* quota or usage limits;
* billing boundaries;
* content-safety systems.

OpenAI Platform API-key image generation is a separate billing path and is not the default path for this package.

## Public proxy non-goal

Do not run this package as a web service, shared daemon, team API, CI image generator, or remote proxy for multiple users. The runtime assumes one local user controlling one Pi session with their own authenticated provider state.

A safe deployment is:

```text
local user -> local Pi session -> local package -> user's openai-codex auth -> Codex backend
```

Unsafe deployments include:

* exposing the tool over HTTP for other users;
* sharing one user's ChatGPT/Codex login across a team;
* forwarding arbitrary prompts from untrusted users;
* adding browser scraping or credential automation to expand access;
* adding generic command execution to the package.

## Generated image handling

Generated images can contain sensitive content if the prompt is sensitive. The package returns inline base64 image data so Pi can display the result even when no file is saved.

Save modes:

| Mode | Location |
| --- | --- |
| `none` | no file write |
| `project` | `<cwd>/.pi/generated-images/<session-id>/` |
| `global` | `<agent-dir>/generated-images/<session-id>/` |
| `custom` | `<configured-dir>/<session-id>/`, with relative paths resolved under `<cwd>` |

The save module sanitizes session ids and image-generation ids before using them as path parts. It writes a temporary file in the target directory with user-only permissions and renames it into place.

Repository guards block committed generated images, `.pi/`, `.agent/`, `.codex/`, logs, package tarballs, credential files, and private-key material. Keep generated images out of git unless a future ticket explicitly asks for a safe, non-private fixture.

## Backend error handling

Codex backend event shapes and error payloads can change. The parser tolerates unknown events but fails safely when no image result appears.

The HTTP client reports high-level status, retryability, request ids, and sanitized backend error summaries. It must not dump full request bodies, prompts, bearer tokens, auth payloads, or raw backend response bodies into user-visible errors or committed logs.

## Local execution risks

Pi packages and extensions run with the local user's permissions. This package therefore avoids adding:

* generic shell execution;
* destructive automation;
* browser scraping;
* telemetry or analytics;
* unrelated tools;
* public server endpoints.

The autonomous build system has permission to run live tests and install tooling during development, but those build-time permissions are not runtime package behavior.

## Operational checks

Before committing or releasing, run:

```bash
bash scripts/quality-gate.sh
```

The gate includes:

* shell syntax checks;
* secret guard;
* generated/private-file guard;
* TypeScript typecheck;
* unit and fake integration tests;
* package dry-run contents validation;
* a second generated/private-file guard after npm operations.

Live validation must record only sanitized summaries in `BUILD_NOTES.md` and [MANUAL_VALIDATION.md](MANUAL_VALIDATION.md). Do not commit raw terminal logs, generated images, credentials, or private prompts.

## Reporting security issues

Report credential-handling, proxying, or generated-private-file issues privately to the repository owner. Public issues must not include tokens, credential snippets, private prompts, raw logs, generated private images, or account-specific diagnostics.
