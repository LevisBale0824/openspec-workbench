// ---------------------------------------------------------------------------
// Floating Window Manager — Full Version
// ---------------------------------------------------------------------------
// Manages floating window entries with position, zIndex, TTL, lifecycle hooks,
// render versioning, and async content resolution via Web Worker.
// Ported from opencode-visualizer-cn/app/composables/useFloatingWindows.ts
// ---------------------------------------------------------------------------

import { reactive, shallowRef, markRaw, onUnmounted, nextTick, type Component } from "vue";
import { renderWorkerHtml } from "../utils/workerRenderer";
import { DEFAULT_SYNTAX_THEME } from "../utils/themeTokens";
import { useI18n } from "../i18n/useI18n";

export interface FloatingWindowEntry {
  key: string;
  component?: Component;
  props?: Record<string, unknown>;
  content?: string | (() => Promise<string>);
  lang?: string;
  title?: string;
  status?: "running" | "completed" | "error";
  resolvedHtml: string;
  isReady: boolean;
  variant?: "code" | "diff" | "message" | "binary" | "term" | "plain";
  lineOffset?: number;
  lineLimit?: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  zIndex: number;
  closable: boolean;
  resizable: boolean;
  scroll: "follow" | "force" | "manual" | "none";
  smoothEngine?: "raf" | "native";
  focusOnOpen?: boolean;
  color?: string;
  minimized?: boolean;
  time: number;
  expiry?: number;
  expiresAt: number;
  beforeOpen?: () => Promise<void>;
  afterOpen?: (el: HTMLElement) => void;
  beforeClose?: (el: HTMLElement) => Promise<void>;
  afterClose?: () => void;
  onResize?: (width: number, height: number) => void;
}

export type Extent = { width: number; height: number };

// ── Constants ─────────────────────────────────────────────────────────────

const TOOL_RUNNING_TTL_MS = 1000 * 60 * 10;
const TOOL_COMPLETED_TTL_MS = 2000;
const TITLEBAR_VISIBLE_PX = 32;

