import { CODEX_IMAGE_GEN_TOOL_NAME } from "../constants.ts";

export const CODEX_IMAGE_GEN_OUTPUT_FORMATS = ["png", "jpeg", "webp"] as const;
export type CodexImageGenOutputFormat = (typeof CODEX_IMAGE_GEN_OUTPUT_FORMATS)[number];

export const CODEX_IMAGE_GEN_SAVE_MODES = ["none", "project", "global", "custom"] as const;
export type CodexImageGenSaveMode = (typeof CODEX_IMAGE_GEN_SAVE_MODES)[number];

/** Current Pi openai-codex default observed in the installed Pi model resolver. */
export const CODEX_IMAGE_GEN_DEFAULT_MODEL = "gpt-5.5" as const;
export const CODEX_IMAGE_GEN_DEFAULT_OUTPUT_FORMAT = "png" as const satisfies CodexImageGenOutputFormat;
export const CODEX_IMAGE_GEN_DEFAULT_SAVE_MODE = "global" as const satisfies CodexImageGenSaveMode;
export const CODEX_IMAGE_GEN_MAX_PROMPT_LENGTH = 8000;
export const CODEX_IMAGE_GEN_MAX_MODEL_LENGTH = 128;
export const CODEX_IMAGE_GEN_MAX_SAVE_DIR_LENGTH = 4096;

export interface CodexImageGenToolInput {
  prompt: string;
  model?: string;
  outputFormat?: CodexImageGenOutputFormat;
  save?: CodexImageGenSaveMode;
  saveDir?: string;
}

export interface CodexImageGenInputDefaults {
  model?: string;
  outputFormat?: CodexImageGenOutputFormat;
  save?: CodexImageGenSaveMode;
  saveDir?: string;
}

export interface NormalizedCodexImageGenToolInput {
  prompt: string;
  model: string;
  outputFormat: CodexImageGenOutputFormat;
  save: CodexImageGenSaveMode;
  saveDir?: string;
}

export type CodexImageGenValidationIssueCode =
  | "invalid_type"
  | "required"
  | "empty"
  | "too_long"
  | "invalid_enum"
  | "unknown_property"
  | "invalid_string";

export interface CodexImageGenValidationIssue {
  path: string;
  code: CodexImageGenValidationIssueCode;
  message: string;
  received?: string;
}

export class CodexImageGenValidationError extends Error {
  override readonly name = "CodexImageGenValidationError";
  readonly code = "CODEX_IMAGE_GEN_VALIDATION_ERROR" as const;
  readonly issues: readonly CodexImageGenValidationIssue[];

  constructor(issues: readonly CodexImageGenValidationIssue[]) {
    super(formatValidationMessage(issues));
    this.issues = issues;
  }
}

export type CodexImageGenValidationResult =
  | { ok: true; value: NormalizedCodexImageGenToolInput }
  | { ok: false; issues: readonly CodexImageGenValidationIssue[] };

export const CODEX_IMAGE_GEN_TOOL_DEFAULTS = Object.freeze({
  model: CODEX_IMAGE_GEN_DEFAULT_MODEL,
  outputFormat: CODEX_IMAGE_GEN_DEFAULT_OUTPUT_FORMAT,
  save: CODEX_IMAGE_GEN_DEFAULT_SAVE_MODE,
} satisfies Required<Pick<CodexImageGenInputDefaults, "model" | "outputFormat" | "save">>);

/** JSON-schema-compatible parameter schema used by Pi when registering the tool. */
export const CODEX_IMAGE_GEN_TOOL_PARAMETERS = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["prompt"],
  properties: {
    prompt: {
      type: "string",
      minLength: 1,
      maxLength: CODEX_IMAGE_GEN_MAX_PROMPT_LENGTH,
      description:
        "Image prompt. Be specific about subject, composition, style, text, and constraints.",
    },
    model: {
      type: "string",
      minLength: 1,
      maxLength: CODEX_IMAGE_GEN_MAX_MODEL_LENGTH,
      default: CODEX_IMAGE_GEN_DEFAULT_MODEL,
      description:
        "Codex routing model override. Uses the configured default when omitted.",
    },
    outputFormat: {
      type: "string",
      enum: [...CODEX_IMAGE_GEN_OUTPUT_FORMATS],
      default: CODEX_IMAGE_GEN_DEFAULT_OUTPUT_FORMAT,
      description: "Requested image output format.",
    },
    save: {
      type: "string",
      enum: [...CODEX_IMAGE_GEN_SAVE_MODES],
      default: CODEX_IMAGE_GEN_DEFAULT_SAVE_MODE,
      description: "Where to save the generated image, if at all.",
    },
    saveDir: {
      type: "string",
      minLength: 1,
      maxLength: CODEX_IMAGE_GEN_MAX_SAVE_DIR_LENGTH,
      description:
        "Directory used when save=custom. Relative paths resolve under the current workspace.",
    },
  },
} as const);

