export type CodexSseParseErrorCode = "CODEX_IMAGE_GEN_MALFORMED_SSE";

export interface CodexBackendErrorInfo {
  eventType?: string;
  code?: string;
  status?: string;
  message?: string;
}

export interface CodexImageGenerationCall {
  id?: string;
  status?: string;
  result: string;
  revisedPrompt?: string;
}

export interface CodexSseParseResult {
  responseId?: string;
  textDeltas: string[];
  text: string;
  usage?: Record<string, unknown>;
  imageGenerationCall?: CodexImageGenerationCall;
  errors: CodexBackendErrorInfo[];
  eventsProcessed: number;
}

export class CodexSseParseError extends Error {
  override readonly name = "CodexSseParseError";
  readonly code: CodexSseParseErrorCode = "CODEX_IMAGE_GEN_MALFORMED_SSE";
  readonly eventIndex: number;

  constructor(message: string, eventIndex: number) {
    super(message);
    this.eventIndex = eventIndex;
  }
}

export class CodexSseParser {
  private readonly decoder = new TextDecoder();
  private buffer = "";
  private readonly textDeltas: string[] = [];
  private readonly errors: CodexBackendErrorInfo[] = [];
  private responseId: string | undefined;
  private usage: Record<string, unknown> | undefined;
  private imageGenerationCall: CodexImageGenerationCall | undefined;
  private eventsProcessed = 0;

  push(chunk: string | Uint8Array): CodexSseParseResult {
    this.buffer += typeof chunk === "string" ? chunk : this.decoder.decode(chunk, { stream: true });
    this.buffer = normalizeLineEndings(this.buffer);
    this.processBufferedEvents(false);
    return this.snapshot();
  }

  finish(): CodexSseParseResult {
    const tail = this.decoder.decode();
    if (tail.length > 0) {
      this.buffer += tail;
      this.buffer = normalizeLineEndings(this.buffer);
    }
    this.processBufferedEvents(true);
    return this.snapshot();
  }

  private processBufferedEvents(flush: boolean): void {
    while (true) {
      const separatorIndex = this.buffer.indexOf("\n\n");
      if (separatorIndex === -1) {
        break;
      }

      const block = this.buffer.slice(0, separatorIndex);
      this.buffer = this.buffer.slice(separatorIndex + 2);
      this.processEventBlock(block);
    }

    if (flush && this.buffer.trim().length > 0) {
      const block = this.buffer;
      this.buffer = "";
      this.processEventBlock(block);
    }
  }

  private processEventBlock(block: string): void {
    const event = parseEventBlock(block);
    if (event === undefined) {
      return;
    }

    const trimmedData = event.data.trim();
    if (trimmedData === "[DONE]") {
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(event.data) as unknown;
    } catch {
      throw new CodexSseParseError("Malformed Codex SSE event JSON.", this.eventsProcessed + 1);
    }

    if (!isRecord(payload)) {
      throw new CodexSseParseError("Malformed Codex SSE event payload.", this.eventsProcessed + 1);
    }

    this.eventsProcessed += 1;
    this.applyPayload(payload, event.event);
  }

  private applyPayload(payload: Record<string, unknown>, sseEventName: string | undefined): void {
    const eventType = stringValue(payload.type) ?? sseEventName;

    this.captureResponseMetadata(payload);
    this.captureTextDelta(payload, eventType);
    this.captureBackendError(payload, eventType);
    this.captureImageGenerationCall(payload);
  }

  private captureResponseMetadata(payload: Record<string, unknown>): void {
    const response = getRecord(payload.response);
    const id = stringValue(response?.id) ?? stringValue(payload.response_id) ?? stringValue(payload.id);
    if (id !== undefined && (stringValue(payload.type)?.startsWith("response.") ?? response !== undefined)) {
      this.responseId = id;
    }

    const usage = getRecord(response?.usage) ?? getRecord(payload.usage);
    if (usage !== undefined) {
      this.usage = cloneJsonRecord(usage);
    }

    const outputs = getArray(response?.output) ?? getArray(payload.output);
    if (outputs !== undefined) {
      for (const item of outputs) {
        this.captureImageCandidate(item);
      }
    }
  }

