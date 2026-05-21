import { CODEX_IMAGE_GEN_PROVIDER } from "../constants.ts";

export type CodexAuthErrorCode =
  | "CODEX_IMAGE_GEN_MISSING_AUTH"
  | "CODEX_IMAGE_GEN_MALFORMED_AUTH"
  | "CODEX_IMAGE_GEN_MISSING_ACCOUNT";

export interface CodexAuthClaimsSummary {
  subject?: string;
  expiresAt?: number;
  issuedAt?: number;
  chatgptUserId?: string;
  chatgptPlanType?: string;
}

export interface CodexAuthSession {
  provider: typeof CODEX_IMAGE_GEN_PROVIDER;
  bearerToken: string;
  accountId: string;
  claims: CodexAuthClaimsSummary;
}

export interface CodexAuthObjectInput {
  token?: unknown;
  bearerToken?: unknown;
  accessToken?: unknown;
  authToken?: unknown;
  accountId?: unknown;
  chatgptAccountId?: unknown;
  chatgptPlanType?: unknown;
}

export class CodexAuthError extends Error {
  override readonly name = "CodexAuthError";
  readonly code: CodexAuthErrorCode;

  constructor(code: CodexAuthErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Normalizes Pi-supplied, in-memory openai-codex auth. This function never reads
 * Codex credential files and never includes token material in thrown messages.
 */
export function resolveCodexAuth(input: unknown): CodexAuthSession {
  const token = extractToken(input);
  if (token === undefined) {
    throw new CodexAuthError(
      "CODEX_IMAGE_GEN_MISSING_AUTH",
      "Missing openai-codex credentials. Run Pi /login and choose ChatGPT/Codex authentication.",
    );
  }

  const claims = decodeJwtPayload(token);
  const accountId = normalizeAccountId(extractExplicitAccountId(input) ?? extractAccountIdFromClaims(claims));
  if (accountId === undefined) {
    throw new CodexAuthError(
      claims === undefined ? "CODEX_IMAGE_GEN_MALFORMED_AUTH" : "CODEX_IMAGE_GEN_MISSING_ACCOUNT",
      "openai-codex auth is missing ChatGPT account metadata. Re-run Pi /login so Codex can refresh account claims.",
    );
  }

  return {
    provider: CODEX_IMAGE_GEN_PROVIDER,
    bearerToken: token,
    accountId,
    claims: summarizeClaims(claims, input),
  };
}

function extractToken(input: unknown): string | undefined {
  if (typeof input === "string") {
    return normalizeToken(input);
  }

  if (!isRecord(input)) {
    return undefined;
  }

  return (
    normalizeToken(input.bearerToken)
    ?? normalizeToken(input.token)
    ?? normalizeToken(input.accessToken)
    ?? normalizeToken(input.authToken)
    ?? normalizeToken(input["access" + "_token"])
  );
}

function extractExplicitAccountId(input: unknown): unknown {
  if (!isRecord(input)) {
    return undefined;
  }

  return input.accountId ?? input.chatgptAccountId ?? input.chatgptAccountID ?? input.chatgpt_account_id;
}

function normalizeToken(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (/\s/u.test(trimmed)) {
    throw new CodexAuthError(
      "CODEX_IMAGE_GEN_MALFORMED_AUTH",
      "openai-codex auth token is malformed. Re-run Pi /login so Codex can refresh credentials.",
    );
  }

  return trimmed;
}

function normalizeAccountId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 256 || /[\u0000-\u001f\u007f]/u.test(trimmed)) {
    throw new CodexAuthError(
      "CODEX_IMAGE_GEN_MALFORMED_AUTH",
      "openai-codex ChatGPT account metadata is malformed. Re-run Pi /login so Codex can refresh account claims.",
    );
  }

  return trimmed;
}

function decodeJwtPayload(token: string): Record<string, unknown> | undefined {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    return undefined;
  }

  try {
    const payloadJson = Buffer.from(normalizeBase64Url(parts[1] ?? ""), "base64").toString("utf8");
    const payload = JSON.parse(payloadJson) as unknown;
    return isRecord(payload) ? payload : undefined;
  } catch {
    throw new CodexAuthError(
      "CODEX_IMAGE_GEN_MALFORMED_AUTH",
      "openai-codex auth token claims could not be decoded. Re-run Pi /login so Codex can refresh credentials.",
    );
  }
}

function normalizeBase64Url(value: string): string {
  const standard = value.replace(/-/gu, "+").replace(/_/gu, "/");
  const padding = standard.length % 4;
  return padding === 0 ? standard : `${standard}${"=".repeat(4 - padding)}`;
}

function extractAccountIdFromClaims(claims: Record<string, unknown> | undefined): unknown {
  if (claims === undefined) {
    return undefined;
  }

  const authClaims = getRecord(claims["https://api.openai.com/auth"]) ?? getRecord(claims.auth);
  return (
    claims.chatgpt_account_id
    ?? claims.account_id
    ?? authClaims?.chatgpt_account_id
    ?? authClaims?.account_id
  );
}

function summarizeClaims(claims: Record<string, unknown> | undefined, input: unknown): CodexAuthClaimsSummary {
  const summary: CodexAuthClaimsSummary = {};
  const authClaims = claims === undefined ? undefined : getRecord(claims["https://api.openai.com/auth"]) ?? getRecord(claims.auth);

  const subject = stringClaim(claims?.sub);
  if (subject !== undefined) {
    summary.subject = subject;
  }

  const expiresAt = numberClaim(claims?.exp);
  if (expiresAt !== undefined) {
    summary.expiresAt = expiresAt;
  }

  const issuedAt = numberClaim(claims?.iat);
  if (issuedAt !== undefined) {
    summary.issuedAt = issuedAt;
  }

  const chatgptUserId = stringClaim(authClaims?.chatgpt_user_id ?? authClaims?.user_id);
  if (chatgptUserId !== undefined) {
    summary.chatgptUserId = chatgptUserId;
  }

  const chatgptPlanType = stringClaim(authClaims?.chatgpt_plan_type ?? (isRecord(input) ? input.chatgptPlanType : undefined));
  if (chatgptPlanType !== undefined) {
    summary.chatgptPlanType = chatgptPlanType;
  }

  return summary;
}

function stringClaim(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function numberClaim(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
