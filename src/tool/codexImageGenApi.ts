import { CODEX_IMAGE_GEN_TOOL_NAME } from "../constants.js";

export const CODEX_IMAGE_GEN_OUTPUT_FORMATS = ["png", "jpeg", "webp"] as const;
export type CodexImageGenOutputFormat = (typeof CODEX_IMAGE_GEN_OUTPUT_FORMATS)[number];

export const CODEX_IMAGE_GEN_SAVE_MODES = ["none", "project", "global", "custom"] as const;
export type CodexImageGenSaveMode = (typeof CODEX_IMAGE_GEN_SAVE_MODES)[number];

export interface CodexImageGenToolInput {
  prompt: string;
  model?: string;
  outputFormat?: CodexImageGenOutputFormat;
  save?: CodexImageGenSaveMode;
  saveDir?: string;
}

/**
 * JSON-schema-compatible parameter schema.
 *
 * Ticket 001 should replace this skeleton with full normalization, validation,
 * defaults, and structured validation errors.
 */
export const CODEX_IMAGE_GEN_TOOL_PARAMETERS = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["prompt"],
  properties: {
    prompt: {
      type: "string",
      minLength: 1,
      maxLength: 8000,
      description:
        "Image prompt. Be specific about subject, composition, style, text, and constraints.",
    },
    model: {
      type: "string",
      description:
        "Codex routing model override. Uses the configured default when omitted.",
    },
    outputFormat: {
      type: "string",
      enum: [...CODEX_IMAGE_GEN_OUTPUT_FORMATS],
      default: "png",
      description: "Requested image output format.",
    },
    save: {
      type: "string",
      enum: [...CODEX_IMAGE_GEN_SAVE_MODES],
      default: "global",
      description: "Where to save the generated image, if at all.",
    },
    saveDir: {
      type: "string",
      description: "Directory used when save=custom. Relative paths resolve under the current workspace.",
    },
  },
} as const);

export const CODEX_IMAGE_GEN_TOOL_DESCRIPTION =
  `Generate an image with Codex through Pi's openai-codex authentication. Tool name: ${CODEX_IMAGE_GEN_TOOL_NAME}.` as const;
