# Usage

The final package should register `codex_generate_image`.

Example prompt after loading the package in Pi:

```text
Generate a 64x64 pixel-art potion bottle icon with blue liquid, transparent glass, no text, png.
```

Explicit tool request:

```text
Use codex_generate_image with save project to create a simple banner illustration for this README: abstract geometric shapes, no text, png.
```

Use the tool only for image generation. It consumes the user's Codex/ChatGPT usage when authenticated through `openai-codex`.
