# Architecture

`pi-codex-image-gen` is a small TypeScript Pi package. The extension entrypoint is intentionally thin; testable implementation lives under `src/`.

```text
Pi package manifest
  -> extensions/codex-image-gen.ts
  -> registerCodexImageGenTool(pi)
  -> codex_generate_image execution
      -> load config
      -> normalize and validate input
      -> retrieve in-memory openai-codex auth from Pi
      -> build Codex Responses request
      -> fetch with bounded retries and cancellation
      -> parse SSE until image_generation_call result
      -> save according to save mode
      -> format Pi text + inline image result
```

The default quality gate uses unit and fake integration tests only. It does not perform live Codex calls.

## Package resources

`package.json` declares Pi resources under the `pi` manifest:

```json
{
  "pi": {
    "extensions": ["./extensions/codex-image-gen.ts"],
    "skills": ["./skills"]
  }
}
```

Pi loads:

* `extensions/codex-image-gen.ts` as the extension factory;
* `skills/imagegen/SKILL.md` as an Agent Skill that guides models to use the tool only for explicit image-generation requests.

## Module boundaries

| Module | Responsibility |
| --- | --- |
| `src/constants.ts` | Package name, tool name, provider name, backend image model constants. |
| `src/tool/codexImageGenApi.ts` | Public tool schema, supported enums, defaults, normalization, validation errors. |
| `src/config/codexImageGenConfig.ts` | Global/project/env config paths, merge precedence, config validation. |
| `src/auth/codexAuth.ts` | Normalize Pi-supplied in-memory `openai-codex` auth, decode JWT claims in memory, extract ChatGPT account id metadata. |
| `src/codex/buildRequest.ts` | Pure request URL, headers, and body construction for the Codex Responses backend. |
| `src/codex/parseSse.ts` | Incremental text/event-stream parsing and image-generation result extraction. |
| `src/codex/CodexImageClient.ts` | Fetch orchestration, retries, cancellation, stream parsing, sanitized client errors. |
| `src/save/imageSave.ts` | Save-mode path resolution, path-part sanitization, base64 decoding, temporary-file-plus-rename writes. |
| `src/output/formatToolResult.ts` | Pi result formatting with text summary, inline image content, MIME mapping, and details. |
| `src/pi/piExtensionContract.ts` | Local subset of Pi's extension API used for typing and fake tests. |
| `src/pi/registerCodexImageGenTool.ts` | Pi registration, optional help command, and execution wiring. |

## Execution pipeline

### 1. Registration

`extensions/codex-image-gen.ts` default-exports a factory that calls `registerCodexImageGenTool(pi)`.

Registration adds:

* one primary tool: `codex_generate_image`;
* optional `/codex-image-gen` help command when `pi.registerCommand` exists.

The tool uses `executionMode: "sequential"` because live image generation is quota-bearing and may save files.

### 2. Config loading

At tool-call time, the registration layer resolves:

* `ctx.cwd` for project config and relative custom save directories;
* Pi's agent dir from `ctx.agentDir`, `ctx.getAgentDir()`, `PI_CODING_AGENT_DIR`, or default `~/.pi/agent`;
* process environment overrides.

`loadCodexImageGenConfig()` reads only documented non-secret config files:

* `<agent-dir>/extensions/codex-image-gen.json`;
* `<cwd>/.pi/extensions/codex-image-gen.json`.

It merges defaults, global config, project config, then environment overrides. Invalid config produces `CodexImageGenConfigError` with sanitized issues.

### 3. Input normalization

`normalizeCodexImageGenToolInput()` validates the public schema:

* required trimmed `prompt`;
* `model` defaulting to config;
* `outputFormat` normalized to `png`, `jpeg`, or `webp`;
* `save` normalized to `none`, `project`, `global`, or `custom`;
* `saveDir` required for custom saves unless already configured.

Unknown public parameters are rejected to keep the tool contract stable and auditable.

### 4. Auth resolution

The tool calls Pi's model registry:

```ts
ctx.modelRegistry.getApiKeyForProvider("openai-codex")
```

The returned value is passed to `resolveCodexAuth()`. The auth module accepts strings or Pi-shaped objects, extracts a bearer token, decodes JWT claims in memory when present, and extracts ChatGPT account id metadata from explicit fields or claims.

The module never reads credential files, never persists tokens, and never includes token material in thrown errors.

### 5. Request construction

