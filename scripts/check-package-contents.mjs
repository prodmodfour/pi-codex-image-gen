#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

function fail(message) {
  console.error(`pack:check failed: ${message}`);
  process.exit(1);
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    fail(`${label} must be an array`);
  }
  return value;
}

if (packageJson.name !== 'pi-codex-image-gen') {
  fail(`package name must be pi-codex-image-gen, got ${packageJson.name}`);
}

const extensions = assertArray(packageJson.pi?.extensions, 'pi.extensions');
if (extensions.length !== 1 || extensions[0] !== './extensions/codex-image-gen.ts') {
  fail('pi.extensions must contain exactly ./extensions/codex-image-gen.ts');
}

const skills = assertArray(packageJson.pi?.skills, 'pi.skills');
if (skills.length !== 1 || skills[0] !== './skills') {
  fail('pi.skills must contain exactly ./skills');
}

const declaredDeps = {
  ...(packageJson.dependencies ?? {}),
  ...(packageJson.optionalDependencies ?? {}),
  ...(packageJson.devDependencies ?? {}),
  ...(packageJson.peerDependencies ?? {}),
};
for (const dependencyName of Object.keys(declaredDeps)) {
  if (dependencyName === 'openai' || dependencyName.startsWith('@openai/')) {
    fail(`default package dependencies must not include OpenAI API-key SDK dependency: ${dependencyName}`);
  }
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

if (pack === undefined || !Array.isArray(pack.files)) {
  fail('npm pack --dry-run returned no file list');
}

const files = new Set(pack.files.map((entry) => entry.path));

const requiredByCategory = new Map([
  ['root metadata', [
    'package.json',
    'README.md',
    'LICENSE.md',
    'SECURITY.md',
    'CONTRIBUTING.md',
  ]],
  ['Pi extension and skill', [
    'extensions/codex-image-gen.ts',
    'skills/imagegen/SKILL.md',
  ]],
  ['docs', [
    'docs/ARCHITECTURE.md',
    'docs/EXTENSION_SPEC.md',
    'docs/IMPLEMENTATION_GUIDE.md',
    'docs/INSTALLATION.md',
    'docs/MANUAL_VALIDATION.md',
    'docs/RELEASE.md',
    'docs/SECURITY.md',
    'docs/TROUBLESHOOTING.md',
    'docs/USAGE.md',
  ]],
  ['source', [
    'src/index.ts',
    'src/constants.ts',
    'src/auth/codexAuth.ts',
    'src/codex/buildRequest.ts',
    'src/codex/CodexImageClient.ts',
    'src/codex/parseSse.ts',
    'src/config/codexImageGenConfig.ts',
    'src/output/formatToolResult.ts',
    'src/pi/piExtensionContract.ts',
    'src/pi/registerCodexImageGenTool.ts',
    'src/save/imageSave.ts',
    'src/tool/codexImageGenApi.ts',
  ]],
  ['tests', [
    'test/api-validation.test.mjs',
    'test/backend-communication.test.mjs',
    'test/build-loop.test.mjs',
    'test/config.test.mjs',
    'test/package-contents.test.mjs',
    'test/package-shape.test.mjs',
    'test/pi-registration.test.mjs',
    'test/save-output.test.mjs',
    'test/source-shape.test.mjs',
  ]],
  ['scripts', [
    'scripts/check-no-generated-private-files.sh',
    'scripts/check-no-secrets.sh',
    'scripts/check-package-contents.mjs',
    'scripts/check-shell-syntax.sh',
    'scripts/quality-gate.sh',
    'scripts/smoke-real-codex-image.mjs',
    'scripts/lib/pretty-print.sh',
  ]],
  ['ci', [
    '.github/workflows/quality-gate.yml',
  ]],
]);

for (const [category, requiredPaths] of requiredByCategory) {
  const missing = requiredPaths.filter((path) => !files.has(path));
  if (missing.length > 0) {
    fail(`package is missing required ${category} file(s):\n${missing.map((path) => `  ${path}`).join('\n')}`);
  }
}

const categoryPresenceChecks = [
  ['extension', (path) => path.startsWith('extensions/')],
  ['skill', (path) => path.startsWith('skills/')],
  ['documentation', (path) => path.startsWith('docs/')],
  ['source', (path) => path.startsWith('src/') && path.endsWith('.ts')],
  ['test', (path) => path.startsWith('test/') && path.endsWith('.test.mjs')],
  ['script', (path) => path.startsWith('scripts/')],
];
for (const [label, predicate] of categoryPresenceChecks) {
  if (![...files].some(predicate)) {
    fail(`package contains no ${label} files`);
  }
}

const forbidden = [...files].filter((path) => isForbiddenPackPath(path));
if (forbidden.length > 0) {
  fail(`package includes forbidden files:\n${forbidden.map((path) => `  ${path}`).join('\n')}`);
}

const apiKeyEnvName = 'OPENAI' + '_API_KEY';
const packedRuntimeSource = [...files]
  .filter((path) => (path.startsWith('src/') || path.startsWith('extensions/')) && /\.(?:ts|js|mjs|cjs)$/u.test(path))
  .map((path) => [path, readFileSync(path, 'utf8')]);
for (const [path, text] of packedRuntimeSource) {
  if (text.includes(apiKeyEnvName)) {
    fail(`runtime source must not reference ${apiKeyEnvName}: ${path}`);
  }
}

console.log(`pack:check passed (${files.size} files, ${pack.filename ?? 'dry run'})`);

function isForbiddenPackPath(path) {
  if (
    path.startsWith('.agent/')
    || path.startsWith('.pi/')
    || path.startsWith('.codex/')
    || path.startsWith('node_modules/')
    || path.startsWith('coverage/')
    || path.startsWith('dist/')
    || path.startsWith('build/')
    || path.startsWith('.tmp/')
    || path.startsWith('tmp/')
    || path.includes('/generated-images/')
    || path.startsWith('generated-images/')
    || path.endsWith('.tgz')
    || path.endsWith('.log')
    || /(^|\/)\.env(?:\.|$)/u.test(path)
    || /(^|\/)(?:auth|credentials?)\.json$/iu.test(path)
    || /(^|\/)(?:id_rsa|id_dsa|id_ecdsa|id_ed25519)$/u.test(path)
    || /\.(?:pem|p12|pfx|key)$/iu.test(path)
  ) {
    return true;
  }

  return false;
}
