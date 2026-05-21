import {
  BACKEND_IMAGE_MODEL,
  CODEX_IMAGE_GEN_PROVIDER,
  CODEX_IMAGE_GEN_TOOL_NAME,
} from "../constants.js";
import {
  CODEX_IMAGE_GEN_TOOL_DESCRIPTION,
  CODEX_IMAGE_GEN_TOOL_PARAMETERS,
  type CodexImageGenToolInput,
} from "../tool/codexImageGenApi.js";
import type {
  PiExtensionApi,
  PiToolDefinition,
  PiToolResult,
} from "./piExtensionContract.js";

export const CODEX_IMAGE_GEN_TOOL_LABEL = "Codex Image" as const;
export const CODEX_IMAGE_GEN_TOOL_PROMPT_SNIPPET =
  "Generate bitmap images through Codex image generation when the user explicitly asks for an image." as const;
export const CODEX_IMAGE_GEN_TOOL_PROMPT_GUIDELINES = [
  "Use codex_generate_image only for explicit image-generation requests, because it consumes the user's Codex image quota.",
  "Do not use codex_generate_image for web search, code generation, text-only answers, or generic file creation.",
] as const;

export type CodexImageGenToolDetails = {
  provider: typeof CODEX_IMAGE_GEN_PROVIDER;
  backendImageModel: typeof BACKEND_IMAGE_MODEL;
  status: "not_implemented";
};

export type CodexImageGenPiToolDefinition = PiToolDefinition<
  CodexImageGenToolInput,
  CodexImageGenToolDetails
>;

export function registerCodexImageGenTool(pi: PiExtensionApi): void {
  pi.registerTool(createCodexImageGenToolDefinition());
}

export function createCodexImageGenToolDefinition(): CodexImageGenPiToolDefinition {
  return {
    name: CODEX_IMAGE_GEN_TOOL_NAME,
    label: CODEX_IMAGE_GEN_TOOL_LABEL,
    description: CODEX_IMAGE_GEN_TOOL_DESCRIPTION,
    promptSnippet: CODEX_IMAGE_GEN_TOOL_PROMPT_SNIPPET,
    promptGuidelines: [...CODEX_IMAGE_GEN_TOOL_PROMPT_GUIDELINES],
    parameters: CODEX_IMAGE_GEN_TOOL_PARAMETERS,
    executionMode: "parallel",
    execute(): PiToolResult<CodexImageGenToolDetails> {
      return {
        content: [
          {
            type: "text",
            text:
              "codex_generate_image is registered, but the backend implementation is pending autonomous build tickets 001-004.",
          },
        ],
        details: {
          provider: CODEX_IMAGE_GEN_PROVIDER,
          backendImageModel: BACKEND_IMAGE_MODEL,
          status: "not_implemented",
        },
      };
    },
  };
}
