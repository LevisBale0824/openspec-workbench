// ---------------------------------------------------------------------------
// Lightweight Markdown Renderer (main-thread)
// ---------------------------------------------------------------------------
// Synchronous markdown-it render for chat message text. The full Shiki-based
// worker pipeline (render-worker.ts) is overkill for inline chat content and
// is async, which complicates streaming reactivity. Here we keep it simple:
// markdown-it with safe defaults + target-blank links. Code fences get a
// generic monospace block (no syntax highlighting) — acceptable for prose.
// ---------------------------------------------------------------------------

import MarkdownIt from "markdown-it";

let instance: MarkdownIt | null = null;

function getInstance(): MarkdownIt {
  if (instance) return instance;
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true,
    typographer: false,
  });

  // Open links in a new tab safely.
  const defaultLinkOpen =
    md.renderer.rules.link_open ??
    ((tokens, idx, options, _env, self) =>
      self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    token.attrSet("target", "_blank");
    token.attrSet("rel", "noopener noreferrer");
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  instance = md;
  return md;
}

export function renderMarkdown(text: string): string {
  if (!text) return "";
  return getInstance().render(text);
}

export function useMarkdown() {
  return { render: renderMarkdown };
}
