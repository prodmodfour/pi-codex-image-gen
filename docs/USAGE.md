# Usage

`pi-codex-image-gen` registers one primary Pi tool:

```text
codex_generate_image
```

Use it only when the user explicitly asks for a generated bitmap image, icon, illustration, placeholder, banner, sprite, or similar visual asset. Do not use it for text-only answers, web search, code generation, or unrelated file creation.

Live calls use the user's Pi `openai-codex` ChatGPT/Codex authentication and may consume Codex/ChatGPT usage.

## Help command

When the current Pi runtime supports extension commands, the package registers:

```text
/codex-image-gen
```

The command shows parameters, save modes, and safety notes. It is optional; the tool can work even when command registration is unavailable.

## Parameters

| Parameter | Required | Values | Notes |
| --- | --- | --- | --- |
| `prompt` | yes | non-empty string, max 8000 chars after trimming | Describe the desired image. Do not include secrets or private data. |
| `model` | no | Codex routing model id string, max 128 chars | Defaults to config, currently `gpt-5.5` unless overridden. |
| `outputFormat` | no | `png`, `jpeg`, `webp` | Defaults to `png`; normalized case-insensitively. |
| `save` | no | `none`, `project`, `global`, `custom` | Defaults to config, currently `global` unless overridden. |
| `saveDir` | conditional | directory path string | Required when the resolved save mode is `custom` and no configured directory exists. |

Unknown parameters, empty strings, invalid enums, overlong values, NUL bytes in save directories, and control characters in model ids are rejected with structured sanitized errors.

## Prompt examples

Good prompts are explicit about subject, composition, style, constraints, text, and output format.

```text
Use codex_generate_image to create a 64x64 flat vector app icon: a blue circle inside a light grey square, no text, clean edges, png, save none.
```

```text
Generate a small pixel-art potion bottle icon with blue liquid, transparent glass, dark outline, no text. Use png and save it in the current project.
```

```text
Create an abstract geometric placeholder image for a README hero: overlapping teal and purple shapes on a white background, no text, webp, save globally.
```

Avoid prompts that include credentials, private source paths, private customer data, or anything you would not want stored in generated image metadata, logs, or session history.

## Tool-call examples

Minimal call:

```json
{
  "prompt": "A simple flat vector test icon: blue circle inside a grey square, no text"
}
```

Inline-only preview:

```json
{
  "prompt": "A monochrome abstract checkerboard placeholder, no text",
  "outputFormat": "png",
  "save": "none"
}
```

Project asset:

```json
{
  "prompt": "Pixel-art potion bottle icon with blue liquid, transparent glass, dark outline, no text",
  "outputFormat": "png",
  "save": "project"
}
```

Custom directory:

```json
{
  "prompt": "Abstract geometric placeholder image, no text",
  "outputFormat": "webp",
  "save": "custom",
  "saveDir": ".tmp/codex-image-tests"
}
```

Routing-model override:

```json
{
  "prompt": "Small black-and-white line art rocket icon, no text",
  "model": "gpt-5.5",
  "outputFormat": "jpeg",
  "save": "global"
}
```

Only override `model` when you know the selected Pi/Codex routing model supports the current backend contract.

## Configuration

Config files are optional JSON objects:

```json
{
  "model": "gpt-5.5",
  "saveMode": "global",
  "saveDir": ".pi/generated-images-custom"
}
```

Supported keys:

| Key | Values |
| --- | --- |
| `model` | non-empty string, max 128 characters, no control characters |
| `saveMode` | `none`, `project`, `global`, `custom` |
| `saveDir` | non-empty string, max 4096 characters, no NUL bytes |

Load order and precedence:

1. built-in defaults: `model="gpt-5.5"`, `saveMode="global"`;
2. global config: `~/.pi/agent/extensions/codex-image-gen.json` or Pi's active agent-dir equivalent;
3. project config: `<cwd>/.pi/extensions/codex-image-gen.json`;
4. environment overrides:
   * `PI_CODEX_IMAGE_MODEL`
   * `PI_CODEX_IMAGE_SAVE_MODE`
   * `PI_CODEX_IMAGE_SAVE_DIR`

Tool-call parameters override the resolved config defaults for that call.

## Save modes

| Mode | Behavior |
| --- | --- |
| `none` | No file is written. The Pi result still includes inline base64 image content. |
| `project` | Writes under `<cwd>/.pi/generated-images/<sanitized-session-id>/`. |
| `global` | Writes under `<agent-dir>/generated-images/<sanitized-session-id>/`. |
| `custom` | Writes under `<saveDir>/<sanitized-session-id>/`; relative `saveDir` values resolve under `<cwd>`. |

File names are based on the backend image-generation id when available, otherwise the Pi tool-call id. Session ids and image ids are sanitized to safe path parts and truncated before use.

The save implementation decodes the base64 image, writes a temporary file in the target directory with mode `0600`, and renames it into place.

## Result shape

A successful result has a text item, an inline image item, and details metadata. The exact object is Pi-runtime-managed, but the package returns the equivalent of:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Generated image via openai-codex/gpt-5.5 using backend gpt-image-2. Output format: png. Save mode: none; no image file was written."
    },
    {
      "type": "image",
      "data": "<base64 image>",
      "mimeType": "image/png"
    }
  ],
  "details": {
    "provider": "openai-codex",
    "routingModel": "gpt-5.5",
    "backendImageModel": "gpt-image-2",
    "outputFormat": "png",
    "saveMode": "none",
    "responseId": "<if returned>",
    "imageGenerationId": "<if returned>",
    "revisedPrompt": "<if returned>",
    "usage": {}
  }
}
```

For saved results, `details.savedPath` contains the local path returned to the current user.

## Operational boundaries

* The tool generates one image per call through the Codex image-generation backend.
* Output formats `png`, `jpeg`, and `webp` are supported by the public contract and fake-tested in request construction; live validation must confirm the currently deployed backend accepts them.
* The backend image model is reported as `gpt-image-2` according to the frozen implementation assumptions.
* The package does not add size, quality, seed, or edit/mask parameters. Add public parameters only after verifying backend support, adding tests, and updating docs.
* The package cannot bypass usage, rate, workspace, entitlement, billing, or safety limits.
