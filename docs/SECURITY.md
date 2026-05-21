# Security

`pi-codex-image-gen` is intended for local, single-user Pi sessions. It should never become a public proxy for a user's ChatGPT/Codex subscription.

## Credential handling

The extension must obtain credentials only from Pi's runtime model/provider API, specifically the `openai-codex` provider or the current equivalent.

The config loader reads only the documented non-secret config files (`~/.pi/agent/extensions/codex-image-gen.json` and `<cwd>/.pi/extensions/codex-image-gen.json`) plus documented environment overrides for model/save defaults. These files must not contain tokens or private auth material.

It must not:

* read `~/.codex/auth.json`;
* read OS credential stores directly;
* ask the user to paste access tokens;
* log bearer tokens;
* write tokens to disk;
* commit auth material;
* fall back to `OPENAI_API_KEY` for the default path.

The auth module may decode the Pi-supplied bearer token in memory to extract non-secret routing metadata such as the ChatGPT account id. It does not verify token signatures and must not persist, print, or include token material in errors.

## Billing and usage boundaries

When authenticated through Codex/ChatGPT, image generation may consume the user's included Codex/ChatGPT usage. The extension cannot and must not bypass usage, rate, workspace, entitlement, or safety limits.

API-key image generation is a separate billing path and is a non-goal for this package.

## Generated image handling

Generated images may contain sensitive content if the user's prompt is sensitive. The package should save images only in documented locations and should keep generated images out of git by default.

Default save modes:

* `global`: `~/.pi/agent/generated-images/<session-id>/` or Pi's current agent-dir equivalent
* `project`: `<cwd>/.pi/generated-images/<session-id>/`
* `custom`: `<configured-dir>/<session-id>/`
* `none`: no disk write

The quality gate must reject committed generated images and private Pi config.

## Backend risks

Codex backend event shapes can change. The parser must tolerate unknown events but fail safely if no image result is returned.

Backend error bodies may contain private prompt or account context. Keep user-facing errors concise and sanitized. The HTTP client should report status, retryability, request ids, and high-level backend error codes without dumping full response bodies or request payloads.

## Local execution risks

Pi packages run with local user permissions. The package must not add generic shell execution, destructive automation, browser scraping, or unrelated tools.

The autonomous build agent may use `sudo` and run live tests because the owner permitted it, but those permissions are for build-time only and must not become runtime package behaviour.

## Reporting issues

Report security issues privately to the repository owner. Do not open public issues containing credentials, token snippets, private prompts, or raw logs.
