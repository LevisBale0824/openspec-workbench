// ---------------------------------------------------------------------------
// Worker Renderer Pool
// ---------------------------------------------------------------------------
// Manages a pool of Web Workers for off-main-thread rendering.
// Features round-robin dispatch, LRU result cache, and cancellable tasks.
// Ported from opencode-visualizer-cn/app/utils/workerRenderer.ts
// ---------------------------------------------------------------------------

import RenderWorker from "../workers/render-worker?worker";

export type RenderRequest = {
  id: string;
  code: string;
  lang: string;
  theme?: string;
  variant?: "code" | "diff" | "markdown" | "text";
  patch?: string;
  after?: string;
  gutterMode?: "none" | "single" | "double";
  gutterLines?: string[];
  grepPattern?: string;
  lineOffset?: number;
  lineLimit?: number;
  diffContextLines?: number;
  files?: string[];
  copyButtonLabel?: string;
  copiedLabel?: string;
  copyCodeAriaLabel?: string;
  copyMarkdownAriaLabel?: string;
  errorLabel?: string;
};

type RenderResponse =
  | { id: string; ok: true; html: string }
  | { id: string; ok: false; error: string };

type PendingEntry = {
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
  errorLabel?: string;
};

export class RenderCancelledError extends Error {
  constructor() {
    super("Render request cancelled");
    this.name = "RenderCancelledError";
  }
}

type RenderTask = {
  promise: Promise<string>;
  cancel: () => void;
};

// ── Pool ──────────────────────────────────────────────────────────────────

const POOL_SIZE =
  typeof navigator !== "undefined"
    ? Math.min(8, Math.max(4, navigator.hardwareConcurrency || 4))
    : 4;

const workers: Worker[] = [];
let workerIndex = 0;
const pending = new Map<string, PendingEntry>();

// ── LRU cache ─────────────────────────────────────────────────────────────

const CACHE_LIMIT = 200;
const completedCache = new Map<string, string>();

function normalizeLines(value?: string[]): string {
  return value && value.length > 0 ? value.join("\u0001") : "";
}

function normalizeFiles(value?: string[]): string {
  return value && value.length > 0 ? value.join("\u0001") : "";
}

function getCacheKey(req: RenderRequest): string {
  return [
    req.code,
    req.patch ?? "",
    req.after ?? "",
    req.lang,
    req.theme ?? "",
    req.gutterMode ?? "",
    normalizeLines(req.gutterLines),
    req.grepPattern ?? "",
    String(req.lineOffset ?? ""),
    String(req.lineLimit ?? ""),
    String(req.diffContextLines ?? ""),
    normalizeFiles(req.files),
    req.copyButtonLabel ?? "",
    req.copiedLabel ?? "",
    req.copyCodeAriaLabel ?? "",
    req.copyMarkdownAriaLabel ?? "",
  ].join("\u0000");
}

function cacheResult(key: string, html: string) {
  if (completedCache.has(key)) completedCache.delete(key);
  completedCache.set(key, html);
  if (completedCache.size > CACHE_LIMIT) {
    const oldest = completedCache.keys().next().value;
    if (oldest) completedCache.delete(oldest);
  }
}

// ── Worker management ─────────────────────────────────────────────────────

function createWorker(): Worker {
  const worker = new RenderWorker();
  worker.onmessage = (event: MessageEvent<RenderResponse>) => {
    const data = event.data;
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.ok) entry.resolve(data.html);
    else
      entry.reject(
        new Error(data.error || entry.errorLabel || "Render failed"),
      );
  };
  worker.onerror = (error) => {
    for (const entry of pending.values()) {
      entry.reject(new Error(String(error)));
    }
    pending.clear();
  };
  return worker;
}

function getWorker(): Worker {
  if (workers.length === 0) {
    for (let i = 0; i < POOL_SIZE; i++) {
      workers.push(createWorker());
    }
  }
  const worker = workers[workerIndex];
  workerIndex = (workerIndex + 1) % workers.length;
  return worker;
}

// ── Public API ────────────────────────────────────────────────────────────

export function renderWorkerHtml(payload: RenderRequest): Promise<string> {
  const cacheKey = getCacheKey(payload);
  const cached = completedCache.get(cacheKey);
  if (cached !== undefined) return Promise.resolve(cached);

  return new Promise<string>((resolve, reject) => {
    pending.set(payload.id, {
      resolve: (html) => {
        cacheResult(cacheKey, html);
        resolve(html);
      },
      reject,
      errorLabel: payload.errorLabel,
    });
    getWorker().postMessage(payload);
  });
}

export function startRenderWorkerHtml(payload: RenderRequest): RenderTask {
  const cacheKey = getCacheKey(payload);
  const cached = completedCache.get(cacheKey);
  if (cached !== undefined) {
    return { promise: Promise.resolve(cached), cancel: () => {} };
  }

  let settled = false;
  const promise = new Promise<string>((resolve, reject) => {
    pending.set(payload.id, {
      resolve: (html) => {
        if (settled) return;
        settled = true;
        cacheResult(cacheKey, html);
        resolve(html);
      },
      reject: (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      },
      errorLabel: payload.errorLabel,
    });
    getWorker().postMessage(payload);
  });

  return {
    promise,
    cancel: () => {
      if (settled) return;
      const entry = pending.get(payload.id);
      if (!entry) return;
      pending.delete(payload.id);
      settled = true;
      entry.reject(new RenderCancelledError());
    },
  };
}
