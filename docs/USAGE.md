# Usage

The package registers one primary tool: `codex_generate_image`.

The public input contract, config validation, fake-tested Codex request/streaming layer, save-mode resolver, Pi result formatter, and Pi execution wiring are implemented. Live backend validation is still reserved for the dedicated live-validation ticket.

The extension also registers `/codex-image-gen` when the current Pi command API is available. That help command summarizes parameters, save modes, and safety boundaries inside Pi.

## Tool parameters

| Parameter | Required | Values | Notes |
| --- | --- | --- | --- |
| `prompt` | yes | non-empty string, max 8000 chars after trimming | Describe the desired image. Do not include secrets or private data in prompts. |
| `model` | no | Codex routing model id string | Defaults to config, currently `gpt-5.5` unless overridden. |
| `outputFormat` | no | `png`, `jpeg`, `webp` | Defaults to `png`. Values are normalized case-insensitively. |
| `save` | no | `none`, `project`, `global`, `custom` | Defaults to config, currently `global` unless overridden. |
| `saveDir` | when `save=custom` and no configured directory exists | directory path string | Relative custom paths are resolved under the current workspace during the save step. |

Unknown parameters, empty strings, invalid enums, and overlong values are rejected with structured validation errors.

## Examples

Example prompt after loading the package in Pi:

```text
Generate a 64x64 pixel-art potion bottle icon with blue liquid, transparent glass, no text, png.
```

Explicit tool request:

```text
Use codex_generate_image with save project to create a simple banner illustration for this README: abstract geometric shapes, no text, png.
```

JSON-style tool call shape:

```json
{
  "prompt": "A small flat vector test icon: blue circle inside a grey square, no text",
  "outputFormat": "png",
  "save": "global"
}
```

Custom save example:

```json
{
  "prompt": "Abstract geometric placeholder image, no text",
  "save": "custom",
  "saveDir": ".tmp/codex-image-tests"
}
```

Use the tool only for image generation. It consumes the user's Codex/ChatGPT usage when authenticated through `openai-codex` and cannot bypass account, rate, workspace, billing, entitlement, or content-safety limits.

## Configuration

Config files are optional JSON objects:

```json
{
  "model": "gpt-5.5",
  "saveMode": "global",
  "saveDir": ".pi/generated-images-custom"
}
```

Load order and precedence:

1. built-in defaults: `model="gpt-5.5"`, `saveMode="global"`;
2. global config: `~/.pi/agent/extensions/codex-image-gen.json`;
3. project config: `<cwd>/.pi/extensions/codex-image-gen.json`;
4. environment overrides:
   * `PI_CODEX_IMAGE_MODEL`
   * `PI_CODEX_IMAGE_SAVE_MODE`
   * `PI_CODEX_IMAGE_SAVE_DIR`

Supported `saveMode` values are `none`, `project`, `global`, and `custom`. If the resolved save mode is `custom`, either the config/env layer or the tool call must provide `saveDir`.

## Save locations and result shape

During Pi tool execution, the save module resolves locations as follows:

* `none`: no file is written;
* `project`: `<cwd>/.pi/generated-images/<sanitized-session-id>/<sanitized-image-id>.<format>`;
* `global`: `<agent-dir>/generated-images/<sanitized-session-id>/<sanitized-image-id>.<format>`;
* `custom`: `<saveDir>/<sanitized-session-id>/<sanitized-image-id>.<format>`, with relative `saveDir` values resolved under the current workspace.

Session ids and image-generation ids are sanitized before they become path parts. Image files are written through a temporary file in the target directory and then renamed into place.

The formatted Pi result contains a concise text summary, one inline image content item with `image/png`, `image/jpeg`, or `image/webp`, and details such as provider, routing model, backend image model, output format, save mode, saved path, response id, image-generation id, revised prompt, and usage.
