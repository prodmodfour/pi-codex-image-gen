# Manual and live validation

This guide is for the autonomous agent or a human validator on a machine with local Pi and Codex access.

Live validation may consume Codex/ChatGPT usage. Do not commit generated images, raw terminal logs, or credential material.

## Prerequisites

```bash
node --version
npm --version
pi --version
```

The final implementation may also need Codex/Pi login state. Use Pi's normal `/login` flow and select ChatGPT/Codex auth where appropriate. Do not inspect `~/.codex/auth.json`.

## Non-live validation

From the repository root:

```bash
bash scripts/quality-gate.sh
```

This must pass without real credentials.

## Live package load

Temporary one-session load:

```bash
pi -e .
```

Project-local install from a throwaway project:

```bash
pi install -l /absolute/path/to/pi-codex-image-gen
pi
```

## Live smoke prompts

Ask Pi explicitly to call the tool:

```text
Use codex_generate_image to create a 64x64 flat vector test icon: a blue circle inside a grey square, no text, clean edges. Use png and save globally.
```

Then test no-save mode:

```text
Use codex_generate_image to create a simple abstract black-and-white checkerboard placeholder, png, save none.
```

Expected behaviour:

* Pi invokes `codex_generate_image`.
* The tool reports it is using `openai-codex` and backend image generation.
* The result includes text plus inline image content.
* `save=global` writes a file in the documented generated-images directory.
* `save=none` returns inline image content and does not write a file.
* No credentials or raw tokens appear in output.

## Sanitized validation record

Record only this kind of summary in `BUILD_NOTES.md`:

```text
Live validation: PASS/FAIL/BLOCKED
Date:
Environment summary: node <version>, npm <version>, pi <version>
Package load method:
Prompt category: harmless test icon
Save modes checked:
Generated files removed or ignored: yes/no
Blocker if any:
```

Do not commit raw logs or generated images.
