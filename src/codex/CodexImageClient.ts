import { BACKEND_IMAGE_MODEL, CODEX_IMAGE_GEN_PROVIDER } from "../constants.ts";
import type { CodexAuthSession } from "../auth/codexAuth.ts";
import type { NormalizedCodexImageGenToolInput } from "../tool/codexImageGenApi.ts";
import { buildCodexImageRequest, type BuildCodexImageRequestOptions } from "./buildRequest.ts";
import {
  CodexSseParseError,
  CodexSseParser,
  type CodexBackendErrorInfo,
  type CodexSseParseResult,
} from "./parseSse.ts";

export type CodexImageClientErrorCode =
  | "CODEX_IMAGE_GEN_HTTP_FAILURE"
  | "CODEX_IMAGE_GEN_RATE_LIMITED"
  | "CODEX_IMAGE_GEN_BACKEND_REFUSAL"
  | "CODEX_IMAGE_GEN_MISSING_IMAGE_DATA"
  | "CODEX_IMAGE_GEN_MALFORMED_SSE"
  | "CODEX_IMAGE_GEN_CANCELLED"
  | "CODEX_IMAGE_GEN_NETWORK_FAILURE";

export interface CodexImageClientErrorDetails {
  status?: number;
  attempts?: number;
  retryable?: boolean;
  requestId?: string;
  backendErrors?: CodexBackendErrorInfo[];
}

export class CodexImageClientError extends Error {
  override readonly name = "CodexImageClientError";
  readonly code: CodexImageClientErrorCode;
  readonly details: CodexImageClientErrorDetails;

  constructor(code: CodexImageClientErrorCode, message: string, details: CodexImageClientErrorDetails = {}) {
    super(message);
    this.code = code;
    this.details = { ...details };
  }
}

export interface CodexImageClientRetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}

export interface CodexImageClientOptions {
  fetch?: typeof fetch;
  sleep?: (delayMs: number) => Promise<void>;
  random?: () => number;
  retryPolicy?: Partial<CodexImageClientRetryPolicy>;
  baseUrl?: string;
}

export interface CodexImageClientGenerateOptions {
  signal?: AbortSignal;
  sessionId?: string;
  threadId?: string;
  baseUrl?: string;
  promptCacheKey?: string;
}

export interface CodexImageGenerationResult {
  provider: typeof CODEX_IMAGE_GEN_PROVIDER;
  routingModel: string;
  backendImageModel: typeof BACKEND_IMAGE_MODEL;
  outputFormat: NormalizedCodexImageGenToolInput["outputFormat"];
  base64Image: string;
  text: string;
  responseId?: string;
  imageGenerationId?: string;
  revisedPrompt?: string;
  usage?: Record<string, unknown>;
}

export const DEFAULT_CODEX_IMAGE_CLIENT_RETRY_POLICY = Object.freeze({
  maxAttempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 2_000,
  jitterRatio: 0.2,
} satisfies CodexImageClientRetryPolicy);

export class CodexImageClient {
  private readonly fetchImpl: typeof fetch;
  private readonly sleepImpl: (delayMs: number) => Promise<void>;
  private readonly randomImpl: () => number;
  private readonly retryPolicy: CodexImageClientRetryPolicy;
  private readonly baseUrl: string | undefined;

  constructor(options: CodexImageClientOptions = {}) {
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      throw new CodexImageClientError(
        "CODEX_IMAGE_GEN_NETWORK_FAILURE",
        "No fetch implementation is available for Codex image generation.",
      );
    }

