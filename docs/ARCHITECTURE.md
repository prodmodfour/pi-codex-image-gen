# Architecture

The target architecture is a small TypeScript Pi package with a thin extension entrypoint and testable modules under `src/`.

```text
Pi tool call
  -> registerCodexImageGenTool
  -> input normalization and config
  -> openai-codex auth from Pi runtime
  -> Codex image-generation request
  -> SSE parser
  -> save-mode handler
  -> Pi text + inline image result
```

Implemented public-surface modules:

* `src/tool/codexImageGenApi.ts` owns tool constants, JSON-schema-compatible parameters, input normalization, defaults, and structured validation errors.
* `src/config/codexImageGenConfig.ts` loads optional global/project JSON config plus environment overrides. Precedence is built-in defaults, global config, project config, then env.
* `src/auth/codexAuth.ts` normalizes an in-memory Pi `openai-codex` bearer token, decodes non-secret JWT claims when present, and extracts the ChatGPT account id without reading credential files.
* `src/codex/buildRequest.ts` builds the Codex Responses request for `https://chatgpt.com/backend-api/codex/responses` by default, with `Authorization`, `ChatGPT-Account-Id`, SSE `Accept`, optional session/thread headers, `store=false`, `stream=true`, one `image_generation` tool, and `gpt-image-2` as the requested image backend.
* `src/codex/parseSse.ts` incrementally parses SSE chunks, handles split events and `[DONE]`, captures text deltas, response id, usage, backend error events, and final `image_generation_call` image data.
* `src/codex/CodexImageClient.ts` orchestrates fetch, bounded retries for 429/5xx/network failures, cancellation, stream parsing, and sanitized structured errors.

Config paths:

* global: `~/.pi/agent/extensions/codex-image-gen.json` (or an injected Pi agent dir in tests/future wiring);
* project: `<cwd>/.pi/extensions/codex-image-gen.json`;
* env: `PI_CODEX_IMAGE_MODEL`, `PI_CODEX_IMAGE_SAVE_MODE`, `PI_CODEX_IMAGE_SAVE_DIR`.

The package should avoid a monolithic extension file. Each module should have unit tests or fake integration tests.

The backend communication layer is covered by fake tests only. It does not perform live Codex calls during the default quality gate; live validation remains reserved for the dedicated live-validation ticket.
