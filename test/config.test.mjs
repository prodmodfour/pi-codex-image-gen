import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CODEX_IMAGE_GEN_CONFIG_FILE_NAME,
  CODEX_IMAGE_GEN_ENV_MODEL,
  CODEX_IMAGE_GEN_ENV_SAVE_DIR,
  CODEX_IMAGE_GEN_ENV_SAVE_MODE,
  CodexImageGenConfigError,
  createCodexImageGenInputDefaults,
  loadCodexImageGenConfig,
} from '../src/config/codexImageGenConfig.ts';
import {
  CODEX_IMAGE_GEN_DEFAULT_MODEL,
  CODEX_IMAGE_GEN_DEFAULT_SAVE_MODE,
  normalizeCodexImageGenToolInput,
} from '../src/tool/codexImageGenApi.ts';

async function withTempDirs(fn) {
  const root = await mkdtemp(join(tmpdir(), 'pi-codex-image-gen-config-'));
  try {
    const cwd = join(root, 'project');
    const agentDir = join(root, 'agent');
    await mkdir(cwd, { recursive: true });
    await mkdir(agentDir, { recursive: true });
    await fn({ root, cwd, agentDir });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function writeJson(path, value) {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('loads default config without reading credential files', async () => {
  await withTempDirs(async ({ cwd, agentDir }) => {
    const loaded = await loadCodexImageGenConfig({ cwd, agentDir, env: {} });

    assert.equal(loaded.config.model, CODEX_IMAGE_GEN_DEFAULT_MODEL);
    assert.equal(loaded.config.saveMode, CODEX_IMAGE_GEN_DEFAULT_SAVE_MODE);
    assert.equal(loaded.config.saveDir, undefined);
    assert.deepEqual(loaded.loadedFiles, []);
    assert.match(loaded.paths.globalPath, /extensions\/codex-image-gen\.json$/);
    assert.match(loaded.paths.projectPath, /\.pi\/extensions\/codex-image-gen\.json$/);
  });
});

test('merges config with defaults, global, project, then environment precedence', async () => {
  await withTempDirs(async ({ cwd, agentDir }) => {
    const globalPath = join(agentDir, 'extensions', CODEX_IMAGE_GEN_CONFIG_FILE_NAME);
    const projectPath = join(cwd, '.pi', 'extensions', CODEX_IMAGE_GEN_CONFIG_FILE_NAME);

    await writeJson(globalPath, {
      model: 'global-model',
      saveMode: 'project',
      saveDir: 'global-dir',
    });
    await writeJson(projectPath, {
      model: 'project-model',
      saveMode: 'none',
    });

    const loaded = await loadCodexImageGenConfig({
      cwd,
      agentDir,
      env: {
        [CODEX_IMAGE_GEN_ENV_MODEL]: ' env-model ',
        [CODEX_IMAGE_GEN_ENV_SAVE_MODE]: ' CUSTOM ',
        [CODEX_IMAGE_GEN_ENV_SAVE_DIR]: ' env-dir ',
      },
    });

    assert.deepEqual(loaded.config, {
      model: 'env-model',
      saveMode: 'custom',
      saveDir: 'env-dir',
    });
    assert.deepEqual(loaded.loadedFiles, [globalPath, projectPath]);
  });
});

test('turns loaded config into tool input defaults', async () => {
  await withTempDirs(async ({ cwd, agentDir }) => {
    const projectPath = join(cwd, '.pi', 'extensions', CODEX_IMAGE_GEN_CONFIG_FILE_NAME);
    await writeJson(projectPath, {
      model: 'configured-model',
      saveMode: 'custom',
      saveDir: 'relative-output',
    });

    const loaded = await loadCodexImageGenConfig({ cwd, agentDir, env: {} });
    const normalized = normalizeCodexImageGenToolInput(
      { prompt: 'small test badge' },
      createCodexImageGenInputDefaults(loaded.config),
    );

    assert.equal(normalized.model, 'configured-model');
    assert.equal(normalized.save, 'custom');
    assert.equal(normalized.saveDir, 'relative-output');
  });
});

test('throws actionable errors for invalid config values', async () => {
  await withTempDirs(async ({ cwd, agentDir }) => {
    const projectPath = join(cwd, '.pi', 'extensions', CODEX_IMAGE_GEN_CONFIG_FILE_NAME);
    await writeJson(projectPath, {
      model: '',
      saveMode: 'gallery',
      unknown: true,
    });

    await assert.rejects(
      () => loadCodexImageGenConfig({ cwd, agentDir, env: {} }),
      (error) => {
        assert.ok(error instanceof CodexImageGenConfigError);
        assert.equal(error.code, 'CODEX_IMAGE_GEN_CONFIG_ERROR');
        assert.equal(error.issues.some((issue) => issue.path === 'model' && issue.code === 'empty'), true);
        assert.equal(error.issues.some((issue) => issue.path === 'saveMode' && issue.code === 'invalid_enum'), true);
        assert.equal(error.issues.some((issue) => issue.path === 'unknown' && issue.code === 'unknown_property'), true);
        return true;
      },
    );
  });
});

test('throws actionable errors for invalid environment overrides', async () => {
  await withTempDirs(async ({ cwd, agentDir }) => {
    await assert.rejects(
      () => loadCodexImageGenConfig({
        cwd,
        agentDir,
        env: {
          [CODEX_IMAGE_GEN_ENV_SAVE_MODE]: 'elsewhere',
          [CODEX_IMAGE_GEN_ENV_SAVE_DIR]: '',
        },
      }),
      (error) => {
        assert.ok(error instanceof CodexImageGenConfigError);
        assert.equal(error.issues.some((issue) => issue.path === CODEX_IMAGE_GEN_ENV_SAVE_MODE), true);
        assert.equal(error.issues.some((issue) => issue.path === CODEX_IMAGE_GEN_ENV_SAVE_DIR), true);
        assert.equal(error.message.includes('elsewhere'), false);
        return true;
      },
    );
  });
});
