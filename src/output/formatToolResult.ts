import type { CodexImageGenerationResult } from "../codex/CodexImageClient.ts";
import type { ImageSaveResult } from "../save/imageSave.ts";
import type { CodexImageGenOutputFormat, CodexImageGenSaveMode } from "../tool/codexImageGenApi.ts";
import type { PiToolResult } from "../pi/piExtensionContract.ts";
import type { BACKEND_IMAGE_MODEL, CODEX_IMAGE_GEN_PROVIDER } from "../constants.ts";

export interface CodexImageGenToolResultDetails {
  provider: typeof CODEX_IMAGE_GEN_PROVIDER;
  routingModel: string;
  backendImageModel: typeof BACKEND_IMAGE_MODEL;
  outputFormat: CodexImageGenOutputFormat;
  saveMode: CodexImageGenSaveMode;
  savedPath?: string;
  responseId?: string;
  imageGenerationId?: string;
  revisedPrompt?: string;
  usage?: Record<string, unknown>;
}

export interface FormatCodexImageToolResultOptions {
  generation: CodexImageGenerationResult;
  save: ImageSaveResult;
}

export function formatCodexImageToolResult(
  options: FormatCodexImageToolResultOptions,
): PiToolResult<CodexImageGenToolResultDetails> {
  const { generation, save } = options;
  const details = createToolResultDetails(generation, save);

  return {
    content: [
      {
        type: "text",
        text: createSummaryText(details),
      },
      {
        type: "image",
        data: generation.base64Image,
        mimeType: getMimeTypeForOutputFormat(generation.outputFormat),
      },
    ],
    details,
  };
}

export function getMimeTypeForOutputFormat(outputFormat: CodexImageGenOutputFormat): string {
  switch (outputFormat) {
    case "png":
      return "image/png";
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
  }
}

function createToolResultDetails(
  generation: CodexImageGenerationResult,
  save: ImageSaveResult,
): CodexImageGenToolResultDetails {
  const details: CodexImageGenToolResultDetails = {
    provider: generation.provider,
    routingModel: generation.routingModel,
    backendImageModel: generation.backendImageModel,
    outputFormat: generation.outputFormat,
    saveMode: save.saveMode,
  };

  if (save.saved) {
    details.savedPath = save.savedPath;
  }
  if (generation.responseId !== undefined) {
    details.responseId = generation.responseId;
  }
  if (generation.imageGenerationId !== undefined) {
    details.imageGenerationId = generation.imageGenerationId;
  }
  if (generation.revisedPrompt !== undefined) {
    details.revisedPrompt = generation.revisedPrompt;
  }
  if (generation.usage !== undefined) {
    details.usage = cloneJsonRecord(generation.usage);
  }

  return details;
}

function createSummaryText(details: CodexImageGenToolResultDetails): string {
  const saveSentence = details.savedPath === undefined
    ? `Save mode: ${details.saveMode}; no image file was written.`
    : `Saved image to: ${details.savedPath}`;

  return [
    `Generated image via ${details.provider}/${details.routingModel} using backend ${details.backendImageModel}.`,
    `Output format: ${details.outputFormat}.`,
    saveSentence,
  ].join(" ");
}

function cloneJsonRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
