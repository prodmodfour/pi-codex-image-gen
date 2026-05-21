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

## Save path issues

Resolved save locations are:

* `project`: `<cwd>/.pi/generated-images/<session-id>/`
* `global`: `<agent-dir>/generated-images/<session-id>/`
* `custom`: `<saveDir>/<session-id>/` (relative custom directories resolve under `<cwd>`)
* `none`: no file is written, but inline image content is still returned

If saving fails, check directory permissions, available disk space, and whether the custom path is valid for the local machine. Session ids and image ids are sanitized in filenames, so the final path may differ from the raw backend id.

## Backend communication errors

The backend client uses sanitized structured errors:

* missing auth: run Pi `/login` and choose ChatGPT/Codex authentication for `openai-codex`;
* missing account metadata: re-run `/login` so Codex refreshes ChatGPT account claims;
* 401/403: the token may be expired, the workspace may not be entitled, or the selected account cannot use Codex image generation;
* 429: the request was rate limited after bounded retries; wait for usage/rate limits to reset;
* 5xx/network: retried with bounded exponential backoff; retry later if the failure persists;
* malformed SSE: the Codex stream shape may have changed; update the parser/tests before relying on live generation;
* no image data: the backend completed without an `image_generation_call.result`, usually because the model did not call image generation or the request was refused.
