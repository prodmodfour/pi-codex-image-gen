import { mkdir as defaultMkdir, rename as defaultRename, rm as defaultRm, writeFile as defaultWriteFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import type {
  CodexImageGenOutputFormat,
  CodexImageGenSaveMode,
} from "../tool/codexImageGenApi.ts";

export type ImageSaveErrorCode =
  | "CODEX_IMAGE_GEN_SAVE_DIR_REQUIRED"
  | "CODEX_IMAGE_GEN_INVALID_SAVE_DIR"
  | "CODEX_IMAGE_GEN_INVALID_IMAGE_DATA"
  | "CODEX_IMAGE_GEN_SAVE_FAILED";

export class ImageSaveError extends Error {
  override readonly name = "ImageSaveError";
  readonly code: ImageSaveErrorCode;
  readonly causeName?: string;

  constructor(code: ImageSaveErrorCode, message: string, cause?: unknown) {
    super(message);
    this.code = code;
    if (cause instanceof Error) {
      this.causeName = cause.name;
    }
  }
}

export interface ImageSaveFilesystem {
  mkdir(path: string, options: { recursive: true }): Promise<unknown>;
  writeFile(path: string, data: Uint8Array, options: { mode: number }): Promise<unknown>;
  rename(oldPath: string, newPath: string): Promise<unknown>;
  rm(path: string, options: { force: true }): Promise<unknown>;
}

export interface ResolveImageSaveTargetOptions {
  saveMode: CodexImageGenSaveMode;
  outputFormat: CodexImageGenOutputFormat;
  cwd: string;
  agentDir: string;
  sessionId?: string;
  imageId?: string;
  saveDir?: string;
}

export interface ImageSaveSkippedResult {
  saved: false;
  saveMode: "none";
  outputFormat: CodexImageGenOutputFormat;
  sanitizedSessionId: string;
  sanitizedImageId: string;
}

export interface ImageSaveWrittenTarget {
  saved: true;
  saveMode: Exclude<CodexImageGenSaveMode, "none">;
  outputFormat: CodexImageGenOutputFormat;
  sanitizedSessionId: string;
  sanitizedImageId: string;
  directory: string;
  fileName: string;
  savedPath: string;
}

export type ImageSaveTarget = ImageSaveSkippedResult | ImageSaveWrittenTarget;

export interface ImageSaveWrittenResult extends ImageSaveWrittenTarget {
  bytesWritten: number;
}

export type ImageSaveResult = ImageSaveSkippedResult | ImageSaveWrittenResult;

export interface SaveGeneratedImageOptions extends ResolveImageSaveTargetOptions {
  base64Image: string;
  fs?: Partial<ImageSaveFilesystem>;
  tempSuffix?: string;
}

const IMAGE_SAVE_PATH_PART_MAX_LENGTH = 96;
const DEFAULT_SESSION_ID = "session";
const DEFAULT_IMAGE_ID = "image";

export function sanitizeImageSavePathPart(value: string | undefined, fallback: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  const replaced = raw
    .normalize("NFKD")
    .replace(/[\\/]+/gu, "_")
    .replace(/[\u0000-\u001f\u007f]+/gu, "_")
    .replace(/[^A-Za-z0-9._-]+/gu, "_")
    .replace(/_+/gu, "_")
    .replace(/^[._-]+/u, "")
    .replace(/[._-]+$/u, "");
  const truncated = replaced.slice(0, IMAGE_SAVE_PATH_PART_MAX_LENGTH).replace(/[._-]+$/u, "");
  const safe = truncated.length > 0 && truncated !== "." && truncated !== ".." ? truncated : fallback;
  return safe.slice(0, IMAGE_SAVE_PATH_PART_MAX_LENGTH);
}

export function resolveImageSaveTarget(options: ResolveImageSaveTargetOptions): ImageSaveTarget {
  const sanitizedSessionId = sanitizeImageSavePathPart(options.sessionId, DEFAULT_SESSION_ID);
  const sanitizedImageId = sanitizeImageSavePathPart(options.imageId, DEFAULT_IMAGE_ID);

  if (options.saveMode === "none") {
    return {
      saved: false,
      saveMode: "none",
      outputFormat: options.outputFormat,
      sanitizedSessionId,
      sanitizedImageId,
    };
  }

  const baseDir = resolveBaseSaveDir(options.saveMode, options.cwd, options.agentDir, options.saveDir);
  const directory = join(baseDir, sanitizedSessionId);
  const fileName = `${sanitizedImageId}.${extensionForOutputFormat(options.outputFormat)}`;

  return {
    saved: true,
    saveMode: options.saveMode,
    outputFormat: options.outputFormat,
    sanitizedSessionId,
    sanitizedImageId,
    directory,
    fileName,
    savedPath: join(directory, fileName),
  };
}

export async function saveGeneratedImage(options: SaveGeneratedImageOptions): Promise<ImageSaveResult> {
  const target = resolveImageSaveTarget(options);
  if (!target.saved) {
    return target;
  }

  const imageBytes = decodeBase64Image(options.base64Image);
  const fs = createFilesystem(options.fs);
  const tempPath = join(target.directory, `.${target.fileName}.${normalizeTempSuffix(options.tempSuffix)}.tmp`);

  try {
    await fs.mkdir(target.directory, { recursive: true });
    await fs.writeFile(tempPath, imageBytes, { mode: 0o600 });
    await fs.rename(tempPath, target.savedPath);
  } catch (error) {
    await cleanupTempFile(fs, tempPath);
    throw new ImageSaveError(
      "CODEX_IMAGE_GEN_SAVE_FAILED",
      "Could not save the generated image. Check save mode, directory permissions, and available disk space.",
      error,
    );
  }

  return {
    ...target,
    bytesWritten: imageBytes.byteLength,
  };
}

function resolveBaseSaveDir(
  saveMode: Exclude<CodexImageGenSaveMode, "none">,
  cwdInput: string,
  agentDirInput: string,
  saveDir: string | undefined,
): string {
  const cwd = resolve(cwdInput);
  const agentDir = resolve(agentDirInput);

  if (saveMode === "project") {
    return join(cwd, ".pi", "generated-images");
  }

  if (saveMode === "global") {
    return join(agentDir, "generated-images");
  }

  const normalizedSaveDir = normalizeCustomSaveDir(saveDir);
  return isAbsolute(normalizedSaveDir) ? resolve(normalizedSaveDir) : resolve(cwd, normalizedSaveDir);
}

function normalizeCustomSaveDir(saveDir: string | undefined): string {
  if (saveDir === undefined) {
    throw new ImageSaveError(
      "CODEX_IMAGE_GEN_SAVE_DIR_REQUIRED",
      "saveDir is required when save mode is custom.",
    );
  }

  const trimmed = saveDir.trim();
  if (trimmed.length === 0 || trimmed.includes("\0")) {
    throw new ImageSaveError(
      "CODEX_IMAGE_GEN_INVALID_SAVE_DIR",
      "custom saveDir must be a non-empty directory path without NUL bytes.",
    );
  }

  return trimmed;
}

function extensionForOutputFormat(outputFormat: CodexImageGenOutputFormat): string {
  if (outputFormat === "jpeg") {
    return "jpeg";
  }
  return outputFormat;
}

function decodeBase64Image(base64Image: string): Buffer {
  const compact = base64Image.trim();
  if (compact.length === 0) {
    throw new ImageSaveError(
      "CODEX_IMAGE_GEN_INVALID_IMAGE_DATA",
      "Codex returned empty image data; no file was written.",
    );
  }

  const bytes = Buffer.from(compact, "base64");
  if (bytes.byteLength === 0) {
    throw new ImageSaveError(
      "CODEX_IMAGE_GEN_INVALID_IMAGE_DATA",
      "Codex returned invalid image data; no file was written.",
    );
  }

  return bytes;
}

function createFilesystem(overrides: Partial<ImageSaveFilesystem> | undefined): ImageSaveFilesystem {
  return {
    mkdir: overrides?.mkdir ?? defaultMkdir,
    writeFile: overrides?.writeFile ?? defaultWriteFile,
    rename: overrides?.rename ?? defaultRename,
    rm: overrides?.rm ?? defaultRm,
  };
}

async function cleanupTempFile(fs: ImageSaveFilesystem, tempPath: string): Promise<void> {
  try {
    await fs.rm(tempPath, { force: true });
  } catch {
    // Best-effort cleanup only; the thrown save error remains sanitized above.
  }
}

function normalizeTempSuffix(value: string | undefined): string {
  return sanitizeImageSavePathPart(value ?? `${process.pid}-${Date.now()}`, "tmp");
}
