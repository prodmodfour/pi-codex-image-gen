import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BACKEND_IMAGE_MODEL,
  CODEX_IMAGE_GEN_PROVIDER,
} from '../src/constants.ts';
import {
  CodexAuthError,
  resolveCodexAuth,
} from '../src/auth/codexAuth.ts';
import {
  CODEX_RESPONSES_BASE_URL,
  buildCodexImageRequest,
} from '../src/codex/buildRequest.ts';
import {
  CodexSseParseError,
  parseCodexImageSse,
} from '../src/codex/parseSse.ts';
import {
  CodexImageClient,
  CodexImageClientError,
} from '../src/codex/CodexImageClient.ts';

const imageBase64 = Buffer.from('fake image bytes').toString('base64');

const normalizedInput = Object.freeze({
  prompt: 'small blue square icon, no text',
  model: 'gpt-5.5',
  outputFormat: 'png',
  save: 'none',
});

function fakeJwt(claims) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = Buffer.from('signature').toString('base64url');
  return `${header}.${payload}.${signature}`;
}

function fakeAuth(overrides = {}) {
  return resolveCodexAuth({
    token: fakeJwt({
      sub: 'user_123',
      exp: 4_102_444_800,
      iat: 1_700_000_000,
      'https://api.openai.com/auth': {
        chatgpt_account_id: 'acct_test_123',
        chatgpt_user_id: 'chatgpt_user_123',
        chatgpt_plan_type: 'pro',
      },
    }),
    ...overrides,
  });
}

function sseEvent(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function successSse() {
  return [
    sseEvent({ type: 'response.created', response: { id: 'resp_test_1' } }),
    sseEvent({ type: 'response.output_text.delta', delta: 'Generated.' }),
    sseEvent({
      type: 'response.output_item.done',
      item: {
        id: 'ig_test_1',
        type: 'image_generation_call',
        status: 'completed',
        result: imageBase64,
        revised_prompt: 'A compact blue square icon with no text.',
      },
    }),
    sseEvent({
      type: 'response.completed',
      response: {
        id: 'resp_test_1',
        usage: { input_tokens: 11, output_tokens: 22, total_tokens: 33 },
      },
    }),
    'data: [DONE]\n\n',
  ].join('');
}

function responseFromChunks(chunks, init = {}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: init.status ?? 200,
    headers: init.headers ?? { 'content-type': 'text/event-stream' },
  });
}

test('extracts in-memory Codex bearer token and ChatGPT account metadata', () => {
  const auth = fakeAuth();

  assert.equal(auth.provider, CODEX_IMAGE_GEN_PROVIDER);
  assert.equal(auth.accountId, 'acct_test_123');
  assert.equal(auth.claims.chatgptUserId, 'chatgpt_user_123');
  assert.equal(auth.claims.chatgptPlanType, 'pro');
  assert.equal(auth.claims.expiresAt, 4_102_444_800);
  assert.equal(auth.bearerToken.split('.').length, 3);
});

test('rejects missing or malformed auth without exposing token material', () => {
  assert.throws(
    () => resolveCodexAuth(undefined),
    (error) => {
      assert.ok(error instanceof CodexAuthError);
      assert.equal(error.code, 'CODEX_IMAGE_GEN_MISSING_AUTH');
      return true;
    },
  );

  const opaqueToken = 'opaque-token-without-claims';
  assert.throws(
    () => resolveCodexAuth(opaqueToken),
    (error) => {
      assert.ok(error instanceof CodexAuthError);
      assert.equal(error.code, 'CODEX_IMAGE_GEN_MALFORMED_AUTH');
      assert.equal(error.message.includes(opaqueToken), false);
      return true;
    },
  );
});

test('builds current Codex Responses image-generation request shape', () => {
  const auth = fakeAuth();
  const request = buildCodexImageRequest({
    input: normalizedInput,
    auth,
    sessionId: 'sess_test',
    threadId: 'thread_test',
  });

  assert.equal(request.url, `${CODEX_RESPONSES_BASE_URL}/responses`);
  assert.equal(request.method, 'POST');
  assert.equal(request.headers.authorization, `Bearer ${auth.bearerToken}`);
  assert.equal(request.headers['ChatGPT-Account-Id'], 'acct_test_123');
  assert.equal(request.headers.accept, 'text/event-stream');
  assert.equal(request.headers.session_id, 'sess_test');
  assert.equal(request.headers['session-id'], 'sess_test');
  assert.equal(request.headers.thread_id, 'thread_test');
  assert.equal(request.headers['thread-id'], 'thread_test');
  assert.equal(request.headers['x-client-request-id'], 'thread_test');
  assert.equal(request.body.model, 'gpt-5.5');
  assert.equal(request.body.store, false);
  assert.equal(request.body.stream, true);
  assert.deepEqual(request.body.input[0].content, [{ type: 'input_text', text: normalizedInput.prompt }]);
  assert.deepEqual(request.body.tools, [{
    type: 'image_generation',
    model: BACKEND_IMAGE_MODEL,
    output_format: 'png',
    action: 'generate',
  }]);
  assert.equal(JSON.parse(request.init.body).tools[0].model, BACKEND_IMAGE_MODEL);
});

test('parses split SSE chunks with text, usage, response id, and final image call', () => {
  const stream = successSse();
  const parsed = parseCodexImageSse([
    stream.slice(0, 23),
    stream.slice(23, 137),
    stream.slice(137),
  ]);

  assert.equal(parsed.responseId, 'resp_test_1');
  assert.equal(parsed.text, 'Generated.');
  assert.equal(parsed.imageGenerationCall?.id, 'ig_test_1');
  assert.equal(parsed.imageGenerationCall?.result, imageBase64);
  assert.equal(parsed.imageGenerationCall?.revisedPrompt, 'A compact blue square icon with no text.');
  assert.deepEqual(parsed.usage, { input_tokens: 11, output_tokens: 22, total_tokens: 33 });
  assert.equal(parsed.errors.length, 0);
});