  private captureTextDelta(payload: Record<string, unknown>, eventType: string | undefined): void {
    if (eventType === undefined) {
      return;
    }

    const isTextDelta = eventType === "response.output_text.delta" || eventType === "response.text.delta";
    if (!isTextDelta) {
      return;
    }

    const delta = stringValue(payload.delta) ?? stringValue(payload.text);
    if (delta !== undefined) {
      this.textDeltas.push(delta);
    }
  }

  private captureBackendError(payload: Record<string, unknown>, eventType: string | undefined): void {
    const error = getRecord(payload.error);
    const response = getRecord(payload.response);
    const status = stringValue(payload.status) ?? stringValue(response?.status);
    const responseError = getRecord(response?.error);
    const maybeError = error ?? responseError;

    const failedType = eventType === "error" || eventType === "response.failed" || status === "failed" || status === "incomplete";
    if (!failedType && maybeError === undefined) {
      return;
    }

    const info: CodexBackendErrorInfo = {};
    if (eventType !== undefined) {
      info.eventType = eventType;
    }
    const code = stringValue(maybeError?.code) ?? stringValue(payload.code);
    if (code !== undefined) {
      info.code = code;
    }
    if (status !== undefined) {
      info.status = status;
    }
    const message = sanitizeBackendMessage(stringValue(maybeError?.message) ?? stringValue(payload.message));
    if (message !== undefined) {
      info.message = message;
    }

    this.errors.push(info);
  }

  private captureImageGenerationCall(payload: Record<string, unknown>): void {
    this.captureImageCandidate(payload.item);
    this.captureImageCandidate(payload);
  }

  private captureImageCandidate(candidate: unknown): void {
    if (!isRecord(candidate) || candidate.type !== "image_generation_call") {
      return;
    }

    const result = stringValue(candidate.result);
    const status = stringValue(candidate.status);
    if (result === undefined || result.length === 0) {
      if (status === "failed" || status === "incomplete") {
        this.errors.push({ eventType: "response.output_item.done", status });
      }
      return;
    }

    const imageCall: CodexImageGenerationCall = { result };
    const id = stringValue(candidate.id);
    if (id !== undefined) {
      imageCall.id = id;
    }
    if (status !== undefined) {
      imageCall.status = status;
    }
    const revisedPrompt = stringValue(candidate.revised_prompt) ?? stringValue(candidate.revisedPrompt);
    if (revisedPrompt !== undefined) {
      imageCall.revisedPrompt = revisedPrompt;
    }

    this.imageGenerationCall = imageCall;
  }

  private snapshot(): CodexSseParseResult {
    const result: CodexSseParseResult = {
      textDeltas: [...this.textDeltas],
      text: this.textDeltas.join(""),
      errors: this.errors.map((error) => ({ ...error })),
      eventsProcessed: this.eventsProcessed,
    };

    if (this.responseId !== undefined) {
      result.responseId = this.responseId;
    }
    if (this.usage !== undefined) {
      result.usage = cloneJsonRecord(this.usage);
    }
    if (this.imageGenerationCall !== undefined) {
      result.imageGenerationCall = { ...this.imageGenerationCall };
    }

    return result;
  }
}

export function parseCodexImageSse(chunks: Iterable<string | Uint8Array>): CodexSseParseResult {
  const parser = new CodexSseParser();
  for (const chunk of chunks) {
    parser.push(chunk);
  }
  return parser.finish();
}

function parseEventBlock(block: string): { event?: string; data: string } | undefined {
  const dataLines: string[] = [];
  let eventName: string | undefined;

  for (const line of block.split("\n")) {
    if (line.length === 0 || line.startsWith(":")) {
      continue;
    }

    const colonIndex = line.indexOf(":");
    const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
    const rawValue = colonIndex === -1 ? "" : line.slice(colonIndex + 1);
    const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;

    if (field === "event") {
      eventName = value;
    } else if (field === "data") {
      dataLines.push(value);
    }
  }

  if (dataLines.length === 0) {
    return undefined;
  }

  const event: { event?: string; data: string } = { data: dataLines.join("\n") };
  if (eventName !== undefined) {
    event.event = eventName;
  }
  return event;
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/gu, "\n").replace(/\r/gu, "\n");
}

function sanitizeBackendMessage(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const compact = value.replace(/\s+/gu, " ").trim();
  if (compact.length === 0) {
    return undefined;
  }

  return compact.length > 240 ? `${compact.slice(0, 237)}...` : compact;
}

function cloneJsonRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function getArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
