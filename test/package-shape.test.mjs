import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('package has the requested Pi package identity', () => {
  assert.equal(packageJson.name, 'pi-codex-image-gen');
  assert.equal(packageJson.type, 'module');
  assert.ok(packageJson.keywords.includes('pi-package'));
  assert.ok(packageJson.keywords.includes('pi-extension'));
});

test('package declares Pi extension and skill resources', () => {
  assert.deepEqual(packageJson.pi.extensions, ['./extensions/codex-image-gen.ts']);
  assert.deepEqual(packageJson.pi.skills, ['./skills']);
});

test('package exposes expected quality scripts', () => {
  for (const script of ['quality', 'typecheck', 'test', 'build', 'pack:check', 'smoke:codex-image']) {
    assert.equal(typeof packageJson.scripts[script], 'string', `missing script: ${script}`);
  }
});

test('default path does not declare API-key image generation dependency', () => {
  const allDeps = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
    ...(packageJson.peerDependencies ?? {}),
  };
  assert.equal(Object.hasOwn(allDeps, 'openai'), false, 'default scaffold should not depend on OpenAI API SDK');
});
