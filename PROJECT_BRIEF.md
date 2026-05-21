# PROJECT_BRIEF.md

TEMPLATE_CUSTOMISED: true

## Project name

`pi-codex-image-gen`

## Project type

Pi extension package, TypeScript npm package, local single-user tool integration.

## Project goal

Build a Pi package named `pi-codex-image-gen` that registers a `codex_generate_image` tool. The tool generates bitmap images inside Pi by using the user's existing Pi/OpenAI Codex ChatGPT authentication, not OpenAI Platform API-key billing.

The package should feel similar in quality, safety, testing, and documentation to `prodmodfour/pi-codex-web-search`, but it targets Codex image generation rather than Codex web search.

## Audience

* Pi users who already have a ChatGPT/Codex login available through Pi's `openai-codex` provider.
* The project owner and maintainers.
* Open-source reviewers who want clear safety boundaries around local credentials and generated files.

## Success criteria

The project is successful when:

* `package.json` declares a valid Pi package named `pi-codex-image-gen` with `pi.extensions` and `pi.skills` entries.
* The extension registers exactly one primary image-generation tool named `codex_generate_image`.
* The tool obtains the user's Codex ChatGPT auth via Pi's `openai-codex` provider/model registry.
* The tool does not require, read, or use `OPENAI_API_KEY` for the default path.
* The tool sends a Codex image-generation request using the currently working Pi/Codex backend contract discovered during implementation.
* The tool parses streamed Codex responses and extracts the generated base64 image from an `image_generation_call` or the confirmed current equivalent.
* The tool returns Pi content containing a concise text summary and an inline image object with the correct MIME type.
* Save modes are implemented: `none`, `project`, `global`, and `custom`.
* Config is documented and supported through project/global Pi config files and environment overrides.
* Unit tests cover validation, config loading, token/account extraction, request construction, SSE parsing, retries, save paths, package shape, and error handling.
* Fake integration tests cover a successful streamed image response, a backend refusal, a retryable 429/5xx path, and a missing-auth path.
* Live validation is attempted in the permissive environment with Pi and Codex auth. If blocked, the blocker is documented honestly.
* `scripts/quality-gate.sh` passes from a clean checkout.
* The final repo contains installation, usage, architecture, security, troubleshooting, manual validation, and release documentation.

## Non-goals

The agent must not spend time on:

* public multi-user proxying of a personal ChatGPT/Codex subscription;
* browser automation or scraping ChatGPT web pages;
* bypassing Codex, ChatGPT, account, rate, workspace, or content-safety limits;
* API-key image generation as the default path;
* web UI development;
* unrelated Pi tools;
* generated image galleries;
* telemetry/analytics;
* publishing to npm unless a ticket explicitly asks for release execution after final validation.

## Technology preferences

Preferred stack:

* language: TypeScript source shipped directly to Pi
* runtime: Node.js 20+
* package manager: npm
* testing: Node's built-in `node --test`, fake fetch/stream fixtures, no heavyweight test framework unless justified
* validation: TypeScript strict typecheck, package dry-run, shell syntax checks, secret guard, generated-file guard
* Pi extension dependencies: prefer Pi's existing `@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`, and `typebox` contracts when available
* CI: optional GitHub Actions after local quality gate works

Hard constraints:

* package name requested by owner: `pi-codex-image-gen`
* primary tool name: `codex_generate_image`
* provider name: `openai-codex`
* default routing model should be discovered/validated against current Pi/Codex behaviour; use `gpt-5.5` only if current validation supports it
* backend image model should be reported as `gpt-image-2` when the Codex backend confirms that is the image-generation backend
* default save mode: `global`
* output formats: `png`, `jpeg`, `webp`, only if confirmed by backend; otherwise restrict to confirmed formats
* no committed secrets, token files, raw logs, or generated images

Flexible choices:

* module boundaries may evolve if tests stay clear
* config object names may evolve if docs stay synchronized
* live smoke script may use a local fake Pi harness plus a documented manual Pi check if fully automated Pi invocation is not stable

