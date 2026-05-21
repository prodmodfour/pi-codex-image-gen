import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CODEX_IMAGE_GEN_DEFAULT_MODEL,
  CODEX_IMAGE_GEN_DEFAULT_OUTPUT_FORMAT,
  CODEX_IMAGE_GEN_DEFAULT_SAVE_MODE,
  CODEX_IMAGE_GEN_MAX_PROMPT_LENGTH,
  CodexImageGenValidationError,
  normalizeCodexImageGenToolInput,
  validateCodexImageGenToolInput,
} from '../src/tool/codexImageGenApi.ts';

test('normalizes required prompt and default public parameters', () => {
  const normalized = normalizeCodexImageGenToolInput({ prompt: '  a blue square icon  ' });

  assert.deepEqual(normalized, {
    prompt: 'a blue square icon',
    model: CODEX_IMAGE_GEN_DEFAULT_MODEL,
    outputFormat: CODEX_IMAGE_GEN_DEFAULT_OUTPUT_FORMAT,
    save: CODEX_IMAGE_GEN_DEFAULT_SAVE_MODE,
  });
});

test('applies configured defaults and per-call overrides', () => {
  const normalized = normalizeCodexImageGenToolInput(
    {
      prompt: 'geometric placeholder',
      outputFormat: 'WEBP',
      save: ' CUSTOM ',
    },
    {
      model: ' configured-model ',
      outputFormat: 'jpeg',
      save: 'project',
      saveDir: ' .tmp/images ',
    },
  );

  assert.deepEqual(normalized, {
    prompt: 'geometric placeholder',
    model: 'configured-model',
    outputFormat: 'webp',
    save: 'custom',
    saveDir: '.tmp/images',
  });
});

test('requires saveDir when save mode resolves to custom', () => {
  const result = validateCodexImageGenToolInput({ prompt: 'icon', save: 'custom' });

  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.path === 'saveDir' && issue.code === 'required'), true);
});

test('reports structured validation errors without echoing prompt content', () => {
  const privatePrompt = 'private prompt that should not appear in error messages';

  assert.throws(
    () => normalizeCodexImageGenToolInput({ prompt: privatePrompt, outputFormat: 'gif', extra: true }),
    (error) => {
      assert.ok(error instanceof CodexImageGenValidationError);
      assert.equal(error.code, 'CODEX_IMAGE_GEN_VALIDATION_ERROR');
      assert.equal(error.issues.some((issue) => issue.path === 'outputFormat' && issue.code === 'invalid_enum'), true);
      assert.equal(error.issues.some((issue) => issue.path === 'extra' && issue.code === 'unknown_property'), true);
      assert.equal(error.message.includes(privatePrompt), false);
      return true;
    },
  );
});

test('rejects empty and overlong prompts', () => {
  assert.equal(validateCodexImageGenToolInput({ prompt: '   ' }).ok, false);

  const tooLong = `${'x'.repeat(CODEX_IMAGE_GEN_MAX_PROMPT_LENGTH)}x`;
  const result = validateCodexImageGenToolInput({ prompt: tooLong });

  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.path === 'prompt' && issue.code === 'too_long'), true);
});

test('rejects non-object input', () => {
  const result = validateCodexImageGenToolInput(null);

  assert.equal(result.ok, false);
  assert.deepEqual(result.issues.map((issue) => issue.path), ['$']);
});
