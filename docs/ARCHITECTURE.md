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

The package should avoid a monolithic extension file. Each module should have unit tests or fake integration tests.
