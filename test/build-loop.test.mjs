import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const buildLoop = await readFile(new URL('../scripts/build-loop.sh', import.meta.url), 'utf8');

test('build loop keeps active logs and lock files outside repository guard paths', () => {
  assert.match(buildLoop, /PI_CODEX_IMAGE_GEN_BUILD_LOOP_STATE_DIR/);
  assert.match(buildLoop, /XDG_STATE_HOME/);
  assert.doesNotMatch(buildLoop, /LOG_DIR="\.agent\/logs\/build-loop"/);
  assert.doesNotMatch(buildLoop, /LOCK_DIR="\.agent\/build-loop\.lock"/);
  assert.match(buildLoop, /mkdir -p "\$LOG_DIR"/);
});
