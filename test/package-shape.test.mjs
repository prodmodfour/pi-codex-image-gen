import { readFile, stat } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const imagegenSkill = await readFile(new URL('../skills/imagegen/SKILL.md', import.meta.url), 'utf8');

test('package has the requested Pi package identity', () => {
  assert.equal(packageJson.name, 'pi-codex-image-gen');
  assert.equal(packageJson.type, 'module');
  for (const keyword of ['pi-package', 'pi-extension', 'pi-skill', 'codex', 'openai-codex', 'image-generation']) {
    assert.ok(packageJson.keywords.includes(keyword), `missing keyword: ${keyword}`);
  }
});

test('package declares Pi extension and skill resources', () => {
  assert.deepEqual(packageJson.pi.extensions, ['./extensions/codex-image-gen.ts']);
  assert.deepEqual(packageJson.pi.skills, ['./skills']);
});

test('imagegen skill has Pi-compatible frontmatter and guidance', () => {
  assert.match(imagegenSkill, /^---\nname: imagegen\ndescription: /);
  assert.match(imagegenSkill, /codex_generate_image/);
  assert.match(imagegenSkill, /explicitly asks/);
});

test('package exposes expected quality scripts', () => {
  for (const script of ['quality', 'typecheck', 'test', 'build', 'pack:check', 'smoke:codex-image']) {
    assert.equal(typeof packageJson.scripts[script], 'string', `missing script: ${script}`);
  }
});

test('expected skeleton source directories are present', async () => {
  const expectedDirectories = [
    'src/auth',
    'src/codex',
    'src/config',
    'src/output',
    'src/pi',
    'src/save',
    'src/tool',
    'test/fixtures',
  ];

  for (const directory of expectedDirectories) {
    const info = await stat(new URL(`../${directory}/`, import.meta.url));
    assert.ok(info.isDirectory(), `${directory} should exist`);
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
