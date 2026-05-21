# Release

Release work belongs after implementation and live validation.

Checklist:

```bash
bash scripts/quality-gate.sh
npm pack --dry-run
```

Confirm package contents include source, extension, skill, docs, scripts, license, and README, and exclude generated images, logs, `.pi`, `.agent`, credentials, and node modules.

The unscoped npm package name `pi-codex-image-gen` may already be taken. Do not publish under a name you do not control. Alternatives include a scoped package, private registry, git install, or local path install.