`buildCodexImageRequest()` builds a `POST` request to the frozen Codex Responses assumption:

```text
https://chatgpt.com/backend-api/codex/responses
```

Request characteristics:

* `Accept: text/event-stream`;
* `Content-Type: application/json`;
* bearer auth from the Pi-supplied `openai-codex` token;
* `ChatGPT-Account-Id` from normalized account metadata;
* optional session/thread/request id headers derived from sanitized Pi session/tool-call ids;
* `store: false`;
* `stream: true`;
* one user message containing the prompt;
* one `image_generation` tool declaration;
* backend image model `gpt-image-2`;
* requested `output_format` from the normalized input;
* `parallel_tool_calls: false` and low text verbosity.

The prompt remains data in the JSON request. It is not interpolated into shell commands or external URLs.

### 6. Fetch, retries, and cancellation

`CodexImageClient` accepts injectable `fetch`, `sleep`, random, retry policy, and base URL seams for deterministic tests.

Default retry policy:

* max attempts: 3;
* base delay: 200 ms;
* max delay: 2000 ms;
* jitter ratio: 0.2.

Retryable conditions:

* HTTP 429;
* HTTP 5xx;
* network/transport failures until attempts are exhausted.

Non-retryable conditions include HTTP 401/403 and malformed or refused successful streams. Abort signals map to `CODEX_IMAGE_GEN_CANCELLED`.

### 7. SSE parsing

`CodexSseParser` incrementally handles:

* split chunks;
* multiple events per chunk;
* CRLF and LF line endings;
* comments and empty event blocks;
* `[DONE]` sentinels;
* text deltas;
* response id and usage metadata;
* backend error events;
* final `image_generation_call` items.

The parser tolerates unknown event types. It fails safely if event JSON is malformed or if the stream completes without image data.

Expected final image event shape:

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

### 8. Save pipeline

`saveGeneratedImage()` first resolves a target:

| Mode | Target |
| --- | --- |
| `none` | no target path |
| `project` | `<cwd>/.pi/generated-images/<session-id>/<image-id>.<format>` |
| `global` | `<agent-dir>/generated-images/<session-id>/<image-id>.<format>` |
| `custom` | `<saveDir>/<session-id>/<image-id>.<format>` |

Relative custom directories resolve under `cwd`. Session ids and image ids are normalized to safe path parts and truncated.

For written files, the save module decodes base64, creates the directory, writes a hidden temporary file with mode `0600`, and renames it into the final path. Temporary cleanup is best-effort on failures.

### 9. Result formatting

`formatCodexImageToolResult()` returns:

* text summary;
* inline image content with correct MIME type;
* details metadata.

Details include:

* `provider` (`openai-codex`);
* `routingModel`;
* `backendImageModel` (`gpt-image-2`);
* `outputFormat`;
* `saveMode`;
* optional `savedPath`;
* optional `responseId`;
* optional `imageGenerationId`;
* optional `revisedPrompt`;
* optional `usage`.

## Error model

Major structured error classes:

| Area | Error class | Examples |
| --- | --- | --- |
| Public input | `CodexImageGenValidationError` | missing prompt, invalid output format, custom save without directory |
| Config | `CodexImageGenConfigError` | invalid JSON, unknown config key, invalid save mode |
| Auth | `CodexAuthError` | missing auth, malformed token, missing account metadata |
| Backend client | `CodexImageClientError` | HTTP failure, rate limit, backend refusal, no image data, malformed SSE, cancellation |
| Saving | `ImageSaveError` | invalid base64, missing custom directory, write failure |

Messages are intended to be actionable and sanitized. They must not dump bearer tokens, raw backend payloads, raw auth files, or private prompts.

## Test and validation layers

Default non-live validation:

```bash
bash scripts/quality-gate.sh
```

Coverage includes:

* package shape and Pi manifest;
* public API validation and defaults;
* config precedence and validation;
* fake auth and account extraction;
* request construction;
* SSE parsing;
* retry and cancellation paths;
* save path resolution and formatting;
* fake Pi registration/execution flow;
* dry-run package contents;
* secret and generated/private-file guards.

Live validation is separate and documented in [MANUAL_VALIDATION.md](MANUAL_VALIDATION.md). If live validation discovers a changed backend contract, update `src/codex/*`, tests, [EXTENSION_SPEC.md](EXTENSION_SPEC.md), and user-facing docs together.
