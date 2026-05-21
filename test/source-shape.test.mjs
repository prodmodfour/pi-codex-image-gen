import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const extension = await readFile(new URL('../extensions/codex-image-gen.ts', import.meta.url), 'utf8');
const registration = await readFile(new URL('../src/pi/registerCodexImageGenTool.ts', import.meta.url), 'utf8');
const api = await readFile(new URL('../src/tool/codexImageGenApi.ts', import.meta.url), 'utf8');
const constants = await readFile(new URL('../src/constants.ts', import.meta.url), 'utf8');

test('extension entrypoint stays thin', () => {
  assert.match(extension, /registerCodexImageGenTool/);
  assert.doesNotMatch(extension, /fetch\(/);
});

test('tool registration uses requested tool and provider names', () => {
  assert.match(registration + constants, /codex_generate_image/);
  assert.match(registration + constants, /openai-codex/);
  assert.match(registration + constants, /gpt-image-2/);
});

test('initial schema exposes expected parameters', () => {
  for (const key of ['prompt', 'model', 'outputFormat', 'save', 'saveDir']) {
    assert.match(api, new RegExp(key));
  }
});
