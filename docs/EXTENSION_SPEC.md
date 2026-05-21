# Extension spec assumptions

This document records assumptions that the autonomous agent must verify and keep current.

## Pi package manifest

The package should declare resources in `package.json`:

```json
{
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions/codex-image-gen.ts"],
    "skills": ["./skills"]
  }
}
```

## Pi extension entrypoint

The extension entrypoint should default-export a function that receives Pi's extension API and registers the tool.

```ts
export default function codexImageGenExtension(pi: ExtensionAPI): void {
  registerCodexImageGenTool(pi);
}
```

## Tool metadata

Primary tool:

```text
name: codex_generate_image
label: Codex Image
description: Generate an image through Codex using existing openai-codex auth.
```

The prompt guidelines must say to use it only for explicit image-generation requests.

Public parameters:

| Parameter | Required | Values/defaults |
| --- | --- | --- |
| `prompt` | yes | non-empty string, max 8000 chars after trimming |
| `model` | no | configured Codex routing model, default `gpt-5.5` unless overridden |
| `outputFormat` | no | `png`, `jpeg`, `webp`; default `png` |
| `save` | no | `none`, `project`, `global`, `custom`; default `global` unless configured |
| `saveDir` | conditional | required for custom save mode unless configured |

## Config surface

Config files are optional JSON objects with `model`, `saveMode`, and `saveDir` keys. Merge precedence is built-in defaults, global config, project config, then environment overrides.

* global config: `~/.pi/agent/extensions/codex-image-gen.json`
* project config: `<cwd>/.pi/extensions/codex-image-gen.json`
* environment: `PI_CODEX_IMAGE_MODEL`, `PI_CODEX_IMAGE_SAVE_MODE`, `PI_CODEX_IMAGE_SAVE_DIR`

Config loading must not read credential files.

## Auth provider

Provider name:

```text
openai-codex
```

The implementation should use Pi's current model registry/context method to retrieve this provider's token. The local contract in `src/pi/piExtensionContract.ts` is only a test seam and should be updated if Pi's real API differs.

## Image-generation backend

Ticket 002 verified the non-live request assumptions against current OpenAI image-generation docs and current `openai/codex` source:

* ChatGPT-authenticated Codex Responses traffic uses `https://chatgpt.com/backend-api/codex` as the default base URL and appends `/responses`.
* Requests use `POST`, `Accept: text/event-stream`, `Content-Type: application/json`, `Authorization: Bearer <Pi-supplied token>`, and `ChatGPT-Account-Id` when account metadata is available.
* Session/thread headers may be sent as `session_id`, `session-id`, `thread_id`, `thread-id`, and `x-client-request-id`.
* The body uses a mainline routing model such as `gpt-5.5`, `store: false`, `stream: true`, one user message, one `image_generation` tool declaration, `parallel_tool_calls: false`, and low text verbosity.
* The image-generation tool requests `model: "gpt-image-2"`, `action: "generate"`, and the normalized `output_format`.
* The streaming parser expects a final event shaped like `response.output_item.done` with `item.type = "image_generation_call"` and base64 image data in `item.result`. It also tolerates unknown events and extracts response id, text deltas, usage, and backend error events.

## Save and result formatting

The current save contract is:

* `none`: no file write;
* `project`: `<cwd>/.pi/generated-images/<session-id>/`;
* `global`: `<agent-dir>/generated-images/<session-id>/`;
* `custom`: `<configured-dir>/<session-id>/`, with relative directories resolved under `cwd`.

The implementation sanitizes session ids and image ids before using them as path parts, names files with the requested format extension, and writes through a temporary file plus rename.

The Pi result formatter returns text plus inline image content. The image content uses `mimeType` values `image/png`, `image/jpeg`, or `image/webp`. Details include provider, routing model, backend image model, output format, save mode, saved path when present, response id, image-generation id, revised prompt, and usage.

Ticket 007 must still validate backend assumptions against a real authenticated Pi/Codex session. If live validation shows a different current event shape or endpoint contract, update `src/codex/*`, tests, and this document.

If current Codex provides a safer public SDK/CLI method for image generation, prefer that over hardcoding private endpoint details, as long as it still uses ChatGPT/Codex auth rather than API-key billing.
