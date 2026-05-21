# Security policy

Do not disclose vulnerabilities or credential-handling issues in public comments if they include secrets, tokens, private prompts, generated private images, or raw logs.

This project must never commit or request Codex/ChatGPT access tokens, OpenAI API keys, private keys, real `.env` files, `~/.codex/auth.json`, or generated private image outputs.

See `docs/SECURITY.md` for the package threat model.
