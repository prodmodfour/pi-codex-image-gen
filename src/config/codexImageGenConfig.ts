import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  CODEX_IMAGE_GEN_DEFAULT_MODEL,
  CODEX_IMAGE_GEN_DEFAULT_SAVE_MODE,
  CODEX_IMAGE_GEN_MAX_MODEL_LENGTH,
  CODEX_IMAGE_GEN_MAX_SAVE_DIR_LENGTH,
  CODEX_IMAGE_GEN_SAVE_MODES,
  type CodexImageGenInputDefaults,
  type CodexImageGenSaveMode,
  isCodexImageGenSaveMode,
} from "../tool/codexImageGenApi.ts";

export const CODEX_IMAGE_GEN_CONFIG_FILE_NAME = "codex-image-gen.json" as const;
export const CODEX_IMAGE_GEN_ENV_SAVE_MODE = "PI_CODEX_IMAGE_SAVE_MODE" as const;
export const CODEX_IMAGE_GEN_ENV_SAVE_DIR = "PI_CODEX_IMAGE_SAVE_DIR" as const;
export const CODEX_IMAGE_GEN_ENV_MODEL = "PI_CODEX_IMAGE_MODEL" as const;

export interface CodexImageGenConfigFile {
  model?: string;
  saveMode?: CodexImageGenSaveMode;
  saveDir?: string;
}

export interface CodexImageGenConfig {
  model: string;
  saveMode: CodexImageGenSaveMode;
  saveDir?: string;
}

export interface CodexImageGenConfigPaths {
  globalPath: string;
  projectPath: string;
}

export interface CodexImageGenConfigLoadOptions {
  cwd?: string;
  agentDir?: string;
  env?: Record<string, string | undefined>;
}

export interface CodexImageGenLoadedConfig {
  config: CodexImageGenConfig;
  paths: CodexImageGenConfigPaths;
  loadedFiles: readonly string[];
}

export type CodexImageGenConfigIssueSource = "global" | "project" | "env";

export type CodexImageGenConfigIssueCode =
  | "invalid_json"
  | "invalid_type"
  | "unknown_property"
  | "empty"
  | "too_long"
  | "invalid_enum"
  | "invalid_string";

export interface CodexImageGenConfigIssue {
  source: CodexImageGenConfigIssueSource;
  path: string;
  code: CodexImageGenConfigIssueCode;
  message: string;
  location?: string | undefined;
  received?: string | undefined;
}

export class CodexImageGenConfigError extends Error {
  override readonly name = "CodexImageGenConfigError";
  readonly code = "CODEX_IMAGE_GEN_CONFIG_ERROR" as const;
  readonly issues: readonly CodexImageGenConfigIssue[];

  constructor(issues: readonly CodexImageGenConfigIssue[]) {
    super(formatConfigErrorMessage(issues));
    this.issues = issues;
  }
}

export const DEFAULT_CODEX_IMAGE_GEN_CONFIG = Object.freeze({
  model: CODEX_IMAGE_GEN_DEFAULT_MODEL,
  saveMode: CODEX_IMAGE_GEN_DEFAULT_SAVE_MODE,
} satisfies CodexImageGenConfig);

const CONFIG_FILE_ALLOWED_PROPERTIES = new Set(["model", "saveMode", "saveDir"]);

export function getDefaultPiAgentDir(): string {
  return join(homedir(), ".pi", "agent");
}

export function resolveCodexImageGenConfigPaths(
  options: Pick<CodexImageGenConfigLoadOptions, "cwd" | "agentDir"> = {},
): CodexImageGenConfigPaths {
  const cwd = resolve(options.cwd ?? process.cwd());
  const agentDir = resolve(options.agentDir ?? getDefaultPiAgentDir());

  return {
    globalPath: join(agentDir, "extensions", CODEX_IMAGE_GEN_CONFIG_FILE_NAME),
    projectPath: join(cwd, ".pi", "extensions", CODEX_IMAGE_GEN_CONFIG_FILE_NAME),
  };
}

