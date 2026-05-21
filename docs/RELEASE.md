# Release

Release work belongs after implementation and live validation.

Checklist:

```bash
bash scripts/quality-gate.sh
npm pack --dry-run
```

Confirm package contents include source, extension, skill, docs, tests, quality/smoke scripts, license, and README, and exclude generated images, logs, `.pi`, `.agent`, `.codex`, credentials, package tarballs, build output, and node modules.

`npm run pack:check` performs the same dry-run validation and fails if any required extension, skill, doc, source, test, or script file is missing from the package.

The unscoped npm package name `pi-codex-image-gen` may already be taken. Do not publish under a name you do not control. Alternatives include a scoped package, private registry, git install, or local path install.
