import {
  BACKEND_IMAGE_MODEL,
  CODEX_IMAGE_GEN_PROVIDER,
  CODEX_IMAGE_GEN_TOOL_NAME,
} from "../constants.ts";
import { resolveCodexAuth, CodexAuthError, type CodexAuthSession } from "../auth/codexAuth.ts";
import { CodexImageClient, type CodexImageClientGenerateOptions, type CodexImageGenerationResult } from "../codex/CodexImageClient.ts";
import {
  createCodexImageGenInputDefaults,
  getDefaultPiAgentDir,
  loadCodexImageGenConfig,
  type CodexImageGenConfigLoadOptions,
  type CodexImageGenLoadedConfig,
} from "../config/codexImageGenConfig.ts";
import {
  formatCodexImageToolResult,
  type CodexImageGenToolResultDetails,
} from "../output/formatToolResult.ts";
import { saveGeneratedImage, type ImageSaveResult, type SaveGeneratedImageOptions } from "../save/imageSave.ts";
import {
  CODEX_IMAGE_GEN_TOOL_DESCRIPTION,
  CODEX_IMAGE_GEN_TOOL_PARAMETERS,
  normalizeCodexImageGenToolInput,
  type CodexImageGenToolInput,
  type NormalizedCodexImageGenToolInput,
} from "../tool/codexImageGenApi.ts";
import type {
  PiCommandContext,
  PiExtensionApi,
  PiToolDefinition,
  PiToolExecutionContext,
  PiToolResult,
} from "./piExtensionContract.ts";

export const CODEX_IMAGE_GEN_TOOL_LABEL = "Codex Image" as const;
export const CODEX_IMAGE_GEN_TOOL_PROMPT_SNIPPET =
  "Generate bitmap images through Codex image generation when the user explicitly asks for an image." as const;
export const CODEX_IMAGE_GEN_TOOL_PROMPT_GUIDELINES = [
  "Use codex_generate_image only for explicit image-generation requests, because it consumes the user's Codex image quota.",
  "Do not use codex_generate_image for web search, code generation, text-only answers, or generic file creation.",
] as const;
export const CODEX_IMAGE_GEN_HELP_COMMAND_NAME = "codex-image-gen" as const;
export const CODEX_IMAGE_GEN_HELP_TEXT = [
  "codex_generate_image generates one bitmap image through Pi's openai-codex ChatGPT/Codex auth.",
  "Parameters: prompt (required), model, outputFormat png|jpeg|webp, save none|project|global|custom, saveDir for custom saves.",
  "Defaults come from codex-image-gen config; the built-in save default is global.",
  "Use save=none for inline-only previews, save=project for workspace assets, and save=custom only with a configured directory.",
  "Image generation consumes Codex/ChatGPT usage and cannot bypass account, rate, workspace, entitlement, or safety limits.",
].join("\n");

export type CodexImageGenToolDetails = CodexImageGenToolResultDetails;

export interface CodexImageClientLike {
  generateImage(
    input: NormalizedCodexImageGenToolInput,
    auth: CodexAuthSession,
    options?: CodexImageClientGenerateOptions,
  ): Promise<CodexImageGenerationResult>;
}

export interface CodexImageGenToolRuntimeOptions {
  client?: CodexImageClientLike;
  createClient?: () => CodexImageClientLike;
  loadConfig?: (options: CodexImageGenConfigLoadOptions) => Promise<CodexImageGenLoadedConfig>;
  getProviderAuth?: (ctx: PiToolExecutionContext) => Promise<unknown> | unknown;
  resolveAuth?: (input: unknown) => CodexAuthSession;
  saveImage?: (options: SaveGeneratedImageOptions) => Promise<ImageSaveResult>;
  formatResult?: typeof formatCodexImageToolResult;
  agentDir?: string | ((ctx: PiToolExecutionContext) => string | undefined);
  env?: Record<string, string | undefined>;
}

export type CodexImageGenPiToolDefinition = PiToolDefinition<
  CodexImageGenToolInput,
  CodexImageGenToolDetails
>;

export function registerCodexImageGenTool(
  pi: PiExtensionApi,
  runtimeOptions: CodexImageGenToolRuntimeOptions = {},
): void {
  pi.registerTool(createCodexImageGenToolDefinition(runtimeOptions));
  registerCodexImageGenHelpCommand(pi);
}

