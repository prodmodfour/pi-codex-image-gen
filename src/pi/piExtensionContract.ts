export interface PiTextContent {
  type: "text";
  text: string;
}

export interface PiImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

export type PiToolContent = PiTextContent | PiImageContent;

export interface PiToolResult<TDetails = Record<string, unknown>> {
  content: PiToolContent[];
  details?: TDetails;
}

export interface PiModelRegistry {
  getApiKeyForProvider(provider: string): Promise<string | undefined>;
  find?(provider: string, model: string): { id: string } | undefined;
}

export interface PiSessionManager {
  getSessionId(): string;
}

export interface PiToolExecutionContext {
  cwd: string;
  modelRegistry: PiModelRegistry;
  sessionManager: PiSessionManager;
}

export interface PiToolUpdate {
  content: PiToolContent[];
  details?: Record<string, unknown>;
}

export type PiToolUpdateCallback = (update: PiToolUpdate) => void;

export interface PiToolDefinition<TParams = unknown, TDetails = Record<string, unknown>> {
  name: string;
  label: string;
  description: string;
  promptSnippet?: string;
  promptGuidelines?: string[];
  parameters: unknown;
  executionMode?: "parallel" | "serial";
  execute(
    toolCallId: string,
    params: TParams,
    signal: AbortSignal | undefined,
    onUpdate: PiToolUpdateCallback | undefined,
    ctx: PiToolExecutionContext,
  ): Promise<PiToolResult<TDetails>> | PiToolResult<TDetails>;
}

export interface PiExtensionApi {
  registerTool<TParams = unknown, TDetails = Record<string, unknown>>(
    definition: PiToolDefinition<TParams, TDetails>,
  ): void;
}