export async function loadCodexImageGenConfig(
  options: CodexImageGenConfigLoadOptions = {},
): Promise<CodexImageGenLoadedConfig> {
  const env = options.env ?? process.env;
  const paths = resolveCodexImageGenConfigPaths(options);
  const issues: CodexImageGenConfigIssue[] = [];
  const loadedFiles: string[] = [];
  const draft: CodexImageGenConfig = { ...DEFAULT_CODEX_IMAGE_GEN_CONFIG };

  const globalConfig = await readConfigFile(paths.globalPath, "global", issues);
  if (globalConfig !== undefined) {
    loadedFiles.push(paths.globalPath);
    applyConfigObject(draft, globalConfig, "global", paths.globalPath, issues);
  }

  const projectConfig = await readConfigFile(paths.projectPath, "project", issues);
  if (projectConfig !== undefined) {
    loadedFiles.push(paths.projectPath);
    applyConfigObject(draft, projectConfig, "project", paths.projectPath, issues);
  }

  applyEnvOverrides(draft, env, issues);

  if (issues.length > 0) {
    throw new CodexImageGenConfigError(issues);
  }

  return {
    config: { ...draft },
    paths,
    loadedFiles,
  };
}

export function createCodexImageGenInputDefaults(
  config: CodexImageGenConfig,
): CodexImageGenInputDefaults {
  const defaults: CodexImageGenInputDefaults = {
    model: config.model,
    save: config.saveMode,
  };

  if (config.saveDir !== undefined) {
    defaults.saveDir = config.saveDir;
  }

  return defaults;
}

async function readConfigFile(
  filePath: string,
  source: CodexImageGenConfigIssueSource,
  issues: CodexImageGenConfigIssue[],
): Promise<unknown | undefined> {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }
    issues.push({
      source,
      path: "$",
      code: "invalid_type",
      message: `Could not read ${source} config file. Check file permissions and path.`,
      location: filePath,
      received: error instanceof Error ? error.name : describeReceived(error),
    });
    return undefined;
  }

  try {
    return JSON.parse(content) as unknown;
  } catch (error) {
    issues.push({
      source,
      path: "$",
      code: "invalid_json",
      message: `${source} config file must contain valid JSON.`,
      location: filePath,
      received: error instanceof Error ? error.message : describeReceived(error),
    });
    return undefined;
  }
}

function applyConfigObject(
  draft: CodexImageGenConfig,
  raw: unknown,
  source: CodexImageGenConfigIssueSource,
  location: string,
  issues: CodexImageGenConfigIssue[],
): void {
  if (!isRecord(raw)) {
    issues.push({
      source,
      path: "$",
      code: "invalid_type",
      message: `${source} config must be a JSON object with optional model, saveMode, and saveDir fields.`,
      location,
      received: describeReceived(raw),
    });
    return;
  }

  for (const key of Object.keys(raw)) {
    if (!CONFIG_FILE_ALLOWED_PROPERTIES.has(key)) {
      issues.push({
        source,
        path: key,
        code: "unknown_property",
        message: `Unsupported ${source} config key "${key}". Supported keys: model, saveMode, saveDir.`,
        location,
      });
    }
  }

  if (Object.hasOwn(raw, "model")) {
    const model = normalizeConfigModel(raw.model, "model", source, location, issues);
    if (model !== undefined) {
      draft.model = model;
    }
  }

  if (Object.hasOwn(raw, "saveMode")) {
    const saveMode = normalizeConfigSaveMode(raw.saveMode, "saveMode", source, location, issues);
    if (saveMode !== undefined) {
      draft.saveMode = saveMode;
    }
  }

  if (Object.hasOwn(raw, "saveDir")) {
    const saveDir = normalizeConfigSaveDir(raw.saveDir, "saveDir", source, location, issues);
    if (saveDir !== undefined) {
      draft.saveDir = saveDir;
    }
  }
}

function applyEnvOverrides(
  draft: CodexImageGenConfig,
  env: Record<string, string | undefined>,
  issues: CodexImageGenConfigIssue[],
): void {
  if (env[CODEX_IMAGE_GEN_ENV_MODEL] !== undefined) {
    const model = normalizeConfigModel(env[CODEX_IMAGE_GEN_ENV_MODEL], CODEX_IMAGE_GEN_ENV_MODEL, "env", undefined, issues);
    if (model !== undefined) {
      draft.model = model;
    }
  }

  if (env[CODEX_IMAGE_GEN_ENV_SAVE_MODE] !== undefined) {
    const saveMode = normalizeConfigSaveMode(
      env[CODEX_IMAGE_GEN_ENV_SAVE_MODE],
      CODEX_IMAGE_GEN_ENV_SAVE_MODE,
      "env",
      undefined,
      issues,
    );
    if (saveMode !== undefined) {
      draft.saveMode = saveMode;
    }
  }

  if (env[CODEX_IMAGE_GEN_ENV_SAVE_DIR] !== undefined) {
    const saveDir = normalizeConfigSaveDir(env[CODEX_IMAGE_GEN_ENV_SAVE_DIR], CODEX_IMAGE_GEN_ENV_SAVE_DIR, "env", undefined, issues);
    if (saveDir !== undefined) {
      draft.saveDir = saveDir;
    }
  }
}