export function createCodexImageGenToolDefinition(
  runtimeOptions: CodexImageGenToolRuntimeOptions = {},
): CodexImageGenPiToolDefinition {
  return {
    name: CODEX_IMAGE_GEN_TOOL_NAME,
    label: CODEX_IMAGE_GEN_TOOL_LABEL,
    description: CODEX_IMAGE_GEN_TOOL_DESCRIPTION,
    promptSnippet: CODEX_IMAGE_GEN_TOOL_PROMPT_SNIPPET,
    promptGuidelines: [...CODEX_IMAGE_GEN_TOOL_PROMPT_GUIDELINES],
    parameters: CODEX_IMAGE_GEN_TOOL_PARAMETERS,
    executionMode: "sequential",
    async execute(toolCallId, params, signal, onUpdate, ctx): Promise<PiToolResult<CodexImageGenToolDetails>> {
      const agentDir = resolveAgentDir(ctx, runtimeOptions.agentDir);
      const loadConfig = runtimeOptions.loadConfig ?? loadCodexImageGenConfig;
      const loadedConfig = await loadConfig({
        cwd: ctx.cwd,
        agentDir,
        env: runtimeOptions.env ?? process.env,
      });
      const input = normalizeCodexImageGenToolInput(
        params,
        createCodexImageGenInputDefaults(loadedConfig.config),
      );

      onUpdate?.({
        content: [{ type: "text", text: `Generating image via ${CODEX_IMAGE_GEN_PROVIDER}/${input.model} using backend ${BACKEND_IMAGE_MODEL}...` }],
        details: {
          provider: CODEX_IMAGE_GEN_PROVIDER,
          routingModel: input.model,
          backendImageModel: BACKEND_IMAGE_MODEL,
          outputFormat: input.outputFormat,
          saveMode: input.save,
        },
      });

      const getProviderAuth = runtimeOptions.getProviderAuth ?? getOpenAiCodexProviderAuth;
      const resolveAuth = runtimeOptions.resolveAuth ?? resolveCodexAuth;
      const auth = resolveAuth(await getProviderAuth(ctx));
      const sessionId = resolveSessionId(ctx);
      const client = runtimeOptions.client ?? runtimeOptions.createClient?.() ?? new CodexImageClient();
      const generation = await client.generateImage(input, auth, createGenerateOptions(signal, sessionId, toolCallId));
      const saveImage = runtimeOptions.saveImage ?? saveGeneratedImage;
      const save = await saveImage(createSaveOptions({
        input,
        generation,
        cwd: ctx.cwd,
        agentDir,
        sessionId,
        toolCallId,
      }));
      const formatResult = runtimeOptions.formatResult ?? formatCodexImageToolResult;
      return formatResult({ generation, save });
    },
  };
}

export function registerCodexImageGenHelpCommand(pi: PiExtensionApi): void {
  if (typeof pi.registerCommand !== "function") {
    return;
  }

  pi.registerCommand(CODEX_IMAGE_GEN_HELP_COMMAND_NAME, {
    description: "Show codex_generate_image parameters, save modes, and safety notes.",
    handler: async (_args, ctx) => {
      if (typeof ctx.waitForIdle === "function") {
        await ctx.waitForIdle();
      }
      deliverHelpText(pi, ctx);
    },
  });
}

async function getOpenAiCodexProviderAuth(ctx: PiToolExecutionContext): Promise<unknown> {
  try {
    return await ctx.modelRegistry.getApiKeyForProvider(CODEX_IMAGE_GEN_PROVIDER);
  } catch {
    throw new CodexAuthError(
      "CODEX_IMAGE_GEN_MISSING_AUTH",
      "Could not retrieve openai-codex credentials from Pi. Run Pi /login and choose ChatGPT/Codex authentication.",
    );
  }
}

function createGenerateOptions(
  signal: AbortSignal | undefined,
  sessionId: string | undefined,
  toolCallId: string,
): CodexImageClientGenerateOptions {
  const options: CodexImageClientGenerateOptions = {};
  if (signal !== undefined) {
    options.signal = signal;
  }
  if (sessionId !== undefined) {
    options.sessionId = sessionId;
  }
  const threadId = normalizeIdForBackend(toolCallId);
  if (threadId !== undefined) {
    options.threadId = threadId;
  }
  return options;
}

function createSaveOptions(options: {
  input: NormalizedCodexImageGenToolInput;
  generation: CodexImageGenerationResult;
  cwd: string;
  agentDir: string;
  sessionId: string | undefined;
  toolCallId: string;
}): SaveGeneratedImageOptions {
  const saveOptions: SaveGeneratedImageOptions = {
    saveMode: options.input.save,
    outputFormat: options.input.outputFormat,
    cwd: options.cwd,
    agentDir: options.agentDir,
    imageId: options.generation.imageGenerationId ?? options.toolCallId,
    base64Image: options.generation.base64Image,
  };

  if (options.sessionId !== undefined) {
    saveOptions.sessionId = options.sessionId;
  }
  if (options.input.saveDir !== undefined) {
    saveOptions.saveDir = options.input.saveDir;
  }

  return saveOptions;
}

function resolveSessionId(ctx: PiToolExecutionContext): string | undefined {
  try {
    return normalizeIdForBackend(ctx.sessionManager.getSessionId());
  } catch {
    return undefined;
  }
}

function resolveAgentDir(
  ctx: PiToolExecutionContext,
  override: CodexImageGenToolRuntimeOptions["agentDir"],
): string {
  const fromOverride = typeof override === "function" ? override(ctx) : override;
  const fromContext = ctx.agentDir ?? ctx.getAgentDir?.();
  const fromEnv = process.env.PI_CODING_AGENT_DIR;
  return normalizeDirectory(fromOverride) ?? normalizeDirectory(fromContext) ?? normalizeDirectory(fromEnv) ?? getDefaultPiAgentDir();
}

function normalizeDirectory(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeIdForBackend(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 256 || /[\u0000-\u001f\u007f]/u.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function deliverHelpText(pi: PiExtensionApi, ctx: PiCommandContext): void {
  if (ctx.hasUI !== false && typeof ctx.ui?.notify === "function") {
    ctx.ui.notify(CODEX_IMAGE_GEN_HELP_TEXT, "info");
    return;
  }

  pi.sendMessage?.({
    customType: "codex-image-gen-help",
    content: CODEX_IMAGE_GEN_HELP_TEXT,
    display: true,
    details: { tool: CODEX_IMAGE_GEN_TOOL_NAME },
  }, { deliverAs: "nextTurn" });
}
