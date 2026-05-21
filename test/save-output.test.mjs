import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BACKEND_IMAGE_MODEL,
  CODEX_IMAGE_GEN_PROVIDER,
} from '../src/constants.ts';
import {
  ImageSaveError,
  resolveImageSaveTarget,
  sanitizeImageSavePathPart,
  saveGeneratedImage,
} from '../src/save/imageSave.ts';
import {
  formatCodexImageToolResult,
  getMimeTypeForOutputFormat,
} from '../src/output/formatToolResult.ts';

const imageBytes = Buffer.from('fake generated image bytes');
const imageBase64 = imageBytes.toString('base64');

async function withTempProject(fn) {
  const root = await mkdtemp(join(tmpdir(), 'pi-codex-image-gen-save-'));
  try {
    await fn({
      root,
      cwd: join(root, 'project'),
      agentDir: join(root, 'agent'),
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function assertSaved(target) {
  assert.equal(target.saved, true);
  return target;
}

test('sanitizes session ids and image ids for path parts', () => {
  assert.equal(sanitizeImageSavePathPart(' ../session one:two? ', 'session'), 'session_one_two');
  assert.equal(sanitizeImageSavePathPart('/../../', 'fallback'), 'fallback');
  assert.equal(sanitizeImageSavePathPart('image.id-123', 'image'), 'image.id-123');
});

test('resolves project, global, custom, and none save targets', async () => {
  await withTempProject(async ({ cwd, agentDir }) => {
    const projectTarget = assertSaved(resolveImageSaveTarget({
      saveMode: 'project',
      outputFormat: 'png',
      cwd,
      agentDir,
      sessionId: ' sess/one:two ',
      imageId: ' ../ig:bad? ',
    }));
    assert.equal(projectTarget.directory, join(cwd, '.pi', 'generated-images', 'sess_one_two'));
    assert.equal(projectTarget.fileName, 'ig_bad.png');
    assert.equal(projectTarget.savedPath, join(cwd, '.pi', 'generated-images', 'sess_one_two', 'ig_bad.png'));

    const globalTarget = assertSaved(resolveImageSaveTarget({
      saveMode: 'global',
      outputFormat: 'webp',
      cwd,
      agentDir,
      sessionId: 'sess-global',
    }));
    assert.equal(globalTarget.savedPath, join(agentDir, 'generated-images', 'sess-global', 'image.webp'));

    const customTarget = assertSaved(resolveImageSaveTarget({
      saveMode: 'custom',
      outputFormat: 'jpeg',
      cwd,
      agentDir,
      sessionId: 'sess-custom',
      imageId: 'ig-custom',
      saveDir: 'relative-output',
    }));
    assert.equal(customTarget.savedPath, join(cwd, 'relative-output', 'sess-custom', 'ig-custom.jpeg'));

    const noneTarget = resolveImageSaveTarget({
      saveMode: 'none',
      outputFormat: 'png',
      cwd,
      agentDir,
      sessionId: 'sess-none',
      imageId: 'ig-none',
    });
    assert.equal(noneTarget.saved, false);
    assert.equal(Object.hasOwn(noneTarget, 'savedPath'), false);
  });
});

test('writes generated images with an atomic temporary file and cleans up temp path', async () => {
  await withTempProject(async ({ cwd, agentDir }) => {
    const saved = await saveGeneratedImage({
      saveMode: 'project',
      outputFormat: 'png',
      cwd,
      agentDir,
      sessionId: 'sess-write',
      imageId: 'ig-write',
      base64Image: imageBase64,
      tempSuffix: 'test-temp',
    });

    assert.equal(saved.saved, true);
    assert.equal(saved.savedPath, join(cwd, '.pi', 'generated-images', 'sess-write', 'ig-write.png'));
    assert.equal(saved.bytesWritten, imageBytes.byteLength);
    assert.deepEqual(await readFile(saved.savedPath), imageBytes);
    assert.deepEqual(await readdir(saved.directory), ['ig-write.png']);
  });
});

test('does not write files for save=none and rejects missing custom saveDir', async () => {
  await withTempProject(async ({ cwd, agentDir }) => {
    const skipped = await saveGeneratedImage({
      saveMode: 'none',
      outputFormat: 'png',
      cwd,
      agentDir,
      sessionId: 'sess-none',
      imageId: 'ig-none',
      base64Image: imageBase64,
    });

    assert.deepEqual(skipped, {
      saved: false,
      saveMode: 'none',
      outputFormat: 'png',
      sanitizedSessionId: 'sess-none',
      sanitizedImageId: 'ig-none',
    });

    await assert.rejects(
      () => saveGeneratedImage({
        saveMode: 'custom',
        outputFormat: 'png',
        cwd,
        agentDir,
        sessionId: 'sess-custom',
        imageId: 'ig-custom',
        base64Image: imageBase64,
      }),
      (error) => {
        assert.ok(error instanceof ImageSaveError);
        assert.equal(error.code, 'CODEX_IMAGE_GEN_SAVE_DIR_REQUIRED');
        return true;
      },
    );
  });
});

test('maps output formats to image MIME types', () => {
  assert.equal(getMimeTypeForOutputFormat('png'), 'image/png');
  assert.equal(getMimeTypeForOutputFormat('jpeg'), 'image/jpeg');
  assert.equal(getMimeTypeForOutputFormat('webp'), 'image/webp');
});

test('formats Pi tool result with summary, inline image, and metadata details', () => {
  const generation = {
    provider: CODEX_IMAGE_GEN_PROVIDER,
    routingModel: 'gpt-5.5',
    backendImageModel: BACKEND_IMAGE_MODEL,
    outputFormat: 'jpeg',
    base64Image: imageBase64,
    text: 'Generated.',
    responseId: 'resp_test_1',
    imageGenerationId: 'ig_test_1',
    revisedPrompt: 'A compact test icon.',
    usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
  };
  const save = {
    saved: true,
    saveMode: 'custom',
    outputFormat: 'jpeg',
    sanitizedSessionId: 'sess',
    sanitizedImageId: 'ig_test_1',
    directory: '/tmp/pi-codex-image-gen/sess',
    fileName: 'ig_test_1.jpeg',
    savedPath: '/tmp/pi-codex-image-gen/sess/ig_test_1.jpeg',
    bytesWritten: imageBytes.byteLength,
  };

  const result = formatCodexImageToolResult({ generation, save });

  assert.equal(result.content.length, 2);
  assert.equal(result.content[0].type, 'text');
  assert.match(result.content[0].text, /Generated image via openai-codex\/gpt-5\.5/);
  assert.match(result.content[0].text, /Saved image to: \/tmp\/pi-codex-image-gen\/sess\/ig_test_1\.jpeg/);
  assert.deepEqual(result.content[1], {
    type: 'image',
    data: imageBase64,
    mimeType: 'image/jpeg',
  });
  assert.deepEqual(result.details, {
    provider: CODEX_IMAGE_GEN_PROVIDER,
    routingModel: 'gpt-5.5',
    backendImageModel: BACKEND_IMAGE_MODEL,
    outputFormat: 'jpeg',
    saveMode: 'custom',
    savedPath: '/tmp/pi-codex-image-gen/sess/ig_test_1.jpeg',
    responseId: 'resp_test_1',
    imageGenerationId: 'ig_test_1',
    revisedPrompt: 'A compact test icon.',
    usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
  });
});

test('formats save=none result without saved path details', () => {
  const generation = {
    provider: CODEX_IMAGE_GEN_PROVIDER,
    routingModel: 'gpt-5.5',
    backendImageModel: BACKEND_IMAGE_MODEL,
    outputFormat: 'png',
    base64Image: imageBase64,
    text: '',
  };
  const save = {
    saved: false,
    saveMode: 'none',
    outputFormat: 'png',
    sanitizedSessionId: 'sess-none',
    sanitizedImageId: 'ig-none',
  };

  const result = formatCodexImageToolResult({ generation, save });

  assert.equal(result.content[0].type, 'text');
  assert.match(result.content[0].text, /no image file was written/);
  assert.equal(result.content[1].mimeType, 'image/png');
  assert.equal(Object.hasOwn(result.details, 'savedPath'), false);
  assert.equal(result.details.saveMode, 'none');
});
