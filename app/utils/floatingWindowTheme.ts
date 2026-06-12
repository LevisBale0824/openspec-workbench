// ---------------------------------------------------------------------------
// Floating Window Theme
// ---------------------------------------------------------------------------
// Maps window key prefixes to theme types and colors.
// ---------------------------------------------------------------------------

export type FloatingWindowThemeType =
  | "shell"
  | "reasoning"
  | "subagent"
  | "file"
  | "diff"
  | "media"
  | "dialog"
  | "history"
  | "tool"
  | "debug";

const KEY_PREFIX_MAP: Array<[string, FloatingWindowThemeType]> = [
  ["shell:", "shell"],
  ["reasoning:", "reasoning"],
  ["history-reasoning:", "reasoning"],
  ["subagent:", "subagent"],
  ["file-viewer:", "file"],
  ["git-diff:", "diff"],
  ["message-diff:", "diff"],
  ["commit-diff:", "diff"],
  ["image-viewer:", "media"],
  ["permission:", "dialog"],
  ["question:", "dialog"],
  ["thread-history", "history"],
  ["history-tool:", "tool"],
  ["debug:", "debug"],
];

const THEME_COLORS: Record<FloatingWindowThemeType, string> = {
  shell: "#4a6a8a",
  reasoning: "#8b5cf6",
  subagent: "#6366f1",
  file: "#3b82f6",
  diff: "#f59e0b",
  media: "#ec4899",
  dialog: "#ef4444",
  history: "#14b8a6",
  tool: "#22c55e",
  debug: "#6b7280",
};

export function getFloatingWindowTheme(
  key: string,
): FloatingWindowThemeType {
  for (const [prefix, type] of KEY_PREFIX_MAP) {
    if (key.startsWith(prefix)) return type;
  }
  return "tool";
}

export function getFloatingWindowColor(key: string): string {
  const type = getFloatingWindowTheme(key);
  return THEME_COLORS[type] ?? "#3a4150";
}
