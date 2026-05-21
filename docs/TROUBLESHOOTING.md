# Troubleshooting

This file should be completed during ticket 006.

Expected topics:

* package does not load in Pi;
* missing `openai-codex` credentials;
* expired token or 401/403;
* rate limit or 429;
* backend returned text but no image;
* malformed streamed event;
* `save=custom` missing `saveDir`;
* generated image not found;
* package-name publishing conflict.

## Config validation errors

The config loader reads only:

* `~/.pi/agent/extensions/codex-image-gen.json`
* `<cwd>/.pi/extensions/codex-image-gen.json`
* `PI_CODEX_IMAGE_MODEL`
* `PI_CODEX_IMAGE_SAVE_MODE`
* `PI_CODEX_IMAGE_SAVE_DIR`

Config JSON must be an object with optional `model`, `saveMode`, and `saveDir` keys. `saveMode` must be one of `none`, `project`, `global`, or `custom`.

If `save=custom` (or a resolved config default of `saveMode=custom`) is used, provide `saveDir` either in the tool call, config file, or `PI_CODEX_IMAGE_SAVE_DIR`.