    this.fetchImpl = fetchImpl.bind(globalThis) as typeof fetch;
    this.sleepImpl = options.sleep ?? defaultSleep;
    this.randomImpl = options.random ?? Math.random;
    this.retryPolicy = normalizeRetryPolicy(options.retryPolicy);
    this.baseUrl = options.baseUrl;
  }

  async generateImage(
    input: NormalizedCodexImageGenToolInput,
    auth: CodexAuthSession,
    options: CodexImageClientGenerateOptions = {},
  ): Promise<CodexImageGenerationResult> {
    for (let attempt = 1; attempt <= this.retryPolicy.maxAttempts; attempt += 1) {
      throwIfAborted(options.signal);
      const request = buildCodexImageRequest(createBuildRequestOptions(input, auth, this.baseUrl, options));
      const init = withSignal(request.init, options.signal);

      try {
        const response = await this.fetchImpl(request.url, init);
        if (!response.ok) {
          const requestId = requestIdFromHeaders(response.headers);
          if (isRetryableStatus(response.status) && attempt < this.retryPolicy.maxAttempts) {
            await this.delayBeforeRetry(attempt, options.signal);
            continue;
          }
          throw httpError(response.status, attempt, requestId);
        }

        const parsed = await parseResponseStream(response, options.signal);
        return resultFromParsed(input, parsed);
      } catch (error) {
        if (isAbortError(error) || options.signal?.aborted === true) {
          throw new CodexImageClientError("CODEX_IMAGE_GEN_CANCELLED", "Codex image generation was cancelled.");
        }

        if (error instanceof CodexImageClientError) {
          throw error;
        }

        if (error instanceof CodexSseParseError) {
          throw new CodexImageClientError(
            "CODEX_IMAGE_GEN_MALFORMED_SSE",
            "Codex returned malformed streamed event data.",
            { attempts: attempt },
          );
        }

        if (attempt < this.retryPolicy.maxAttempts) {
          await this.delayBeforeRetry(attempt, options.signal);
          continue;
        }
      }
    }

    throw new CodexImageClientError(
      "CODEX_IMAGE_GEN_NETWORK_FAILURE",
      "Codex image generation failed due to a network or stream transport error.",
      { attempts: this.retryPolicy.maxAttempts, retryable: true },
    );
  }

  private async delayBeforeRetry(attempt: number, signal: AbortSignal | undefined): Promise<void> {
    throwIfAborted(signal);
    const exponential = this.retryPolicy.baseDelayMs * (2 ** Math.max(0, attempt - 1));
    const capped = Math.min(exponential, this.retryPolicy.maxDelayMs);
    const jitterWindow = capped * this.retryPolicy.jitterRatio;
    const jitter = jitterWindow === 0 ? 0 : (this.randomImpl() * 2 - 1) * jitterWindow;
    const delayMs = Math.max(0, Math.round(capped + jitter));
    await this.sleepImpl(delayMs);
    throwIfAborted(signal);
  }
}

function createBuildRequestOptions(
  input: NormalizedCodexImageGenToolInput,
  auth: CodexAuthSession,
  baseUrl: string | undefined,
  options: CodexImageClientGenerateOptions,
): BuildCodexImageRequestOptions {
  const requestOptions: BuildCodexImageRequestOptions = {
    input,
    auth,
  };

  const effectiveBaseUrl = options.baseUrl ?? baseUrl;
  if (effectiveBaseUrl !== undefined) {
    requestOptions.baseUrl = effectiveBaseUrl;
  }
  if (options.sessionId !== undefined) {
    requestOptions.sessionId = options.sessionId;
  }
  if (options.threadId !== undefined) {
    requestOptions.threadId = options.threadId;
  }
  if (options.promptCacheKey !== undefined) {
    requestOptions.promptCacheKey = options.promptCacheKey;
  }

  return requestOptions;
}

async function parseResponseStream(response: Response, signal: AbortSignal | undefined): Promise<CodexSseParseResult> {
  const parser = new CodexSseParser();
  for await (const chunk of iterateResponseText(response)) {
    throwIfAborted(signal);
    parser.push(chunk);
  }
  const parsed = parser.finish();

  if (parsed.errors.length > 0) {
    throw new CodexImageClientError(
      "CODEX_IMAGE_GEN_BACKEND_REFUSAL",
      "Codex did not complete image generation. The request may have been refused or blocked by account or safety limits.",
      { backendErrors: parsed.errors },
    );
  }

  if (parsed.imageGenerationCall?.result === undefined) {
    throw new CodexImageClientError(
      "CODEX_IMAGE_GEN_MISSING_IMAGE_DATA",
      "Codex completed without returning image data. Try a more explicit image-generation prompt.",
    );
  }

  return parsed;
}

