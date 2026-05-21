import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const requiredPackFiles = [
  'extensions/codex-image-gen.ts',
  'skills/imagegen/SKILL.md',
  'docs/ARCHITECTURE.md',
  'docs/EXTENSION_SPEC.md',
  'docs/IMPLEMENTATION_GUIDE.md',
  'docs/INSTALLATION.md',
  'docs/MANUAL_VALIDATION.md',
  'docs/RELEASE.md',
  'docs/SECURITY.md',
  'docs/TROUBLESHOOTING.md',
  'docs/USAGE.md',
  'src/index.ts',
  'src/codex/CodexImageClient.ts',
  'src/pi/registerCodexImageGenTool.ts',
  'test/backend-communication.test.mjs',
  'test/pi-registration.test.mjs',
  'scripts/check-package-contents.mjs',
  'scripts/check-no-secrets.sh',
  'scripts/check-no-generated-private-files.sh',
  'scripts/check-shell-syntax.sh',
  'scripts/quality-gate.sh',
  'scripts/smoke-real-codex-image.mjs',
  '.github/workflows/quality-gate.yml',
];

function runNpmPackDryRun() {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr);
  const [pack] = JSON.parse(result.stdout);
  assert.ok(pack, 'npm pack dry-run should return a package summary');
  return new Set(pack.files.map((entry) => entry.path));
}

function isForbiddenPackPath(path) {
  return path.startsWith('.agent/')
    || path.startsWith('.pi/')
    || path.startsWith('.codex/')
    || path.startsWith('node_modules/')
    || path.startsWith('coverage/')
    || path.startsWith('dist/')
    || path.startsWith('build/')
    || path.startsWith('.tmp/')
    || path.includes('/generated-images/')
    || path.startsWith('generated-images/')
    || path.endsWith('.tgz')
    || path.endsWith('.log')
    || /(^|\/)\.env(?:\.|$)/u.test(path)
    || /(^|\/)(?:auth|credentials?)\.json$/iu.test(path)
    || /\.(?:pem|p12|pfx|key)$/iu.test(path);
}

async function collectRuntimeFiles(directory) {
  const absoluteDirectory = join(repoRoot, directory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = join(absoluteDirectory, entry.name);
    const relativePath = relative(repoRoot, absolute).replaceAll('\\', '/');
    if (entry.isDirectory()) {
      files.push(...await collectRuntimeFiles(relativePath));
    } else if (/\.(?:ts|js|mjs|cjs)$/u.test(entry.name)) {
      files.push(relativePath);
    }
  }
  return files;
}

test('package manifest includes tests and operational scripts in the npm file set', () => {
  assert.ok(packageJson.files.includes('test'));
  assert.ok(packageJson.files.includes('scripts'));
  assert.ok(packageJson.files.includes('.github/workflows'));
  assert.deepEqual(packageJson.pi.extensions, ['./extensions/codex-image-gen.ts']);
  assert.deepEqual(packageJson.pi.skills, ['./skills']);
});

test('npm pack dry-run includes required extension, skill, docs, source, tests, and scripts', () => {
  const files = runNpmPackDryRun();

  for (const requiredFile of requiredPackFiles) {
    assert.ok(files.has(requiredFile), `dry-run package missing ${requiredFile}`);
  }

  for (const prefix of ['extensions/', 'skills/', 'docs/', 'src/', 'test/', 'scripts/']) {
    assert.ok([...files].some((path) => path.startsWith(prefix)), `dry-run package missing ${prefix}`);
  }
});

test('npm pack dry-run excludes generated images, private runtime state, logs, credentials, and dependencies', () => {
  const files = runNpmPackDryRun();
  const forbidden = [...files].filter(isForbiddenPackPath);

  assert.deepEqual(forbidden, []);
});

test('pack:check script validates package contents', () => {
  const result = spawnSync('node', ['scripts/check-package-contents.mjs'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /pack:check passed/);
});

test('default runtime path has no OpenAI API-key dependency or environment fallback', async () => {
  const allDeps = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.optionalDependencies ?? {}),
    ...(packageJson.peerDependencies ?? {}),
  };
  assert.equal(Object.hasOwn(allDeps, 'openai'), false);
  assert.equal(Object.keys(allDeps).some((name) => name.startsWith('@openai/')), false);

  const apiKeyEnvName = 'OPENAI' + '_API_KEY';
  const runtimeFiles = [
    ...await collectRuntimeFiles('src'),
    ...await collectRuntimeFiles('extensions'),
  ];
  for (const runtimeFile of runtimeFiles) {
    const text = await readFile(join(repoRoot, runtimeFile), 'utf8');
    assert.equal(text.includes(apiKeyEnvName), false, `${runtimeFile} must not reference ${apiKeyEnvName}`);
  }
});
