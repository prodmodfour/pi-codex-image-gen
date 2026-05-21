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

Config paths:

* global: `~/.pi/agent/extensions/codex-image-gen.json` (or an injected Pi agent dir in tests/future wiring);
* project: `<cwd>/.pi/extensions/codex-image-gen.json`;
* env: `PI_CODEX_IMAGE_MODEL`, `PI_CODEX_IMAGE_SAVE_MODE`, `PI_CODEX_IMAGE_SAVE_DIR`.

The package should avoid a monolithic extension file. Each module should have unit tests or fake integration tests.