## Architecture expectations

Target layout:

```text
extensions/codex-image-gen.ts          Pi extension entrypoint
skills/imagegen/SKILL.md               Pi skill helper for image-generation prompts
src/index.ts                           package exports and metadata
src/tool/codexImageGenApi.ts           tool constants, schema, input normalization
src/config/codexImageGenConfig.ts      global/project/env config loading
src/auth/codexAuth.ts                  openai-codex token/account extraction, no file reads
src/codex/buildRequest.ts              Codex request body/header construction
src/codex/CodexImageClient.ts          fetch/retry/stream orchestration
src/codex/parseSse.ts                  SSE parser and event handling
src/save/imageSave.ts                  save modes, path sanitization, file writes
src/output/formatToolResult.ts         Pi text/image result formatting
src/pi/piExtensionContract.ts          local Pi API subset for tests and typing
src/pi/registerCodexImageGenTool.ts    Pi tool registration and execution wiring
test/*.test.mjs                        unit, fake integration, package-shape tests
test/fixtures/                         fake SSE/image fixtures, no private data
scripts/quality-gate.sh                full non-live validation
scripts/smoke-real-codex-image.mjs     opt-in live validation
scripts/check-package-contents.mjs     npm pack dry-run validation
docs/                                  install, usage, architecture, security, troubleshooting, validation, release
```

Keep `extensions/codex-image-gen.ts` light. Put testable implementation seams in `src/`.

## Public tool contract

The final tool should accept at minimum:

| Parameter | Type | Required | Purpose |
| --- | --- | --- | --- |
| `prompt` | string | yes | Image prompt. Trim, require non-empty, cap length. |
| `model` | string | no | Codex routing model override. Defaults to config. |
| `outputFormat` | `png`/`jpeg`/`webp` | no | Requested image output format. |
| `save` | `none`/`project`/`global`/`custom` | no | Per-call save-mode override. |
| `saveDir` | string | no | Required when `save=custom`, unless configured by env/config. |

Only add more public parameters after confirming Codex backend support and documenting them.

## Quality expectations

Expected quality gates:

* `bash scripts/check-shell-syntax.sh`
* `bash scripts/check-no-secrets.sh`
* `bash scripts/check-no-generated-private-files.sh`
* `npm install` or `npm ci`
* `npm run typecheck`
* `npm test`
* `npm run build`
* `npm run pack:check`
* generated/private-file guard after checks

The default quality gate must not require live Pi/Codex auth. Live tests belong in an explicit opt-in script and in the dedicated live-validation ticket.

## Documentation expectations

Required docs:

* `README.md`
* `docs/INSTALLATION.md`
* `docs/USAGE.md`
* `docs/ARCHITECTURE.md`
* `docs/SECURITY.md`
* `docs/TROUBLESHOOTING.md`
* `docs/MANUAL_VALIDATION.md`
* `docs/RELEASE.md`
* `docs/EXTENSION_SPEC.md`

Docs must clearly say that the package uses the user's Codex/ChatGPT subscription access when authenticated through `openai-codex`, consumes Codex usage/limits, and cannot bypass billing, usage, workspace, rate, or safety limits.

## Safety and security constraints

Do not include:

* real secrets;
* credentials;
* access tokens;
* API keys;
* raw auth files;
* generated images from live tests;
* private logs;
* internal hostnames or private URLs;
* destructive automation;
* public subscription proxy behaviour.

## Agent behaviour notes

* Use `prodmodfour/pi-codex-web-search` as the style and quality reference.
* Inspect current Pi and OpenAI Codex docs before locking in runtime assumptions.
* Inspect the currently published `pi-codex-image-gen` implementation only as a reference; do not copy unreviewed telemetry or unsafe behaviour.
* Because the requested package name appears already used publicly, keep the local package name as requested but document npm publishing constraints if ownership is unavailable.
* Prefer small, testable modules over one large extension file.
* Make failure messages actionable and sanitized.