export const CODEX_IMAGE_GEN_TOOL_DESCRIPTION =
  `Generate an image with Codex through Pi's openai-codex authentication. Tool name: ${CODEX_IMAGE_GEN_TOOL_NAME}.` as const;

const ALLOWED_INPUT_PROPERTIES = new Set(["prompt", "model", "outputFormat", "save", "saveDir"]);
const OUTPUT_FORMAT_SET = new Set<string>(CODEX_IMAGE_GEN_OUTPUT_FORMATS);
const SAVE_MODE_SET = new Set<string>(CODEX_IMAGE_GEN_SAVE_MODES);

export function isCodexImageGenOutputFormat(value: string): value is CodexImageGenOutputFormat {
  return OUTPUT_FORMAT_SET.has(value);
}

export function isCodexImageGenSaveMode(value: string): value is CodexImageGenSaveMode {
  return SAVE_MODE_SET.has(value);
}

export function validateCodexImageGenToolInput(
  input: unknown,
  defaults: CodexImageGenInputDefaults = CODEX_IMAGE_GEN_TOOL_DEFAULTS,
): CodexImageGenValidationResult {
  try {
    return { ok: true, value: normalizeCodexImageGenToolInput(input, defaults) };
  } catch (error) {
    if (error instanceof CodexImageGenValidationError) {
      return { ok: false, issues: error.issues };
    }
    throw error;
  }
}

export function normalizeCodexImageGenToolInput(
  input: unknown,
  defaults: CodexImageGenInputDefaults = CODEX_IMAGE_GEN_TOOL_DEFAULTS,
): NormalizedCodexImageGenToolInput {
  const issues: CodexImageGenValidationIssue[] = [];

  if (!isRecord(input)) {
    throw new CodexImageGenValidationError([
      {
        path: "$",
        code: "invalid_type",
        message: "codex_generate_image input must be an object.",
        received: describeReceived(input),
      },
    ]);
  }

  for (const key of Object.keys(input)) {
    if (!ALLOWED_INPUT_PROPERTIES.has(key)) {
      issues.push({
        path: key,
        code: "unknown_property",
        message: `Unsupported parameter "${key}". Supported parameters: prompt, model, outputFormat, save, saveDir.`,
      });
    }
  }

  const prompt = normalizePrompt(input.prompt, issues);
  const defaultModel = normalizeModel(defaults.model, "defaults.model", issues) ?? CODEX_IMAGE_GEN_DEFAULT_MODEL;
  const defaultOutputFormat = normalizeOutputFormat(
    defaults.outputFormat,
    "defaults.outputFormat",
    issues,
    CODEX_IMAGE_GEN_DEFAULT_OUTPUT_FORMAT,
  ) ?? CODEX_IMAGE_GEN_DEFAULT_OUTPUT_FORMAT;
  const defaultSave = normalizeSaveMode(
    defaults.save,
    "defaults.save",
    issues,
    CODEX_IMAGE_GEN_DEFAULT_SAVE_MODE,
  ) ?? CODEX_IMAGE_GEN_DEFAULT_SAVE_MODE;
  const model = normalizeModel(input.model, "model", issues, defaultModel);
  const outputFormat = normalizeOutputFormat(input.outputFormat, "outputFormat", issues, defaultOutputFormat);
  const save = normalizeSaveMode(input.save, "save", issues, defaultSave);
  const saveDir = normalizeSaveDir(input.saveDir, "saveDir", issues) ?? normalizeSaveDir(defaults.saveDir, "defaults.saveDir", issues);

  if (save === "custom" && saveDir === undefined) {
    issues.push({
      path: "saveDir",
      code: "required",
      message: "saveDir is required when save is \"custom\" unless a custom save directory is configured.",
    });
  }

  if (issues.length > 0) {
    throw new CodexImageGenValidationError(issues);
  }

  const normalized: NormalizedCodexImageGenToolInput = {
    prompt: requireNormalized(prompt, "prompt"),
    model: requireNormalized(model, "model"),
    outputFormat: requireNormalized(outputFormat, "outputFormat"),
    save: requireNormalized(save, "save"),
  };

  if (saveDir !== undefined) {
    normalized.saveDir = saveDir;
  }

  return normalized;
}

