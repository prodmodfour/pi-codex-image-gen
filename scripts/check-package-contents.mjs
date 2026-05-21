#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

function fail(message) {
  console.error(`pack:check failed: ${message}`);
  process.exit(1);
}

if (packageJson.name !== 'pi-codex-image-gen') {
  fail(`package name must be pi-codex-image-gen, got ${packageJson.name}`);
}

if (!packageJson.pi?.extensions?.includes('./extensions/codex-image-gen.ts')) {
  fail('pi.extensions must include ./extensions/codex-image-gen.ts');
}

if (!packageJson.pi?.skills?.includes('./skills')) {
  fail('pi.skills must include ./skills');
}

const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  fail('npm pack --dry-run failed');
}

let pack;
try {
  pack = JSON.parse(result.stdout)[0];
} catch (error) {
  fail(`could not parse npm pack output: ${error instanceof Error ? error.message : String(error)}`);
}

const files = new Set((pack.files ?? []).map((entry) => entry.path));
const required = [
  'package.json',
  'README.md',
  'LICENSE.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'extensions/codex-image-gen.ts',
  'skills/imagegen/SKILL.md',
  'src/index.ts',
  'src/pi/registerCodexImageGenTool.ts',
  'src/pi/piExtensionContract.ts',
  'src/tool/codexImageGenApi.ts',
  'docs/IMPLEMENTATION_GUIDE.md',
  'docs/SECURITY.md',
  'scripts/check-package-contents.mjs',
  'scripts/smoke-real-codex-image.mjs',
];

for (const path of required) {
  if (!files.has(path)) {
    fail(`package is missing required file: ${path}`);
  }
}

const forbidden = [...files].filter((path) => (
  path.startsWith('.agent/')
  || path.startsWith('.pi/')
  || path.startsWith('node_modules/')
  || path.includes('generated-images')
  || path.endsWith('.tgz')
  || /(^|\/)\.env(\.|$)/.test(path)
));

if (forbidden.length > 0) {
  fail(`package includes forbidden files:\n${forbidden.map((path) => `  ${path}`).join('\n')}`);
}

console.log(`pack:check passed (${files.size} files, ${pack.filename ?? 'dry run'})`);
