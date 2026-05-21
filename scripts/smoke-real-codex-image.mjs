#!/usr/bin/env node
/**
 * Opt-in live smoke hook.
 *
 * The default package checks must not consume Codex/ChatGPT usage. Ticket 007 may
 * replace this guarded hook with a real smoke test after interactive Pi/Codex
 * auth is available and live validation is explicitly in scope.
 */

if (process.env.PI_CODEX_IMAGE_GEN_REAL_SMOKE !== '1') {
  console.log('Skipping real Codex image smoke test. Set PI_CODEX_IMAGE_GEN_REAL_SMOKE=1 only when a real smoke implementation is added and live validation is in scope.');
  process.exit(0);
}

console.error('Real Codex image smoke test is not implemented in this revision. Use docs/MANUAL_VALIDATION.md for Ticket 007 live validation.');
process.exit(1);
