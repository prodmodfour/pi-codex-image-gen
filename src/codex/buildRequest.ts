import {
  BACKEND_IMAGE_MODEL,
  CODEX_IMAGE_GEN_PROVIDER,
  CODEX_IMAGE_GEN_TOOL_NAME,
  PACKAGE_NAME,
} from "../constants.ts";
import type { CodexAuthSession } from "../auth/codexAuth.ts";
import type {
  CodexImageGenOutputFormat,
  NormalizedCodexImageGenToolInput,
} from "../tool/codexImageGenApi.ts";

export const CODEX_RESPONSES_BASE_URL = "https://chatgpt.com/backend-api/codex" as const;
export const CODEX_RESPONSES_PATH = "responses" as const;
export const CODEX_IMAGE_GEN_USER_AGENT = `${PACKAGE_NAME}/0.0.0` as const;

export const CODEX_IMAGE_GENERATION_INSTRUCTIONS = [
  "You generate exactly one bitmap image for the user's explicit image prompt.",
  "Use the hosted image_generation tool once. Do not use shell commands or external URLs.",
  "After the image tool call, keep any text response concise.",
].join(" ");

export interface CodexImageGenerationToolRequest {
  type: "image_generation";
  model: typeof BACKEND_IMAGE_MODEL;
  output_format: CodexImageGenOutputFormat;
  action: "generate";
}

export interface CodexResponsesMessageInput {
  type: "message";
  role: "user";
  content: Array<{
    type: "input_text";
    text: string;
  }>;
}

export interface CodexResponsesRequestBody {
  model: string;
  instructions: string;
  input: CodexResponsesMessageInput[];
  tools: CodexImageGenerationToolRequest[];
  tool_choice: "auto";
  parallel_tool_calls: false;
  reasoning: null;
  store: false;
  stream: true;
  include: string[];
  text: {
    verbosity: "low";
  };
  prompt_cache_key?: string;
  client_metadata?: Record<string, string>;
}

export interface BuildCodexImageRequestOptions {
  input: NormalizedCodexImageGenToolInput;
  auth: Pick<CodexAuthSession, "bearerToken" | "accountId">;
  baseUrl?: string;
  sessionId?: string;
  threadId?: string;
  promptCacheKey?: string;
}

export interface BuiltCodexImageRequest {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: CodexResponsesRequestBody;
  init: RequestInit;
}

export function buildCodexImageRequest(options: BuildCodexImageRequestOptions): BuiltCodexImageRequest {
  const url = `${normalizeBaseUrl(options.baseUrl ?? CODEX_RESPONSES_BASE_URL)}/${CODEX_RESPONSES_PATH}`;
  const sessionId = normalizeRequestHeaderValue(options.sessionId);
  const threadId = normalizeRequestHeaderValue(options.threadId);
  const requestId = threadId ?? sessionId;
  const promptCacheKey = normalizePromptCacheKey(options.promptCacheKey ?? createPromptCacheKey(sessionId));

  const body: CodexResponsesRequestBody = {
    model: options.input.model,
    instructions: CODEX_IMAGE_GENERATION_INSTRUCTIONS,
    input: [
      {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: options.input.prompt }],
      },
    ],
    tools: [
      {
        type: "image_generation",
        model: BACKEND_IMAGE_MODEL,
        output_format: options.input.outputFormat,
        action: "generate",
      },
    ],
    tool_choice: "auto",
    parallel_tool_calls: false,
    reasoning: null,
    store: false,
    stream: true,
    include: [],
    text: { verbosity: "low" },
    client_metadata: {
      provider: CODEX_IMAGE_GEN_PROVIDER,
      package: PACKAGE_NAME,
      tool: CODEX_IMAGE_GEN_TOOL_NAME,
      backend_image_model: BACKEND_IMAGE_MODEL,
    },
  };

  if (promptCacheKey !== undefined) {
    body.prompt_cache_key = promptCacheKey;
  }

  const headers: Record<string, string> = {
    accept: "text/event-stream",
    authorization: `Bearer ${options.auth.bearerToken}`,
    "content-type": "application/json",
    "user-agent": CODEX_IMAGE_GEN_USER_AGENT,
    "ChatGPT-Account-Id": options.auth.accountId,
  };

  if (requestId !== undefined) {
    headers["x-client-request-id"] = requestId;
  }
  if (sessionId !== undefined) {
    headers.session_id = sessionId;
    headers["session-id"] = sessionId;
  }
  if (threadId !== undefined) {
    headers.thread_id = threadId;
    headers["thread-id"] = threadId;
  }

  return {
    url,
    method: "POST",
    headers,
    body,
    init: {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    },
  };
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return CODEX_RESPONSES_BASE_URL;
  }
  return trimmed.replace(/\/+$/u, "");
}

function normalizeRequestHeaderValue(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 256 || /[\u0000-\u001f\u007f]/u.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}

function normalizePromptCacheKey(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 128 || /[\u0000-\u001f\u007f]/u.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}

function createPromptCacheKey(sessionId: string | undefined): string | undefined {
  if (sessionId === undefined) {
    return undefined;
  }
  return `${PACKAGE_NAME}:${sessionId.replace(/[^A-Za-z0-9_.:-]/gu, "_").slice(0, 96)}`;
}
