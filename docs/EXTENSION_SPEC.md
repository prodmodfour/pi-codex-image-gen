# Extension spec assumptions

This document records assumptions that the autonomous agent must verify and keep current.

## Pi package manifest

The package should declare resources in `package.json`:

```json
{
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions/codex-image-gen.ts"],
    "skills": ["./skills"]
  }
}
```

## Pi extension entrypoint

The extension entrypoint should default-export a function that receives Pi's extension API and registers the tool.

```ts
export default function codexImageGenExtension(pi: ExtensionAPI): void {
  registerCodexImageGenTool(pi);
}
```

## Tool metadata

Primary tool:

```text
name: codex_generate_image
label: Codex Image
description: Generate an image through Codex using existing openai-codex auth.
```

The prompt guidelines must say to use it only for explicit image-generation requests.

## Auth provider

Provider name:

```text
openai-codex
```

The implementation should use Pi's current model registry/context method to retrieve this provider's token. The local contract in `src/pi/piExtensionContract.ts` is only a test seam and should be updated if Pi's real API differs.

## Image-generation backend

The implementation guide contains a candidate Responses/SSE contract. Verify it during tickets 002 and 007.

If current Codex provides a safer public SDK/CLI method for image generation, prefer that over hardcoding private endpoint details, as long as it still uses ChatGPT/Codex auth rather than API-key billing.
