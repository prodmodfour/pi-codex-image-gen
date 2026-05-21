# Release

Release work happens only after implementation docs are current, non-live quality gates pass, and live validation has either passed or an honest live-only blocker is recorded.

This package is not ready for public publishing until a maintainer confirms package-name ownership and live backend behavior.

## Release prerequisites

* All non-blocked tickets are complete.
* `BUILD_TICKETS.md` and `BUILD_NOTES.md` reflect the current state.
* [MANUAL_VALIDATION.md](MANUAL_VALIDATION.md) records PASS or a clear BLOCKED result for live validation.
* No generated images, raw logs, `.pi/`, `.agent/`, `.codex/`, credentials, or private config are in the working tree.
* Public docs match the implementation and current backend assumptions.
* The default path still does not depend on `OPENAI_API_KEY` or an OpenAI API SDK.

## Non-live release checks

From a clean checkout:

```bash
bash scripts/quality-gate.sh
npm pack --dry-run
npm run pack:check
```

`quality-gate.sh` already invokes `npm run pack:check` when available. Running `npm pack --dry-run` separately is useful for human inspection.

The package dry-run must include:

* `package.json`, `README.md`, `LICENSE.md`, `SECURITY.md`, `CONTRIBUTING.md`;
* `extensions/codex-image-gen.ts`;
* `skills/imagegen/SKILL.md`;
* all required docs;
* all runtime `src/` modules;
* unit/fake integration tests;
* guard, quality, package-check, and smoke scripts.

The package dry-run must exclude:

* generated images;
* `.pi/`, `.agent/`, `.codex/`;
* `node_modules/`;
* build or coverage output;
* logs;
* package tarballs;
* credential files;
* private-key material;
* real `.env` files.

## Package-name caveat

The requested unscoped npm package name is:

```text
pi-codex-image-gen
```

That name may already be publicly owned. Do not publish under an unscoped name unless the maintainer controls it and verifies the npm provenance.

Safe alternatives:

* local path install:
  ```bash
  pi install /absolute/path/to/pi-codex-image-gen
  ```
* git install pinned to a tag or commit:
  ```bash
  pi install git:github.com/<owner>/pi-codex-image-gen@vX.Y.Z
  ```
* scoped npm package:
  ```bash
  pi install npm:@<scope>/pi-codex-image-gen@X.Y.Z
  ```
* private registry package with an organization-owned scope.

Document the chosen install source in README and installation docs before release.

## Versioning

The repository currently uses `0.0.0` while the package is under autonomous construction. Before a real release:

1. choose a semver version;
2. update `package.json` and `package-lock.json` together;
3. ensure docs and changelog/release notes identify whether live validation passed;
4. rerun the quality gate;
5. inspect `npm pack --dry-run` output.

Suggested pre-1.0 policy:

* patch version for docs/tests/internal fixes;
* minor version for public tool contract additions;
* avoid breaking public parameters without a major version or clear pre-1.0 release note.

## Publishing checklist

Only a maintainer with package ownership should publish.

```bash
git status --short
bash scripts/quality-gate.sh
npm pack --dry-run
npm publish --dry-run
```

Review the dry-run manifest and file list. If publishing to npm:

```bash
npm publish --access public
```

For scoped/private releases, use the registry and access settings appropriate to the organization.

Do not publish if:

* live validation has not passed and no blocker is documented;
* package contents include private or generated files;
* docs claim support that has not been validated;
* the package name is not controlled by the maintainer;
* any source path references a default OpenAI API-key image-generation fallback.

## Git release checklist

If release is via git rather than npm:

```bash
git status --short
bash scripts/quality-gate.sh
git tag -s vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

If signed tags are unavailable, document the maintainer-approved tag process.

Consumers can install the pinned tag:

```bash
pi install git:github.com/<owner>/pi-codex-image-gen@vX.Y.Z
```

## Post-release validation

After publishing or tagging:

1. install into a throwaway project using the released source;
2. run `/codex-image-gen` help if available;
3. run the live validation checklist if usage budget permits;
4. confirm package docs render correctly;
5. confirm no generated images or logs were produced in the repo.

Record only sanitized release-validation notes.

## Rollback

If a release is found to expose unsafe behavior:

* unpublish or deprecate the package if registry policy permits;
* remove or update the git tag only according to maintainer policy;
* publish a patched version that disables unsafe behavior;
* rotate affected credentials through Pi/provider login flows if token exposure is suspected;
* document the incident privately without exposing secrets or private prompts.
