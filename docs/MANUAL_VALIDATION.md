# Manual and live validation

This checklist is for the dedicated live-validation ticket or a human maintainer with local Pi and Codex access.

Live validation may consume Codex/ChatGPT usage. Do not commit generated images, raw terminal logs, credential material, private prompts, or account-specific diagnostics.

## Current validation status

```text
Live validation: PASS
Date: 2026-05-21
Environment summary: node v22.19.0, npm 10.9.3, pi 0.75.4, codex-cli 0.132.0; Codex CLI status reported ChatGPT login and Pi openai-codex text probe succeeded.
Package load method: pi -e . in non-interactive JSON mode with openai-codex/gpt-5.5.
Prompt category: harmless test icon / abstract placeholder.
Save modes checked: global, none.
Inline image observed: yes for both live tool calls.
Saved path checked: yes for save=global; not applicable for save=none.
Generated files removed or ignored: yes; the save=global file was removed after existence verification and save=none wrote no generated file.
Quality gate after cleanup: pass.
Smoke script: npm run smoke:codex-image completed with the guarded skip message.
Blocker if any: none.
```

Ticket 007 must update this section with a sanitized PASS, FAIL, or BLOCKED summary.

## Safety rules for validators

* Do not inspect, print, parse, copy, or commit Codex credential files.
* Do not ask anyone to paste tokens.
* Do not run browser scraping or ChatGPT web automation.
* Use harmless test prompts only.
* Keep generated files under documented generated-image directories or temporary paths.
* Delete generated live-test files when practical, or confirm they are ignored and blocked by guards.
* Record sanitized summaries only.

## 1. Verify local tools

From the repository root:

```bash
node --version
npm --version
pi --version
```

Record versions in sanitized form, for example:

```text
Environment summary: node v22.x, npm 10.x, pi <version>
```

Do not print auth files or token-bearing environment values.

## 2. Run non-live validation first

```bash
bash scripts/quality-gate.sh
```

Expected result:

* all shell, guard, typecheck, test, build, and pack checks pass;
* no generated/private files remain in the working tree.

If this fails, fix the non-live issue before attempting live validation.

## 3. Confirm Pi/Codex auth state safely

Start Pi interactively:

```bash
pi
```

If not already authenticated, run:

```text
/login
```

Choose the ChatGPT/Codex provider/account. Do not inspect credential files. If login cannot be completed in the environment, record the live-validation ticket as BLOCKED with a sanitized reason.

## 4. Load the package

Preferred one-session load from this checkout:

```bash
cd /absolute/path/to/pi-codex-image-gen
pi -e .
```

Alternative from a throwaway project:

```bash
mkdir -p /tmp/pi-codex-image-gen-live-check
cd /tmp/pi-codex-image-gen-live-check
pi install -l /absolute/path/to/pi-codex-image-gen
pi
```

Inside Pi, optional help check:

```text
/codex-image-gen
```

Expected:

* help text appears if command registration is supported;
* absence of the help command alone is not a failure if the tool is available.

## 5. Live prompt: `save=global`

Ask Pi explicitly to use the tool:

```text
Use codex_generate_image to create a 64x64 flat vector test icon: a blue circle inside a grey square, no text, clean edges. Use png and save globally.
```

Expected:

* Pi invokes `codex_generate_image`;
* the progress update mentions `openai-codex`, the routing model, and backend `gpt-image-2`;
* the final result contains a text summary;
* the final result contains one inline image content item;
* `details.outputFormat` is `png`;
* `details.saveMode` is `global`;
* `details.savedPath` is present;
* the saved file exists at the reported path;
* no credentials or raw tokens appear in output.

Record only a sanitized summary, not the full output.

## 6. Live prompt: `save=none`

In the same or a fresh Pi session, ask:

```text
Use codex_generate_image to create a simple abstract black-and-white checkerboard placeholder, no text. Use png and save none.
```

Expected:

* Pi invokes `codex_generate_image`;
* the final result contains inline image content;
* `details.saveMode` is `none`;
* `details.savedPath` is absent;
* no new image file is written for this call;
* no credentials or raw tokens appear in output.

## 7. Optional output-format spot check

If usage budget permits, run one additional harmless prompt with `outputFormat=webp` or `outputFormat=jpeg` and `save=none`.

Expected:

* inline image MIME type matches the requested format (`image/webp` or `image/jpeg`);
* no file is written when `save=none`.

If quota is limited, skip this optional step and rely on fake tests until a maintainer can validate formats.

## 8. Smoke script check

Run the package script:

```bash
npm run smoke:codex-image
```

For the current revision, this script is guarded and may skip unless a real smoke implementation has been added. If a future revision implements a real smoke path, follow that script's opt-in instructions and still avoid committing raw logs or generated images.

Do not set opt-in environment variables for a real smoke script unless the dedicated live-validation ticket authorizes the usage.

## 9. Cleanup

Remove live-test generated files when practical. At minimum, confirm they are ignored and blocked by guards.

From the repository root:

```bash
git status --short
bash scripts/check-no-generated-private-files.sh
```

If test images were saved under the repository, remove them before committing. Global generated images under the Pi agent directory should not be committed, but can still contain private content; delete them if they were only created for validation.

## 10. Final non-live gate after cleanup

```bash
bash scripts/quality-gate.sh
```

Expected: pass.

## 11. Sanitized record format

Update `BUILD_NOTES.md` and this document with only this style of summary:

```text
Live validation: PASS | FAIL | BLOCKED
Date: YYYY-MM-DD
Environment summary: node <major/minor>, npm <major/minor>, pi <version>
Package load method: pi -e . | pi install -l <local path>
Prompt category: harmless test icon / abstract placeholder
Save modes checked: global, none
Inline image observed: yes/no
Saved path checked: yes/no/not applicable
Generated files removed or ignored: yes/no
Quality gate after cleanup: pass/fail
Blocker if any: sanitized, no tokens/logs/private prompts
```

## Blocker examples

Mark the live-validation ticket BLOCKED only for live-only blockers such as:

* Pi is not installed and cannot be safely installed in the environment;
* interactive `/login` cannot be completed;
* `openai-codex` auth is unavailable;
* the account/workspace lacks Codex image-generation entitlement;
* backend consistently returns 401/403 despite fresh login;
* network policy blocks `chatgpt.com` from this machine.

Keep non-live gates passing even when live validation is blocked.
