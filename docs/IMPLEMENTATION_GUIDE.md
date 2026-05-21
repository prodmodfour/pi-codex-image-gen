# Implementation guide

This guide gives the autonomous agent a concrete path for building `pi-codex-image-gen` without guessing every decision from scratch.

## Current product intent

Build a TypeScript Pi package that:

1. Registers a `codex_generate_image` tool.
2. Uses Pi's `openai-codex` provider/model registry to get the user's Codex ChatGPT auth token at tool-call time.
3. Calls the current Codex image-generation backend contract.
4. Parses streamed response events until an image-generation item returns base64 image data.
5. Saves the image according to the requested save mode.
6. Returns text plus inline image content to Pi.

## Current public references to verify

The agent should verify these current assumptions before final implementation:

* Pi package manifests declare resources under the `pi` key in `package.json`.
* Pi extensions can register tools with `pi.registerTool`.
* OpenAI Codex supports ChatGPT sign-in for subscription access and API-key sign-in for usage-based access.
* Codex CLI image generation uses `gpt-image-2` and counts toward Codex usage limits.
* A public `pi-codex-image-gen` package currently exists, so publishing this unscoped name may require ownership or a scoped alternative.

## Recommended modules

```text
src/tool/codexImageGenApi.ts
```

Owns public constants, supported enums, parameter schema, normalization, and validation errors.

```text
src/config/codexImageGenConfig.ts
```

Loads global config, project config, and environment overrides. It must not read credentials.

```text
src/auth/codexAuth.ts
```

Accepts an in-memory bearer token supplied by Pi. Extract account id only if needed by the backend. Never read token files. Never log token contents.

```text
src/codex/buildRequest.ts
```

Builds request body and headers from normalized input, model, output format, session id, token, and account id. Keep this pure and testable.

```text
src/codex/parseSse.ts
```

Parses event-stream chunks. It should handle partial chunks, multiple events in one chunk, `[DONE]`, text deltas, response metadata, errors, and image-generation result items.

```text
src/codex/CodexImageClient.ts
```

Owns fetch, retry, cancellation, and stream parsing. Inject `fetch`, `sleep`, and clock/random seams for deterministic tests.

```text
src/save/imageSave.ts
```

Owns save mode resolution and file writes.

```text
src/output/formatToolResult.ts
```

Owns Pi text/image result formatting and details.

```text
src/pi/registerCodexImageGenTool.ts
```

Owns Pi-facing registration and execution. This should mostly wire the other modules together.

## Candidate runtime contract to verify

The currently published reference implementation uses a Codex Responses-style endpoint and streams SSE events. Treat this as a starting point to verify, not as immutable truth.

Candidate request characteristics:

```text
provider: openai-codex
method: POST
response: text/event-stream
tool: image_generation
backend image model: gpt-image-2
```

Candidate response event of interest:

```json
{
  "type": "response.output_item.done",
  "item": {
    "type": "image_generation_call",
    "id": "...",
    "status": "completed",
    "result": "<base64 image>",
    "revised_prompt": "..."
  }
}
```

If live validation shows a different current event shape, update the parser, docs, and tests.

## Request body principles

The request should instruct Codex to call image generation exactly once for an explicit image prompt. Keep the prompt as data; do not interpolate it into shell commands. Prefer these principles:

* `store: false`
* `stream: true`
* one user message containing the image prompt
* one image-generation tool declaration
* no parallel tool calls unless current backend explicitly requires it
* low text verbosity
* a session-based prompt cache key if supported

Only include output-format, quality, size, or other image-generation options after verifying current backend support.

## Tool result shape

Return a Pi result similar to:

```ts
{
  content: [
    { type: "text", text: "Generated image via openai-codex/<model> using backend gpt-image-2. Saved image to: ..." },
    { type: "image", data: base64Image, mimeType: "image/png" }
  ],
  details: {
    provider: "openai-codex",
    model,
    backendImageModel: "gpt-image-2",
    outputFormat,
    saveMode,
    savedPath,
    responseId,
    imageGenerationId,
    revisedPrompt,
    usage
  }
}
```

## Error handling

Use sanitized actionable errors:

* missing openai-codex credentials: tell the user to run `/login` and select ChatGPT/Codex auth;
* token missing account claim: tell the user to re-run `/login`;
* 401/403: likely expired token or unavailable entitlement;
* 429: rate limited, retry with bounded backoff;
* no image result: backend refused or model did not call image generation;
* custom save with no directory: configuration error;
* abort signal: return a cancellation error.

Never include bearer tokens, raw auth payloads, raw local paths beyond the saved output path, or full backend error dumps if they may contain private data.

## Test plan

Use fake tests before live tests:

* schema and input normalization;
* config precedence;
* token/account extraction from a fake JWT;
* request body/header construction with a fake token;
* SSE parser with split chunks;
* retry policy for 429;
* no retry for 401/403;
* successful image extraction;
* text-only/no-image failure;
* save-mode path resolution;
* Pi registration and fake execution flow;
* package dry-run contents.

## Live validation plan

The live ticket should run only after non-live quality gates pass.

Suggested prompt:

```text
Use codex_generate_image to create a 64x64 flat vector test icon: a blue circle inside a grey square, no text, clean edges. Save globally as png.
```

Then test `save: "none"` with a second prompt. Remove generated files after confirming they are ignored.

## Release note

Do not publish blindly. Confirm package-name ownership first. If the unscoped package is unavailable, document alternatives such as `@prodmodfour/pi-codex-image-gen`, private npm, git install, or local path install.
