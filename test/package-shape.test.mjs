import { readFile, stat } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const imagegenSkill = await readFile(new URL('../skills/imagegen/SKILL.md', import.meta.url), 'utf8');
const licenseText = await readFile(new URL('../LICENSE.md', import.meta.url), 'utf8');
const releaseDocs = await readFile(new URL('../docs/RELEASE.md', import.meta.url), 'utf8');
const ciWorkflow = await readFile(new URL('../.github/workflows/quality-gate.yml', import.meta.url), 'utf8');

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

test('package release metadata and license are review-ready', () => {
  assert.equal(packageJson.license, 'MIT');
  assert.match(licenseText, /MIT License/);
  assert.doesNotMatch(packageJson.description, /scaffold/i);
  assert.match(packageJson.description, /Codex ChatGPT auth/);
  assert.equal(packageJson.repository.type, 'git');
  assert.match(packageJson.repository.url, /prodmodfour\/pi-codex-image-gen\.git$/);
  assert.match(packageJson.homepage, /prodmodfour\/pi-codex-image-gen#readme$/);
  assert.match(releaseDocs, /scoped npm package/);
  assert.match(releaseDocs, /private registry package/);
});

test('ci workflow runs only the non-live quality gate', () => {
  const apiKeyEnvName = 'OPENAI' + '_API_KEY';
  assert.match(ciWorkflow, /bash scripts\/quality-gate\.sh/);
  assert.match(ciWorkflow, /node-version: '22'/);
  assert.equal(ciWorkflow.includes(apiKeyEnvName), false);
  assert.doesNotMatch(ciWorkflow, /smoke:codex-image|codex login|auth\.json/);
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
