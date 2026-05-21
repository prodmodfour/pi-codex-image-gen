#!/usr/bin/env node
/**
 * Opt-in live smoke placeholder.
 *
 * Ticket 007 should upgrade this into a real Pi/Codex smoke test once the tool is
 * implemented. It must stay opt-in because it may consume Codex/ChatGPT usage.
 */

if (process.env.PI_CODEX_IMAGE_GEN_REAL_SMOKE !== '1') {
  console.log('Skipping real Codex image smoke test. Set PI_CODEX_IMAGE_GEN_REAL_SMOKE=1 after implementation and login.');
  process.exit(0);
}

console.error('Real smoke test is not implemented yet. Complete tickets 001-004 before enabling live validation.');
process.exit(1);
