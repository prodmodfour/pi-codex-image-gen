# Contributing

Run the local non-live quality gate before committing:

```bash
bash scripts/quality-gate.sh
```

Use conventional commits. Keep implementation changes small and ticket-scoped.

Do not commit generated images, raw logs, credentials, token files, or private Pi config.

Live Pi/Codex validation belongs in the dedicated validation ticket or manual validation guide. Record only sanitized summaries.