const DEFAULT_OPTS: Partial<FloatingWindowEntry> = {
  closable: false,
  resizable: false,
  scroll: "force",
  width: 600,
  height: 400,
  minimized: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────

let renderIdCounter = 0;
function nextRenderId(): string {
  return `fw-${++renderIdCounter}-${Date.now().toString(36)}`;
}

function resolveEntryClosable(
  opts: Partial<FloatingWindowEntry>,
  existing?: FloatingWindowEntry,
): boolean {
  if (typeof opts.closable === "boolean") return opts.closable;
  if (typeof existing?.closable === "boolean") return existing.closable;
  return DEFAULT_OPTS.closable ?? false;
}

const MANUAL_ZINDEX_OFFSET = 10000;
let zIndexCounter = 100;

function isManualTier(key: string, closable?: boolean): boolean {
  if (closable) return true;
  return key.startsWith("permission:") || key.startsWith("question:");
}

function nextZIndex(manualTier: boolean): number {
  return ++zIndexCounter + (manualTier ? MANUAL_ZINDEX_OFFSET : 0);
}

function getAxisBounds(
  extentSize: number,
  windowSize: number,
  visibleSize: number,
) {
  const keepVisible = Math.max(
    1,
    Math.min(visibleSize, windowSize, extentSize),
  );
  return { min: keepVisible - windowSize, max: extentSize - keepVisible };
}

function variantToGutterMode(
  variant?: string,
): "none" | "single" | "double" {
  switch (variant) {
    case "diff":
      return "double";
    case "code":
      return "single";
    default:
      return "none";
  }
}

function sanitizeEntry(entry: FloatingWindowEntry): FloatingWindowEntry {
  if (entry.component) entry.component = markRaw(entry.component);
  if (entry.beforeOpen) entry.beforeOpen = markRaw(entry.beforeOpen);
  if (entry.afterOpen) entry.afterOpen = markRaw(entry.afterOpen);
  if (entry.beforeClose) entry.beforeClose = markRaw(entry.beforeClose);
  if (entry.afterClose) entry.afterClose = markRaw(entry.afterClose);
  if (entry.onResize) entry.onResize = markRaw(entry.onResize);
  return entry;
}

function resolveExpiresAt(
  opts: Partial<FloatingWindowEntry>,
  existing?: FloatingWindowEntry,
): number {
  if (typeof opts.expiresAt === "number") return opts.expiresAt;
  if (typeof opts.expiry === "number") {
    return opts.expiry === Infinity
      ? Number.MAX_SAFE_INTEGER
      : Date.now() + opts.expiry;
  }
  const status = opts.status;
  if (status === "completed" || status === "error")
    return Date.now() + TOOL_COMPLETED_TTL_MS;
  if (existing && typeof existing.expiresAt === "number")
    return existing.expiresAt;
  return Date.now() + TOOL_RUNNING_TTL_MS;
}

// ── Main composable ───────────────────────────────────────────────────────

export function useFloatingWindows() {
  const { t } = useI18n();
  const entriesMap = reactive(new Map<string, FloatingWindowEntry>());
  const entries = shallowRef<FloatingWindowEntry[]>([]);

  function rebuildEntries(): void {
    const result: FloatingWindowEntry[] = [];
    for (const entry of entriesMap.values()) {
      if (entry.isReady) result.push(entry);
    }
    entries.value = result;
  }

  let extent: Extent = {
    width: typeof window !== "undefined" ? window.innerWidth : 1920,
    height: typeof window !== "undefined" ? window.innerHeight : 1080,
  };

  function setExtent(w: number, h: number) {
    extent = { width: w, height: h };
  }

  function getExtent(): Extent {
    return extent;
  }

  function getRandomPosition(
    targetWidth = 600,
    targetHeight = 400,
  ): { x: number; y: number } {
    const padding = 20;
    const maxX = Math.max(0, extent.width - targetWidth - padding);
    const maxY = Math.max(0, extent.height - targetHeight - padding);
    return {
      x: padding + Math.floor(Math.random() * maxX),
      y: padding + Math.floor(Math.random() * maxY),
    };
  }

  const timerMap = new Map<string, ReturnType<typeof setTimeout>>();
  const renderVersionMap = new Map<string, number>();

  function bumpRenderVersion(key: string): number {
    const next = (renderVersionMap.get(key) || 0) + 1;
    renderVersionMap.set(key, next);
    return next;
  }

  function scheduleExpiry(key: string, expiresAt: number): void {
    if (expiresAt >= Number.MAX_SAFE_INTEGER) return;
    const existingTimer = timerMap.get(key);
    if (existingTimer !== undefined) clearTimeout(existingTimer);
    const delay = Math.max(0, expiresAt - Date.now());
    const timerId = setTimeout(() => {
      timerMap.delete(key);
      close(key);
    }, delay);
    timerMap.set(key, timerId);
  }

  onUnmounted(() => {
    for (const timerId of timerMap.values()) clearTimeout(timerId);
    timerMap.clear();
    renderVersionMap.clear();
  });

  // ── open() ───────────────────────────────────────────────────────────

  async function open(
    key: string,
    opts: Partial<FloatingWindowEntry>,
  ): Promise<void> {
    const existing = entriesMap.get(key);

    const merged: FloatingWindowEntry = {
      ...DEFAULT_OPTS,
      ...existing,
      ...opts,
      key,
      time: Date.now(),
      zIndex: existing
        ? existing.zIndex
        : nextZIndex(isManualTier(key, resolveEntryClosable(opts, existing))),
    } as FloatingWindowEntry;

    if (existing && existing.props && opts.props) {
      merged.props = { ...existing.props, ...opts.props };
    }

    if (!existing && opts.x == null && opts.y == null) {
      const pos = getRandomPosition(merged.width ?? 600, merged.height ?? 400);
      merged.x = pos.x;
      merged.y = pos.y;
    }

    const windowWidth = merged.width ?? 600;
    const xBounds = getAxisBounds(extent.width, windowWidth, TITLEBAR_VISIBLE_PX);
    const keepVisibleY = Math.max(
      1,
      Math.min(TITLEBAR_VISIBLE_PX, extent.height),
    );
    merged.x = Math.max(xBounds.min, Math.min(merged.x, xBounds.max));
    merged.y = Math.max(0, Math.min(merged.y, extent.height - keepVisibleY));

    if (merged.beforeOpen) {
      await merged.beforeOpen();
    }

    merged.isReady = true;
    const contentVersion = bumpRenderVersion(key);

    const resolveContent = async () => {
      const entry = entriesMap.get(key);
      if (!entry) return;
      if (renderVersionMap.get(key) !== contentVersion) return;

      if (typeof merged.content === "function") {
        try {
          entry.resolvedHtml = await (
            merged.content as () => Promise<string>
          )();
        } catch (e) {
          entry.resolvedHtml = String(e);
        }
      } else if (merged.content && merged.lang) {
        try {
          entry.resolvedHtml = await renderWorkerHtml({
            id: nextRenderId(),
            code: merged.content,
            lang: merged.lang,
            theme: DEFAULT_SYNTAX_THEME,
            gutterMode: variantToGutterMode(merged.variant),
            lineOffset: merged.lineOffset,
            lineLimit: merged.lineLimit,
            copyButtonLabel: t("render.copyCode"),
            copiedLabel: t("render.copied"),
            copyCodeAriaLabel: t("render.copyCodeAria"),
            copyMarkdownAriaLabel: t("render.copyMarkdownAria"),
          });
        } catch {
          entry.resolvedHtml = `<pre>${merged.content}</pre>`;
        }
      } else if (merged.content) {
        entry.resolvedHtml = merged.content;
      } else {
        entry.resolvedHtml = "";
      }
    };

    merged.expiresAt = resolveExpiresAt(opts, existing);
    const shouldFocusOnOpen = !existing && merged.focusOnOpen === true;

    entriesMap.set(key, sanitizeEntry(merged));
    rebuildEntries();
    void resolveContent();

    scheduleExpiry(key, merged.expiresAt);

    if (merged.afterOpen) {
      nextTick(() => {
        const el = document.querySelector(
          `[data-floating-key="${key}"]`,
        );
        if (el) merged.afterOpen!(el as HTMLElement);
      });
    }

    if (shouldFocusOnOpen) {
      nextTick(() => {
        const body = document.querySelector(
          `[data-floating-key="${key}"] .floating-window-body`,
        ) as HTMLElement | null;
        if (body) body.focus();
      });
    }
  }

  // ── updateOptions() ──────────────────────────────────────────────────

  function updateOptions(
    key: string,
    partialOpts: Partial<FloatingWindowEntry>,
  ): void {
    const existing = entriesMap.get(key);
    if (!existing) return;

    const merged = { ...existing, ...partialOpts, key } as FloatingWindowEntry;
    if (existing.props && partialOpts.props) {
      merged.props = { ...existing.props, ...partialOpts.props };
    }

    if (partialOpts.status && !partialOpts.expiresAt) {
      if (
        partialOpts.status === "completed" ||
        partialOpts.status === "error"
      ) {
        merged.expiresAt = Date.now() + TOOL_COMPLETED_TTL_MS;
      }
    }

    entriesMap.set(key, sanitizeEntry(merged));
    rebuildEntries();

    if (
      partialOpts.status === "completed" ||
      partialOpts.status === "error"
    ) {
      scheduleExpiry(key, merged.expiresAt);
    }
  }

  // ── setContent / appendContent ───────────────────────────────────────

  async function setContent(
    key: string,
    text: string,
    lang?: string,
  ): Promise<void> {
    const entry = entriesMap.get(key);
    if (!entry) return;

    const contentVersion = bumpRenderVersion(key);
    entry.content = text;
    entry.lang = lang;

    if (lang) {
      const resolved = await renderWorkerHtml({
        id: nextRenderId(),
        code: text,
        lang,
        theme: DEFAULT_SYNTAX_THEME,
        gutterMode: variantToGutterMode(entry.variant),
        copyButtonLabel: t("render.copyCode"),
        copiedLabel: t("render.copied"),
        copyCodeAriaLabel: t("render.copyCodeAria"),
        copyMarkdownAriaLabel: t("render.copyMarkdownAria"),
      });
      if (renderVersionMap.get(key) !== contentVersion) return;
      entry.resolvedHtml = resolved;
    } else {
      entry.resolvedHtml = text;
    }
  }

  async function appendContent(
    key: string,
    text: string,
    lang?: string,
  ): Promise<void> {
    const entry = entriesMap.get(key);
    if (!entry) return;

    const contentVersion = bumpRenderVersion(key);
    const newContent = (entry.content || "") + text;
    entry.content = newContent;

    if (lang || entry.lang) {
      const resolved = await renderWorkerHtml({
        id: nextRenderId(),
        code: newContent,
        lang: lang || entry.lang!,
        theme: DEFAULT_SYNTAX_THEME,
        gutterMode: variantToGutterMode(entry.variant),
        copyButtonLabel: t("render.copyCode"),
        copiedLabel: t("render.copied"),
        copyCodeAriaLabel: t("render.copyCodeAria"),
        copyMarkdownAriaLabel: t("render.copyMarkdownAria"),
      });
      if (renderVersionMap.get(key) !== contentVersion) return;
      entry.resolvedHtml = resolved;
    } else {
      entry.resolvedHtml = newContent;
    }
  }

  // ── Simple setters ───────────────────────────────────────────────────

  function setTitle(key: string, title: string): void {
    const entry = entriesMap.get(key);
    if (entry) entry.title = title;
  }

  function setStatus(
    key: string,
    status: "running" | "completed" | "error",
  ): void {
    const entry = entriesMap.get(key);
    if (entry) {
      entry.status = status;
      if (status === "completed" || status === "error") {
        entry.expiresAt = Date.now() + TOOL_COMPLETED_TTL_MS;
        scheduleExpiry(key, entry.expiresAt);
      }
    }
  }

  function bringToFront(key: string): void {
    const entry = entriesMap.get(key);
    if (entry) {
      entry.zIndex = nextZIndex(
        isManualTier(entry.key, entry.closable),
      );
    }
  }

  function minimize(key: string): void {
    const entry = entriesMap.get(key);
    if (entry) entry.minimized = true;
  }

  function restore(key: string): void {
    const entry = entriesMap.get(key);
    if (entry) {
      entry.minimized = false;
      bringToFront(key);
    }
  }

  function extend(key: string, ms: number): void {
    const entry = entriesMap.get(key);
    if (entry) {
      entry.expiresAt = Date.now() + ms;
      scheduleExpiry(key, entry.expiresAt);
    }
  }

  // ── close / closeAll ─────────────────────────────────────────────────

  async function close(
    key: string,
    skipRebuild = false,
  ): Promise<void> {
    const entry = entriesMap.get(key);
    if (!entry) return;

    const timerId = timerMap.get(key);
    if (timerId !== undefined) {
      clearTimeout(timerId);
      timerMap.delete(key);
    }

    if (entry.beforeClose) {
      const el = document.querySelector(
        `[data-floating-key="${key}"]`,
      );
      await entry.beforeClose(el as HTMLElement);
    }

    entriesMap.delete(key);
    renderVersionMap.delete(key);
    if (!skipRebuild) rebuildEntries();

    if (entry.afterClose) entry.afterClose();
  }

  function closeAll(options?: {
    exclude?: (key: string) => boolean;
  }): void {
    const exclude = options?.exclude;
    for (const [key, timerId] of timerMap.entries()) {
      if (exclude?.(key)) continue;
      clearTimeout(timerId);
      timerMap.delete(key);
    }
    for (const key of [...entriesMap.keys()]) {
      if (exclude?.(key)) continue;
      void close(key, true);
    }
    rebuildEntries();
  }

  function has(key: string): boolean {
    return entriesMap.has(key);
  }

  function get(key: string): FloatingWindowEntry | undefined {
    return entriesMap.get(key);
  }

  return {
    entries,
    open,
    updateOptions,
    setContent,
    appendContent,
    setTitle,
    setStatus,
    bringToFront,
    minimize,
    restore,
    extend,
    close,
    closeAll,
    has,
    get,
    setExtent,
    getExtent,
  };
}
