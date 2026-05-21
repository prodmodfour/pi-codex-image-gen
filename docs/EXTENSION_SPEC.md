# Extension spec assumptions

This document freezes the current Pi/Codex assumptions used by `pi-codex-image-gen`. If live validation or upstream source changes disprove any assumption, update implementation, tests, and docs together.

## Scope

The package registers exactly one primary image-generation tool:

```text
codex_generate_image
```

It may also register an optional help command:

```text
/codex-image-gen
```

The command is not part of the primary tool contract and can be absent on Pi runtimes without command registration support.

## Pi package manifest

`package.json` declares package resources under `pi`:

```json
{
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions/codex-image-gen.ts"],
    "skills": ["./skills"]
  }
}
```

Paths are relative to the package root. The package ships TypeScript source directly.

## Extension entrypoint

`extensions/codex-image-gen.ts` remains thin:

```ts
import { registerCodexImageGenTool } from "../src/pi/registerCodexImageGenTool.ts";
import type { PiExtensionApi } from "../src/pi/piExtensionContract.ts";

export default function codexImageGenExtension(pi: PiExtensionApi): void {
  registerCodexImageGenTool(pi);
}
```

All testable behavior belongs in `src/` modules.

## Tool metadata

Current metadata:

| Field | Value |
| --- | --- |
| name | `codex_generate_image` |
| label | `Codex Image` |
| description | `Generate an image with Codex through Pi's openai-codex authentication...` |
| execution mode | `sequential` |

Prompt guidance must name the tool directly and say to use it only for explicit image-generation requests because it consumes Codex image usage.

## Public parameter schema

The public input object has `additionalProperties: false`.

| Parameter | Required | Values/defaults |
| --- | --- | --- |
| `prompt` | yes | non-empty string, max 8000 characters after trimming |
| `model` | no | Codex routing model id, max 128 characters; default `gpt-5.5` unless configured |
| `outputFormat` | no | `png`, `jpeg`, `webp`; default `png` |
| `save` | no | `none`, `project`, `global`, `custom`; default `global` unless configured |
| `saveDir` | conditional | required for custom save mode unless config/env provides it |

Do not add public parameters such as size, quality, seed, edit input, or masks until backend support is verified, fake tests are added, and user docs are updated.

## Config surface

Optional config files are JSON objects with these keys:

* `model`;
* `saveMode`;
* `saveDir`.

Merge precedence:

1. built-in defaults;
2. global config;
3. project config;
4. environment overrides.

Paths:

| Scope | Path |
| --- | --- |
| global | `<agent-dir>/extensions/codex-image-gen.json`, normally `~/.pi/agent/extensions/codex-image-gen.json` |
| project | `<cwd>/.pi/extensions/codex-image-gen.json` |

Environment overrides:

* `PI_CODEX_IMAGE_MODEL`;
* `PI_CODEX_IMAGE_SAVE_MODE`;
* `PI_CODEX_IMAGE_SAVE_DIR`.

Config loading must never read credential files.

## Pi auth provider assumption

Provider name:

```text
openai-codex
```

Current runtime lookup:

```ts
ctx.modelRegistry.getApiKeyForProvider("openai-codex")
```

The local `src/pi/piExtensionContract.ts` type is a test seam. If Pi's real API changes, update the seam, registration code, and fake Pi tests.

`resolveCodexAuth()` accepts the Pi-supplied in-memory token or auth object. It extracts:

* bearer token;
* ChatGPT account id from explicit fields or decoded JWT claims;
* non-secret claims summary when present.

It does not verify JWT signatures, persist tokens, or read credential files.

## Codex request assumption

The current non-live verified request target is:

```text
POST https://chatgpt.com/backend-api/codex/responses
Accept: text/event-stream
```

Headers:

| Header | Purpose |
| --- | --- |
| `authorization` | bearer token from Pi `openai-codex` auth |
| `ChatGPT-Account-Id` | account id extracted from Pi auth metadata |
| `content-type` | `application/json` |
| `accept` | `text/event-stream` |
| `user-agent` | package/version identifier |
| `x-client-request-id` | optional sanitized tool-call/thread id |
| `session_id`, `session-id` | optional sanitized Pi session id |
| `thread_id`, `thread-id` | optional sanitized Pi tool-call/thread id |

Request body assumptions:

```json
{
  "model": "gpt-5.5",
  "instructions": "<short instruction to call image generation once>",
  "input": [
    {
      "type": "message",
      "role": "user",
      "content": [
        {
          "type": "input_text",
          "text": "<prompt>"
        }
      ]
    }
  ],
  "tools": [
    {
      "type": "image_generation",
      "model": "gpt-image-2",
      "output_format": "png",
      "action": "generate"
    }
  ],
  "tool_choice": "auto",
  "parallel_tool_calls": false,
  "reasoning": null,
  "store": false,
  "stream": true,
  "include": [],
  "text": {
    "verbosity": "low"
  }
}
```

