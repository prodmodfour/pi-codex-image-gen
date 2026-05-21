/**
 * Pi Codex Image Generation extension entrypoint.
 *
 * Keep this file light: all tool registration and execution wiring lives in
 * src/pi/registerCodexImageGenTool.ts so it can be unit-tested without a real
 * Pi runtime or Codex login.
 */
import { registerCodexImageGenTool } from "../src/pi/registerCodexImageGenTool.js";
import type { PiExtensionApi } from "../src/pi/piExtensionContract.js";

export default function codexImageGenExtension(pi: PiExtensionApi): void {
  registerCodexImageGenTool(pi);
}
