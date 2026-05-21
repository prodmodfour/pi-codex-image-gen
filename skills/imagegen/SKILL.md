# Image generation through Codex

Use the `codex_generate_image` tool when the user explicitly asks Pi to create a bitmap image, icon, illustration, photo-style image, banner, sprite, placeholder artwork, or visual asset.

Do not use the tool for text-only answers, web search, code generation, document editing, or file creation that does not require image generation.

Before calling the tool, rewrite vague requests into a concise but specific prompt that includes subject, composition, style, constraints, any text to appear in the image, and the requested output format when known.

Prefer `save: "global"` unless the user asks not to save or asks to save in the current project. Use `save: "none"` for one-off inline previews when persistence is not useful. Use `save: "project"` for assets that belong in the current workspace. Use `save: "custom"` only when the user provides or configures a target directory.

Remember that image generation consumes the user's Codex/ChatGPT usage. Do not call it without a clear image-generation request.