The implementation also sends client metadata identifying provider, package, tool, and backend image model.

The prompt is request data only. It must not be interpolated into shell commands, browser automation, or external URLs.

## SSE response assumption

The backend streams text/event-stream data. Parser requirements:

* handle split chunks;
* handle multiple events per chunk;
* normalize CRLF/CR line endings;
* ignore comments and `[DONE]`;
* parse JSON `data:` payloads;
* tolerate unknown event types;
* capture response id and usage when present;
* accumulate text deltas;
* capture backend errors;
* extract final base64 image data.

Expected final event shape:

```json
{
  "type": "response.output_item.done",
  "item": {
    "type": "image_generation_call",
    "id": "<image generation id>",
    "status": "completed",
    "result": "<base64 image>",
    "revised_prompt": "<optional revised prompt>"
  }
}
```

The parser also checks `response.output` arrays for image-generation call items.

Failure conditions:

* malformed JSON -> `CODEX_IMAGE_GEN_MALFORMED_SSE`;
* backend error event -> `CODEX_IMAGE_GEN_BACKEND_REFUSAL`;
* stream completes with no image result -> `CODEX_IMAGE_GEN_MISSING_IMAGE_DATA`.

## Retry and cancellation assumption

Default retry policy:

* maximum attempts: 3;
* base delay: 200 ms;
* max delay: 2000 ms;
* jitter ratio: 0.2.

Retryable:

* HTTP 429;
* HTTP 5xx;
* transient network/transport failures.

Non-retryable:

* HTTP 401/403;
* backend refusal events;
* malformed SSE;
* missing image data after a successful stream.

Abort signals must map to `CODEX_IMAGE_GEN_CANCELLED` without returning partial image data.

## Save contract

Save modes:

| Mode | Contract |
| --- | --- |
| `none` | no file write |
| `project` | `<cwd>/.pi/generated-images/<session-id>/<image-id>.<format>` |
| `global` | `<agent-dir>/generated-images/<session-id>/<image-id>.<format>` |
| `custom` | `<saveDir>/<session-id>/<image-id>.<format>`; relative `saveDir` resolves under `cwd` |

`session-id` and `image-id` are sanitized path parts. The extension uses Pi's session id when available; otherwise it falls back to a safe default. The image id comes from the backend image-generation id when available, otherwise the tool-call id.

Written files use the requested format extension (`png`, `jpeg`, `webp`). The save module writes a temporary file with mode `0600` and renames it into place.

## Result contract

The formatted Pi result includes:

```ts
{
  content: [
    { type: "text", text: "Generated image via ..." },
    { type: "image", data: base64Image, mimeType: "image/png" | "image/jpeg" | "image/webp" }
  ],
  details: {
    provider: "openai-codex",
    routingModel: string,
    backendImageModel: "gpt-image-2",
    outputFormat: "png" | "jpeg" | "webp",
    saveMode: "none" | "project" | "global" | "custom",
    savedPath?: string,
    responseId?: string,
    imageGenerationId?: string,
    revisedPrompt?: string,
    usage?: Record<string, unknown>
  }
}
```

`details.savedPath` is intentionally returned to the local user only when an image was written.

## Skill contract

`skills/imagegen/SKILL.md` uses Agent Skills frontmatter:

```yaml
name: imagegen
description: Use when the user explicitly asks Pi to create a bitmap image, icon, illustration, visual asset, or placeholder artwork through codex_generate_image.
```

The skill must:

* trigger only for explicit image-generation requests;
* remind the model not to use the tool for text-only tasks;
* prefer safe save modes based on user intent;
* mention Codex/ChatGPT usage and limit boundaries.

## Updating assumptions

When Pi or Codex changes behavior:

1. Reproduce with a harmless prompt and sanitized notes.
2. Do not commit raw backend streams if they contain private prompt or account context.
3. Create minimal fake fixtures that preserve only the structural event/request shape needed for tests.
4. Update implementation modules:
   * auth changes -> `src/auth/codexAuth.ts` and Pi tests;
   * request changes -> `src/codex/buildRequest.ts` and request tests;
   * stream changes -> `src/codex/parseSse.ts` and parser/client tests;
   * save/result changes -> `src/save/*`, `src/output/*`, and docs.
5. Update this spec, [ARCHITECTURE.md](ARCHITECTURE.md), [USAGE.md](USAGE.md), and [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
6. Run `bash scripts/quality-gate.sh`.
7. Record sanitized validation results in `BUILD_NOTES.md` and [MANUAL_VALIDATION.md](MANUAL_VALIDATION.md).

If Codex provides a safer public SDK or CLI image-generation method that uses the same ChatGPT/Codex auth path without API-key billing, prefer that over hardcoded private endpoint details after adding tests and updating docs.

## Live-validation status

Ticket 007 must validate the frozen backend assumptions against a real authenticated Pi/Codex session. Until then, the backend request and stream contract is fake-tested and source/doc-verified, but not live-release-verified.