function normalizeConfigModel(
  value: unknown,
  path: string,
  source: CodexImageGenConfigIssueSource,
  location: string | undefined,
  issues: CodexImageGenConfigIssue[],
): string | undefined {
  if (typeof value !== "string") {
    issues.push({
      source,
      path,
      code: "invalid_type",
      message: `${path} must be a string model id.`,
      location,
      received: describeReceived(value),
    });
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    issues.push({
      source,
      path,
      code: "empty",
      message: `${path} must not be empty when configured.`,
      location,
    });
    return undefined;
  }

  if (trimmed.length > CODEX_IMAGE_GEN_MAX_MODEL_LENGTH) {
    issues.push({
      source,
      path,
      code: "too_long",
      message: `${path} must be ${CODEX_IMAGE_GEN_MAX_MODEL_LENGTH} characters or fewer.`,
      location,
      received: `string(length:${trimmed.length})`,
    });
    return undefined;
  }

  if (/[\u0000-\u001f\u007f]/u.test(trimmed)) {
    issues.push({
      source,
      path,
      code: "invalid_string",
      message: `${path} must not contain control characters.`,
      location,
    });
    return undefined;
  }

  return trimmed;
}

function normalizeConfigSaveMode(
  value: unknown,
  path: string,
  source: CodexImageGenConfigIssueSource,
  location: string | undefined,
  issues: CodexImageGenConfigIssue[],
): CodexImageGenSaveMode | undefined {
  if (typeof value !== "string") {
    issues.push({
      source,
      path,
      code: "invalid_type",
      message: `${path} must be one of: ${CODEX_IMAGE_GEN_SAVE_MODES.join(", ")}.`,
      location,
      received: describeReceived(value),
    });
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!isCodexImageGenSaveMode(normalized)) {
    issues.push({
      source,
      path,
      code: "invalid_enum",
      message: `${path} must be one of: ${CODEX_IMAGE_GEN_SAVE_MODES.join(", ")}.`,
      location,
    });
    return undefined;
  }

  return normalized;
}

function normalizeConfigSaveDir(
  value: unknown,
  path: string,
  source: CodexImageGenConfigIssueSource,
  location: string | undefined,
  issues: CodexImageGenConfigIssue[],
): string | undefined {
  if (typeof value !== "string") {
    issues.push({
      source,
      path,
      code: "invalid_type",
      message: `${path} must be a directory path string.`,
      location,
      received: describeReceived(value),
    });
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    issues.push({
      source,
      path,
      code: "empty",
      message: `${path} must not be empty when configured.`,
      location,
    });
    return undefined;
  }

  if (trimmed.length > CODEX_IMAGE_GEN_MAX_SAVE_DIR_LENGTH) {
    issues.push({
      source,
      path,
      code: "too_long",
      message: `${path} must be ${CODEX_IMAGE_GEN_MAX_SAVE_DIR_LENGTH} characters or fewer.`,
      location,
      received: `string(length:${trimmed.length})`,
    });
    return undefined;
  }

  if (trimmed.includes("\0")) {
    issues.push({
      source,
      path,
      code: "invalid_string",
      message: `${path} must not contain NUL bytes.`,
      location,
    });
    return undefined;
  }

  return trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && (error.code === "ENOENT" || error.code === "ENOTDIR");
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

function formatConfigErrorMessage(issues: readonly CodexImageGenConfigIssue[]): string {
  if (issues.length === 0) {
    return "Invalid codex image generation config.";
  }
  const [firstIssue] = issues;
  const location = firstIssue?.location ? ` (${firstIssue.location})` : "";
  return `Invalid codex image generation config${location}: ${firstIssue?.message ?? "configuration failed"}`;
}