async function* iterateResponseText(response: Response): AsyncGenerator<string> {
  if (response.body !== null) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (value !== undefined) {
          yield decoder.decode(value, { stream: true });
        }
      }
      const tail = decoder.decode();
      if (tail.length > 0) {
        yield tail;
      }
      return;
    } finally {
      reader.releaseLock();
    }
  }

  const text = await response.text();
  if (text.length > 0) {
    yield text;
  }
}

function resultFromParsed(
  input: NormalizedCodexImageGenToolInput,
  parsed: CodexSseParseResult,
): CodexImageGenerationResult {
  const imageCall = parsed.imageGenerationCall;
  if (imageCall === undefined) {
    throw new CodexImageClientError(
      "CODEX_IMAGE_GEN_MISSING_IMAGE_DATA",
      "Codex completed without returning image data. Try a more explicit image-generation prompt.",
    );
  }

  const result: CodexImageGenerationResult = {
    provider: CODEX_IMAGE_GEN_PROVIDER,
    routingModel: input.model,
    backendImageModel: BACKEND_IMAGE_MODEL,
    outputFormat: input.outputFormat,
    base64Image: imageCall.result,
    text: parsed.text,
  };

  if (parsed.responseId !== undefined) {
    result.responseId = parsed.responseId;
  }
  if (imageCall.id !== undefined) {
    result.imageGenerationId = imageCall.id;
  }
  if (imageCall.revisedPrompt !== undefined) {
    result.revisedPrompt = imageCall.revisedPrompt;
  }
  if (parsed.usage !== undefined) {
    result.usage = { ...parsed.usage };
  }

  return result;
}

function withSignal(init: RequestInit, signal: AbortSignal | undefined): RequestInit {
  if (signal === undefined) {
    return init;
  }
  return { ...init, signal };
}

function httpError(status: number, attempts: number, requestId: string | undefined): CodexImageClientError {
  const details: CodexImageClientErrorDetails = { status, attempts, retryable: isRetryableStatus(status) };
  if (requestId !== undefined) {
    details.requestId = requestId;
  }

  if (status === 429) {
    return new CodexImageClientError(
      "CODEX_IMAGE_GEN_RATE_LIMITED",
      "Codex rate limited image generation. Try again later or after your usage limit resets.",
      details,
    );
  }

  if (status === 401 || status === 403) {
    return new CodexImageClientError(
      "CODEX_IMAGE_GEN_HTTP_FAILURE",
      `Codex rejected openai-codex authentication (HTTP ${status}). Re-run Pi /login or check account entitlement.`,
      details,
    );
  }

  return new CodexImageClientError(
    "CODEX_IMAGE_GEN_HTTP_FAILURE",
    `Codex image generation failed with HTTP ${status}.`,
    details,
  );
}

function requestIdFromHeaders(headers: Headers): string | undefined {
  return headers.get("x-request-id") ?? headers.get("x-oai-request-id") ?? headers.get("cf-ray") ?? undefined;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new CodexImageClientError("CODEX_IMAGE_GEN_CANCELLED", "Codex image generation was cancelled.");
  }
}

function normalizeRetryPolicy(policy: Partial<CodexImageClientRetryPolicy> | undefined): CodexImageClientRetryPolicy {
  const merged = { ...DEFAULT_CODEX_IMAGE_CLIENT_RETRY_POLICY, ...policy };
  return {
    maxAttempts: Math.max(1, Math.floor(merged.maxAttempts)),
    baseDelayMs: Math.max(0, Math.floor(merged.baseDelayMs)),
    maxDelayMs: Math.max(0, Math.floor(merged.maxDelayMs)),
    jitterRatio: Math.max(0, Math.min(1, merged.jitterRatio)),
  };
}

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
