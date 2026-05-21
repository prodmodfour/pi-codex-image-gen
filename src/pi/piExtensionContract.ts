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

export interface PiExtensionUi {
  notify(message: string, type?: "info" | "warning" | "error"): void;
}

export interface PiToolExecutionContext {
  cwd: string;
  agentDir?: string;
  getAgentDir?: () => string | undefined;
  hasUI?: boolean;
  ui?: PiExtensionUi;
  modelRegistry: PiModelRegistry;
  sessionManager: PiSessionManager;
}

export interface PiCommandContext extends PiToolExecutionContext {
  waitForIdle?(): Promise<void>;
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
  executionMode?: "parallel" | "sequential";
  execute(
    toolCallId: string,
    params: TParams,
    signal: AbortSignal | undefined,
    onUpdate: PiToolUpdateCallback | undefined,
    ctx: PiToolExecutionContext,
  ): Promise<PiToolResult<TDetails>> | PiToolResult<TDetails>;
}

export interface PiCommandDefinition {
  description?: string;
  handler(args: string, ctx: PiCommandContext): Promise<void> | void;
}

export interface PiMessageOptions {
  triggerTurn?: boolean;
  deliverAs?: "steer" | "followUp" | "nextTurn";
}

export interface PiCustomMessage<TDetails = Record<string, unknown>> {
  customType: string;
  content: string | PiToolContent[];
  display: boolean;
  details?: TDetails;
}

export interface PiExtensionApi {
  registerTool<TParams = unknown, TDetails = Record<string, unknown>>(
    definition: PiToolDefinition<TParams, TDetails>,
  ): void;
  registerCommand?(name: string, definition: PiCommandDefinition): void;
  sendMessage?<TDetails = Record<string, unknown>>(
    message: PiCustomMessage<TDetails>,
    options?: PiMessageOptions,
  ): void;
}