test('reports malformed SSE JSON with a structured parser error', () => {
  assert.throws(
    () => parseCodexImageSse(['data: {"type": "response.created"\n\n']),
    (error) => {
      assert.ok(error instanceof CodexSseParseError);
      assert.equal(error.code, 'CODEX_IMAGE_GEN_MALFORMED_SSE');
      assert.equal(error.eventIndex, 1);
      return true;
    },
  );
});

test('CodexImageClient returns generated image metadata from fake streamed response', async () => {
  const calls = [];
  const client = new CodexImageClient({
    fetch: async (url, init) => {
      calls.push({ url, init });
      const stream = successSse();
      return responseFromChunks([stream.slice(0, 50), stream.slice(50)]);
    },
    retryPolicy: { maxAttempts: 1, jitterRatio: 0 },
  });

  const result = await client.generateImage(normalizedInput, fakeAuth(), { sessionId: 'sess_test' });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${CODEX_RESPONSES_BASE_URL}/responses`);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(result.provider, CODEX_IMAGE_GEN_PROVIDER);
  assert.equal(result.routingModel, 'gpt-5.5');
  assert.equal(result.backendImageModel, BACKEND_IMAGE_MODEL);
  assert.equal(result.outputFormat, 'png');
  assert.equal(result.responseId, 'resp_test_1');
  assert.equal(result.imageGenerationId, 'ig_test_1');
  assert.equal(result.base64Image, imageBase64);
  assert.equal(result.text, 'Generated.');
  assert.deepEqual(result.usage, { input_tokens: 11, output_tokens: 22, total_tokens: 33 });
});

test('CodexImageClient retries transient 429 responses before parsing success', async () => {
  const sleeps = [];
  let attempts = 0;
  const client = new CodexImageClient({
    fetch: async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response('rate limited', { status: 429, headers: { 'x-request-id': 'req_rate' } });
      }
      return responseFromChunks([successSse()]);
    },
    sleep: async (delayMs) => { sleeps.push(delayMs); },
    retryPolicy: { maxAttempts: 2, baseDelayMs: 25, jitterRatio: 0 },
  });

  const result = await client.generateImage(normalizedInput, fakeAuth());

  assert.equal(attempts, 2);
  assert.deepEqual(sleeps, [25]);
  assert.equal(result.base64Image, imageBase64);
});

test('CodexImageClient does not retry non-retryable 401/403 auth failures', async () => {
  let attempts = 0;
  const client = new CodexImageClient({
    fetch: async () => {
      attempts += 1;
      return new Response('unauthorized', { status: 401, headers: { 'x-request-id': 'req_auth' } });
    },
    retryPolicy: { maxAttempts: 3, jitterRatio: 0 },
  });

  await assert.rejects(
    () => client.generateImage(normalizedInput, fakeAuth()),
    (error) => {
      assert.ok(error instanceof CodexImageClientError);
      assert.equal(error.code, 'CODEX_IMAGE_GEN_HTTP_FAILURE');
      assert.equal(error.details.status, 401);
      assert.equal(error.details.requestId, 'req_auth');
      return true;
    },
  );
  assert.equal(attempts, 1);
});

test('CodexImageClient throws sanitized errors for backend refusal and no-image success', async () => {
  const refusalClient = new CodexImageClient({
    fetch: async () => responseFromChunks([
      sseEvent({
        type: 'response.failed',
        response: {
          id: 'resp_refused',
          status: 'failed',
          error: { code: 'policy_refusal', message: 'Refused by fake policy.' },
        },
      }),
      'data: [DONE]\n\n',
    ]),
    retryPolicy: { maxAttempts: 1, jitterRatio: 0 },
  });

  await assert.rejects(
    () => refusalClient.generateImage(normalizedInput, fakeAuth()),
    (error) => {
      assert.ok(error instanceof CodexImageClientError);
      assert.equal(error.code, 'CODEX_IMAGE_GEN_BACKEND_REFUSAL');
      assert.equal(error.details.backendErrors[0].code, 'policy_refusal');
      return true;
    },
  );

  const noImageClient = new CodexImageClient({
    fetch: async () => responseFromChunks([
      sseEvent({ type: 'response.output_text.delta', delta: 'I cannot make an image.' }),
      sseEvent({ type: 'response.completed', response: { id: 'resp_no_image' } }),
      'data: [DONE]\n\n',
    ]),
    retryPolicy: { maxAttempts: 1, jitterRatio: 0 },
  });

  await assert.rejects(
    () => noImageClient.generateImage(normalizedInput, fakeAuth()),
    (error) => {
      assert.ok(error instanceof CodexImageClientError);
      assert.equal(error.code, 'CODEX_IMAGE_GEN_MISSING_IMAGE_DATA');
      assert.equal(error.message.includes(normalizedInput.prompt), false);
      return true;
    },
  );
});

test('CodexImageClient reports cancellation without making a backend request', async () => {
  const controller = new AbortController();
  controller.abort();
  let attempts = 0;
  const client = new CodexImageClient({
    fetch: async () => {
      attempts += 1;
      return responseFromChunks([successSse()]);
    },
  });

  await assert.rejects(
    () => client.generateImage(normalizedInput, fakeAuth(), { signal: controller.signal }),
    (error) => {
      assert.ok(error instanceof CodexImageClientError);
      assert.equal(error.code, 'CODEX_IMAGE_GEN_CANCELLED');
      return true;
    },
  );
  assert.equal(attempts, 0);
});
