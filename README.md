# pi-codex-image-gen

`pi-codex-image-gen` is a local, single-user [Pi](https://pi.dev/) package that registers one primary tool:

```text
codex_generate_image
```

The tool generates bitmap images through the user's existing Pi `openai-codex` ChatGPT/Codex authentication. It does **not** require `OPENAI_API_KEY`, does not use OpenAI Platform API-key billing by default, and is not a public proxy for a personal ChatGPT/Codex subscription.

> Status: the implementation is covered by non-live unit and fake-integration tests. Real Pi/Codex image generation is intentionally validated in the dedicated live-validation ticket/checklist; do not treat backend assumptions as release-verified until that checklist passes or a blocker is recorded.

## Quick start

Prerequisites:

* Node.js 20 or newer;
* npm;
* Pi installed and authenticated with `/login` for the ChatGPT/Codex (`openai-codex`) provider when running live generation.

From this repository:

```bash
npm ci
bash scripts/quality-gate.sh
pi -e .
```

Inside Pi, optional help is available when the Pi command API supports extension commands:

```text
/codex-image-gen
```

Then ask explicitly for image generation, for example:

```text
Use codex_generate_image to create a 64x64 flat vector test icon: a blue circle inside a grey square, no text, png, save none.
```

Live generation may consume Codex/ChatGPT usage and remains subject to account, workspace, rate, entitlement, billing, and safety limits.

## Install and load commands

Temporary one-session load from a checkout:

```bash
cd /path/to/pi-codex-image-gen
pi -e .
```

Project-local install from another project:

```bash
cd /path/to/your/project
pi install -l /absolute/path/to/pi-codex-image-gen
pi
```

Git install once a trusted remote and ref are available:

```bash
pi install -l git:github.com/<owner>/pi-codex-image-gen@<tag-or-commit>
```

npm-style install after ownership/name is confirmed:

```bash
pi install npm:pi-codex-image-gen@<version>
# or, if released under a scope:
pi install npm:@<scope>/pi-codex-image-gen@<version>
```

See [docs/INSTALLATION.md](docs/INSTALLATION.md) for full installation, update, and removal notes.

## Tool contract

`codex_generate_image` accepts a strict object with these public parameters:

| Parameter | Required | Values | Default |
| --- | --- | --- | --- |
| `prompt` | yes | non-empty string, max 8000 characters after trimming | none |
| `model` | no | Codex routing model id, max 128 characters | config default, currently `gpt-5.5` |
| `outputFormat` | no | `png`, `jpeg`, `webp` | `png` |
| `save` | no | `none`, `project`, `global`, `custom` | config default, currently `global` |
| `saveDir` | conditional | directory path string | required for `custom` saves unless configured |

Unknown properties and invalid values are rejected with sanitized validation errors.

Example tool-call shape:

```json
{
  "prompt": "A small flat vector test icon: blue circle inside a grey square, no text",
  "outputFormat": "png",
  "save": "global"
}
```

## Configuration

Configuration is optional JSON. It controls defaults only; it must never contain credentials.

```json
{
  "model": "gpt-5.5",
  "saveMode": "global",
  "saveDir": ".pi/generated-images-custom"
}
```

Precedence, lowest to highest:

1. built-in defaults: `model="gpt-5.5"`, `saveMode="global"`;
2. global config: `~/.pi/agent/extensions/codex-image-gen.json` or Pi's active agent-dir equivalent;
3. project config: `<cwd>/.pi/extensions/codex-image-gen.json`;
4. environment overrides:
   * `PI_CODEX_IMAGE_MODEL`
   * `PI_CODEX_IMAGE_SAVE_MODE`
   * `PI_CODEX_IMAGE_SAVE_DIR`

Save locations:

| Save mode | Location |
| --- | --- |
| `none` | no file write; inline image is still returned |
| `project` | `<cwd>/.pi/generated-images/<session-id>/` |
| `global` | `<agent-dir>/generated-images/<session-id>/` |
| `custom` | `<saveDir>/<session-id>/`, with relative paths resolved under `<cwd>` |

Session ids and image-generation ids are sanitized before they become path parts. Generated images are ignored and blocked from committed package contents by repository guards.

## Result shape

Successful tool results contain:

* a concise text summary;
* one inline image content item with base64 data and `image/png`, `image/jpeg`, or `image/webp`;
* `details` metadata with provider, routing model, backend image model, output format, save mode, optional saved path, response id, image-generation id, revised prompt, and usage.

## Repository map

```text
extensions/codex-image-gen.ts          Thin Pi extension entrypoint
skills/imagegen/SKILL.md               Skill guidance for explicit image requests
src/tool/codexImageGenApi.ts           Public schema, defaults, validation
src/config/codexImageGenConfig.ts      Global/project/env config loading
src/auth/codexAuth.ts                  In-memory openai-codex auth normalization
src/codex/buildRequest.ts              Codex Responses request builder
src/codex/CodexImageClient.ts          Fetch, retries, cancellation, stream orchestration
src/codex/parseSse.ts                  Incremental SSE parser
src/save/imageSave.ts                  Save-mode path resolution and file writes
src/output/formatToolResult.ts         Pi text/image result formatting
src/pi/piExtensionContract.ts          Local Pi API subset for tests
src/pi/registerCodexImageGenTool.ts    Tool registration and execution wiring
test/                                  Unit, fake integration, package-shape tests
scripts/quality-gate.sh                Full non-live validation
scripts/smoke-real-codex-image.mjs     Opt-in live-smoke hook guarded from default checks
docs/                                  Installation, usage, architecture, security, validation, release
```

## Safety notes

* Credentials are retrieved only from Pi's runtime model registry for the `openai-codex` provider.
* The package does not read Codex credential files and does not ask users to paste tokens.
* The default path does not use `OPENAI_API_KEY` and must not silently fall back to OpenAI API-key billing.
* Backend responses and errors are sanitized; bearer tokens are never logged or returned.
* The package is for local, single-user use only. Do not expose it as a shared service or subscription proxy.
* Generated images can contain private prompt-derived content. Keep them out of git unless a future ticket explicitly approves a safe fixture.

## More documentation

* [Installation](docs/INSTALLATION.md)
* [Usage](docs/USAGE.md)
* [Architecture](docs/ARCHITECTURE.md)
* [Security](docs/SECURITY.md)
* [Troubleshooting](docs/TROUBLESHOOTING.md)
* [Manual validation](docs/MANUAL_VALIDATION.md)
* [Release](docs/RELEASE.md)
* [Extension spec](docs/EXTENSION_SPEC.md)