function normalizePrompt(value: unknown, issues: CodexImageGenValidationIssue[]): string | undefined {
  if (value === undefined) {
    issues.push({
      path: "prompt",
      code: "required",
      message: "prompt is required and must be a non-empty string.",
    });
    return undefined;
  }

  if (typeof value !== "string") {
    issues.push({
      path: "prompt",
      code: "invalid_type",
      message: "prompt must be a string.",
      received: describeReceived(value),
    });
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    issues.push({
      path: "prompt",
      code: "empty",
      message: "prompt must not be empty after trimming whitespace.",
    });
    return undefined;
  }

  if (trimmed.length > CODEX_IMAGE_GEN_MAX_PROMPT_LENGTH) {
    issues.push({
      path: "prompt",
      code: "too_long",
      message: `prompt must be ${CODEX_IMAGE_GEN_MAX_PROMPT_LENGTH} characters or fewer after trimming whitespace.`,
      received: `string(length:${trimmed.length})`,
    });
    return undefined;
  }

  return trimmed;
}

function normalizeModel(
  value: unknown,
  path: string,
  issues: CodexImageGenValidationIssue[],
  fallback?: string,
): string | undefined {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "string") {
    issues.push({
      path,
      code: "invalid_type",
      message: `${path} must be a string model id.`,
      received: describeReceived(value),
    });
    return fallback;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    issues.push({
      path,
      code: "empty",
      message: `${path} must not be empty when provided.`,
    });
    return fallback;
  }

  if (trimmed.length > CODEX_IMAGE_GEN_MAX_MODEL_LENGTH) {
    issues.push({
      path,
      code: "too_long",
      message: `${path} must be ${CODEX_IMAGE_GEN_MAX_MODEL_LENGTH} characters or fewer.`,
      received: `string(length:${trimmed.length})`,
    });
    return fallback;
  }

  if (containsControlCharacter(trimmed)) {
    issues.push({
      path,
      code: "invalid_string",
      message: `${path} must not contain control characters.`,
    });
    return fallback;
  }

  return trimmed;
}

function normalizeOutputFormat(
  value: unknown,
  path: string,
  issues: CodexImageGenValidationIssue[],
  fallback: CodexImageGenOutputFormat,
): CodexImageGenOutputFormat | undefined {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "string") {
    issues.push({
      path,
      code: "invalid_type",
      message: `${path} must be one of: ${CODEX_IMAGE_GEN_OUTPUT_FORMATS.join(", ")}.`,
      received: describeReceived(value),
    });
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (!isCodexImageGenOutputFormat(normalized)) {
    issues.push({
      path,
      code: "invalid_enum",
      message: `${path} must be one of: ${CODEX_IMAGE_GEN_OUTPUT_FORMATS.join(", ")}.`,
    });
    return fallback;
  }

  return normalized;
}

function normalizeSaveMode(
  value: unknown,
  path: string,
  issues: CodexImageGenValidationIssue[],
  fallback: CodexImageGenSaveMode,
): CodexImageGenSaveMode | undefined {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "string") {
    issues.push({
      path,
      code: "invalid_type",
      message: `${path} must be one of: ${CODEX_IMAGE_GEN_SAVE_MODES.join(", ")}.`,
      received: describeReceived(value),
    });
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (!isCodexImageGenSaveMode(normalized)) {
    issues.push({
      path,
      code: "invalid_enum",
      message: `${path} must be one of: ${CODEX_IMAGE_GEN_SAVE_MODES.join(", ")}.`,
    });
    return fallback;
  }

  return normalized;
}

function normalizeSaveDir(
  value: unknown,
  path: string,
  issues: CodexImageGenValidationIssue[],
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    issues.push({
      path,
      code: "invalid_type",
      message: `${path} must be a directory path string.`,
      received: describeReceived(value),
    });
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    issues.push({
      path,
      code: "empty",
      message: `${path} must not be empty when provided.`,
    });
    return undefined;
  }

  if (trimmed.length > CODEX_IMAGE_GEN_MAX_SAVE_DIR_LENGTH) {
    issues.push({
      path,
      code: "too_long",
      message: `${path} must be ${CODEX_IMAGE_GEN_MAX_SAVE_DIR_LENGTH} characters or fewer.`,
      received: `string(length:${trimmed.length})`,
    });
    return undefined;
  }

  if (trimmed.includes("\0")) {
    issues.push({
      path,
      code: "invalid_string",
      message: `${path} must not contain NUL bytes.`,
    });
    return undefined;
  }

  return trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function containsControlCharacter(value: string): boolean {
  return /[\u0000-\u001f\u007f]/u.test(value);
}

function requireNormalized<T>(value: T | undefined, path: string): T {
  if (value === undefined) {
    throw new CodexImageGenValidationError([
      {
        path,
        code: "required",
        message: `${path} could not be normalized.`,
      },
    ]);
  }
  return value;
}

function describeReceived(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (typeof value === "string") {
    return `string(length:${value.length})`;
  }
  return typeof value;
}

function formatValidationMessage(issues: readonly CodexImageGenValidationIssue[]): string {
  if (issues.length === 0) {
    return "Invalid codex_generate_image input.";
  }
  const [firstIssue] = issues;
  return `Invalid codex_generate_image input: ${firstIssue?.message ?? "validation failed"}`;
}
