import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  type MenuItemConstructorOptions,
} from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import * as http from "node:http";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

// ── Directory reading ─────────────────────────────────────────────────────

type DirEntry = {
  name: string;
  kind: "file" | "directory";
  /** POSIX-style path relative to the opened root, "" for root itself. */
  path: string;
};

type WorkspaceFileDiff = {
  file: string;
  before?: string;
  after?: string;
  patch?: string;
  additions: number;
  deletions: number;
  status?: "added" | "deleted" | "modified";
};

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".openspec",
  "dist",
  "dist-electron",
  "release",
  ".next",
  ".nuxt",
  ".cache",
  ".vscode",
  ".idea",
]);

async function readDirectoryEntries(dirPath: string): Promise<DirEntry[]> {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const result: DirEntry[] = [];
  for (const entry of entries) {
    const name = entry.name;
    const isDir = entry.isDirectory();
    if (isDir && IGNORED_DIRS.has(name)) continue;
    result.push({ name, kind: isDir ? "directory" : "file", path: name });
  }
  result.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return result;
}

function runGit(
  directory: string,
  args: string[],
): Promise<{ stdout: Buffer; stderr: Buffer; code: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn("git", args, {
      cwd: directory,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    proc.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk));
    proc.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
    proc.on("error", reject);
    proc.on("close", (code) => {
      resolve({
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
        code: code ?? 0,
      });
    });
  });
}

function parsePorcelainStatus(output: Buffer): Array<{
  path: string;
  status: "added" | "deleted" | "modified";
}> {
  const chunks = output.toString("utf8").split("\0").filter(Boolean);
  const result: Array<{
    path: string;
    status: "added" | "deleted" | "modified";
  }> = [];

  for (let i = 0; i < chunks.length; i++) {
    const item = chunks[i];
    const xy = item.slice(0, 2);
    let file = item.slice(3);
    if (xy[0] === "R" || xy[0] === "C") {
      file = chunks[i + 1] ?? file;
      i += 1;
    }
    if (!file) continue;
    const status =
      xy.includes("?") || xy.includes("A") ? "added" : xy.includes("D") ? "deleted" : "modified";
    result.push({ path: file.replace(/\\/g, "/"), status });
  }

  return result;
}

function isPathInside(rootPath: string, filePath: string): boolean {
  const root = path.resolve(rootPath);
  const target = path.resolve(rootPath, ...filePath.split("/"));
  return target === root || target.startsWith(root + path.sep);
}

function readTextFile(rootPath: string, relPath: string): string | undefined {
  if (!isPathInside(rootPath, relPath)) return undefined;
  const abs = path.resolve(rootPath, ...relPath.split("/"));
  if (!fs.existsSync(abs)) return undefined;
  const stat = fs.statSync(abs);
  if (!stat.isFile() || stat.size > 1024 * 1024) return undefined;
  const content = fs.readFileSync(abs);
  if (content.includes(0)) return undefined;
  return content.toString("utf8");
}

async function readGitHeadFile(rootPath: string, relPath: string): Promise<string | undefined> {
  const result = await runGit(rootPath, ["show", `HEAD:${relPath}`]);
  if (result.code !== 0) return undefined;
  if (result.stdout.length > 1024 * 1024) return undefined;
  if (result.stdout.includes(0)) return undefined;
  return result.stdout.toString("utf8");
}

function countPatchStats(patchText: string): {
  additions: number;
  deletions: number;
} {
  let additions = 0;
  let deletions = 0;
  for (const line of patchText.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions += 1;
    if (line.startsWith("-") && !line.startsWith("---")) deletions += 1;
  }
  return { additions, deletions };
}

async function readWorkspaceDiffs(rootPath: string): Promise<WorkspaceFileDiff[]> {
  const status = await runGit(rootPath, [
    "-c",
    "core.quotepath=false",
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "-z",
  ]);
  if (status.code !== 0) return [];

  const files = parsePorcelainStatus(status.stdout);
  const diffs: WorkspaceFileDiff[] = [];
  for (const item of files) {
    const before = item.status === "added" ? undefined : await readGitHeadFile(rootPath, item.path);
    const after = item.status === "deleted" ? undefined : readTextFile(rootPath, item.path);
    const patch =
      item.status === "added"
        ? ""
        : (
            await runGit(rootPath, ["-c", "core.quotepath=false", "diff", "--", item.path])
          ).stdout.toString("utf8");
    const stats =
      item.status === "added" && after
        ? { additions: after.split("\n").length, deletions: 0 }
        : countPatchStats(patch);
    if (before === undefined && after === undefined && !patch.trim()) continue;
    diffs.push({
      file: item.path,
      before,
      after,
      patch,
      additions: stats.additions,
      deletions: stats.deletions,
      status: item.status,
    });
  }

  return diffs;
}

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── OpenSpec helpers ───────────────────────────────────────────────────────

/**
 * On Windows `openspec` is shipped as `openspec.cmd`; on Unix it's just
 * `openspec`. Resolve accordingly so spawn works cross-platform.
 */
function resolveCliCmd(base: string): string {
  return process.platform === "win32" ? `${base}.cmd` : base;
}

async function runCli(
  directory: string,
  args: string[],
): Promise<{ stdout: Buffer; stderr: Buffer; code: number }> {
  // Reuse the same subprocess pattern as runGit (lines 64-87).
  return new Promise((resolve, reject) => {
    const baseCmd = args[0];
    const rest = args.slice(1);
    const cmd = resolveCliCmd(baseCmd);
    const proc = spawn(cmd, rest, {
      cwd: directory,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    proc.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk));
    proc.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
    proc.on("error", reject);
    proc.on("close", (code) => {
      resolve({
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
        code: code ?? 0,
      });
    });
  });
}

let cachedOpenspecVersion: string | null | undefined;
async function detectOpenspecCli(): Promise<{ available: boolean; version?: string }> {
  if (cachedOpenspecVersion !== undefined) {
    return {
      available: cachedOpenspecVersion !== null,
      version: cachedOpenspecVersion ?? undefined,
    };
  }
  try {
    const result = await runCli(process.cwd(), ["openspec", "--version"]);
    if (result.code === 0) {
      const v = result.stdout.toString("utf8").trim();
      cachedOpenspecVersion = v || "(unknown)";
      return { available: true, version: cachedOpenspecVersion };
    }
    cachedOpenspecVersion = null;
    return { available: false };
  } catch {
    cachedOpenspecVersion = null;
    return { available: false };
  }
}

function safeJoinPosix(rootPath: string, relPosix: string): string {
  // Reject absolute rel, parent traversal, drive letters.
  if (!relPosix || path.isAbsolute(relPosix)) throw new Error("invalid rel path");
  if (relPosix.split("/").some((seg) => seg === "..")) throw new Error("parent traversal");
  return path.resolve(rootPath, ...relPosix.split("/"));
}

// — OpenSpec state reader —
// Reads openspec/ under rootPath and assembles the GUI state. Mirrors the
// renderer-side OpenSpecState shape (minus the renderer-only fields like
// loading/error/validation). The renderer merges this into its reactive store.

type GuiCapability = { name: string; specPath: string; hasSpec: boolean };
type GuiRequirement = Record<string, unknown>;
type GuiScenario = { name: string; steps: Array<{ keyword: string; text: string }> };
type GuiDeltaRequirement = {
  op: "added" | "modified" | "removed" | "renamed";
  name: string;
  fromName?: string;
  requirement?: GuiRequirement;
  reason?: string;
};
type GuiDeltaSpec = {
  capability: string;
  path: string;
  requirements: GuiDeltaRequirement[];
};
type GuiProposal = {
  raw: string;
  why?: string;
  whatChanges?: string;
  capabilitiesNew: string[];
  capabilitiesModified: string[];
  impact?: string;
};
type GuiTask = {
  id: string;
  title: string;
  status: "pending" | "completed";
  groupIndex: number;
  groupTitle: string;
  requirement?: string;
  verification?: string;
  estimate?: number;
  dependsOn?: string[];
  result?: string;
  lineOffset: number;
};
type GuiTaskStats = { total: number; completed: number; pending: number; progress: number };
type GuiChange = {
  id: string;
  dirPath: string;
  archived: boolean;
  archivedAt?: string;
  proposal?: GuiProposal;
  tasks: GuiTask[];
  taskStats: GuiTaskStats;
  deltaSpecs: GuiDeltaSpec[];
  hasDesign: boolean;
  taskPath: string;
  proposalPath: string;
};
type GuiReadStateResult = {
  rootPath: string;
  initialized: boolean;
  capabilities: GuiCapability[];
  activeChanges: GuiChange[];
  archivedChanges: GuiChange[];
  cliAvailable: boolean;
  cliVersion?: string;
};

async function readOpenSpecState(rootPath: string): Promise<GuiReadStateResult | null> {
  const openspecRoot = path.join(rootPath, "openspec");
  if (!fs.existsSync(openspecRoot) || !fs.statSync(openspecRoot).isDirectory()) {
    const cli = await detectOpenspecCli();
    return {
      rootPath,
      initialized: false,
      capabilities: [],
      activeChanges: [],
      archivedChanges: [],
      cliAvailable: cli.available,
      cliVersion: cli.version,
    };
  }

  // Capabilities under specs/<cap>/spec.md
  const capabilities: GuiCapability[] = [];
  const specsDir = path.join(openspecRoot, "specs");
  if (fs.existsSync(specsDir) && fs.statSync(specsDir).isDirectory()) {
    for (const entry of fs.readdirSync(specsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const specPath = `specs/${entry.name}/spec.md`;
      const abs = path.join(specsDir, entry.name, "spec.md");
      capabilities.push({
        name: entry.name,
        specPath,
        hasSpec: fs.existsSync(abs) && fs.statSync(abs).isFile(),
      });
    }
  }

  // Changes
  const activeChanges: GuiChange[] = [];
  const archivedChanges: GuiChange[] = [];
  const changesDir = path.join(openspecRoot, "changes");
  if (fs.existsSync(changesDir) && fs.statSync(changesDir).isDirectory()) {
    for (const entry of fs.readdirSync(changesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "archive") {
        const archiveDir = path.join(changesDir, "archive");
        for (const sub of fs.readdirSync(archiveDir, { withFileTypes: true })) {
          if (!sub.isDirectory()) continue;
          const change = readChangeDir(rootPath, path.join("changes", "archive", sub.name), true);
          if (change) archivedChanges.push(change);
        }
      } else {
        const change = readChangeDir(rootPath, path.join("changes", entry.name), false);
        if (change) activeChanges.push(change);
      }
    }
  }

  const cli = await detectOpenspecCli();
  return {
    rootPath,
    initialized: true,
    capabilities,
    activeChanges,
    archivedChanges,
    cliAvailable: cli.available,
    cliVersion: cli.version,
  };
}

function readChangeDir(rootPath: string, relDir: string, archived: boolean): GuiChange | null {
  const openspecRoot = path.join(rootPath, "openspec");
  const absDir = path.join(openspecRoot, relDir);
  if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) return null;

  // id: 目录名(归档时去掉日期前缀 YYYY-MM-DD-)
  const dirName = path.basename(relDir);
  let id = dirName;
  let archivedAt: string | undefined;
  if (archived) {
    const dateM = /^(\d{4}-\d{2}-\d{2})-(.+)$/.exec(dirName);
    if (dateM) {
      archivedAt = dateM[1];
      id = dateM[2];
    }
  }

  const proposalRel = `${relDir.split(path.sep).join("/")}/proposal.md`;
  const tasksRel = `${relDir.split(path.sep).join("/")}/tasks.md`;
  const designAbs = path.join(absDir, "design.md");

  const proposalMd = readTextFile(rootPath, proposalRel);
  const tasksMd = readTextFile(rootPath, tasksRel);

  const proposal = proposalMd ? parseProposalShim(proposalMd) : undefined;
  const parsedTasks = tasksMd
    ? parseTasksShim(tasksMd)
    : { tasks: [], stats: { total: 0, completed: 0, pending: 0, progress: 0 } };

  // Delta specs under <dir>/specs/<cap>/spec.md
  const deltaSpecs: GuiDeltaSpec[] = [];
  const deltaRoot = path.join(absDir, "specs");
  if (fs.existsSync(deltaRoot) && fs.statSync(deltaRoot).isDirectory()) {
    for (const cap of fs.readdirSync(deltaRoot, { withFileTypes: true })) {
      if (!cap.isDirectory()) continue;
      const deltaFile = path.join(deltaRoot, cap.name, "spec.md");
      if (!fs.existsSync(deltaFile)) continue;
      const md = fs.readFileSync(deltaFile, "utf-8");
      const relPath = `${relDir.split(path.sep).join("/")}/specs/${cap.name}/spec.md`;
      deltaSpecs.push(parseDeltaSpecShim(md, cap.name, relPath));
    }
  }

  return {
    id,
    dirPath: relDir.split(path.sep).join("/"),
    archived,
    archivedAt,
    proposal,
    tasks: parsedTasks.tasks,
    taskStats: parsedTasks.stats,
    deltaSpecs,
    hasDesign: fs.existsSync(designAbs),
    taskPath: tasksRel,
    proposalPath: proposalRel,
  };
}

// — Lightweight markdown shims —
// We duplicate the renderer-side parser logic here in plain JS so the main
// process can ship pre-parsed structures over IPC without bundling the
// renderer's TS modules. Keeping these in sync with app/utils/openspecParser.ts
// is the cost of process isolation.

function parseProposalShim(md: string): GuiProposal {
  const sections = splitSectionsShim(md);
  const find = (level: number, candidates: string[]) => {
    for (const s of sections) {
      if (s.level !== level) continue;
      const norm = s.header.trim().toLowerCase();
      if (candidates.some((c) => c.toLowerCase() === norm)) return s.body;
    }
    return undefined;
  };
  const why = find(2, ["Why"]) ?? find(2, ["Intent"]);
  const what = find(2, ["What Changes"]) ?? find(2, ["Scope"]);
  const impact = find(2, ["Impact"]) ?? find(2, ["Approach"]);
  const newCap = find(3, ["New Capabilities"]);
  const modCap = find(3, ["Modified Capabilities"]);
  const listFrom = (body: string | undefined): string[] => {
    if (!body) return [];
    const out: string[] = [];
    for (const line of body.split(/\r?\n/)) {
      const m = /^\s*[-*+]\s+(.+)$/.exec(line);
      if (!m) continue;
      const text = m[1].trim();
      const idx = text.indexOf(":");
      out.push((idx > 0 ? text.slice(0, idx) : text).replace(/`/g, "").trim());
    }
    return out;
  };
  return {
    raw: md,
    why: why?.trim() || undefined,
    whatChanges: what?.trim() || undefined,
    capabilitiesNew: listFrom(newCap),
    capabilitiesModified: listFrom(modCap),
    impact: impact?.trim() || undefined,
  };
}

function splitSectionsShim(md: string): Array<{ header: string; level: number; body: string }> {
  const lines = md.split(/\r?\n/);
  const sections: Array<{ header: string; level: number; body: string }> = [];
  let header = "";
  let level = 0;
  let buffer: string[] = [];
  const flush = () => {
    sections.push({ header, level, body: buffer.join("\n") });
    buffer = [];
  };
  for (const line of lines) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) {
      if (header !== "" || buffer.length > 0) flush();
      level = m[1].length;
      header = m[2].trim();
    } else {
      buffer.push(line);
    }
  }
  if (header !== "" || buffer.length > 0) flush();
  return sections;
}

function splitByH2Shim(md: string): Array<{ header: string; body: string }> {
  const lines = md.split(/\r?\n/);
  const result: Array<{ header: string; body: string }> = [];
  let current: { header: string; body: string[] } | null = null;
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      if (current) result.push({ header: current.header, body: current.body.join("\n") });
      current = { header: m[1].trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) result.push({ header: current.header, body: current.body.join("\n") });
  return result;
}

function parseTasksShim(md: string): { tasks: GuiTask[]; stats: GuiTaskStats } {
  const rawLines = md.split(/\r?\n/);
  const tasks: GuiTask[] = [];
  let currentGroupIndex = 0;
  let currentGroupTitle = "";
  let currentTask: GuiTask | null = null;

  const flushTask = () => {
    if (currentTask) tasks.push(currentTask);
    currentTask = null;
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const groupM = /^##\s+(\d+)\.\s*(.*)$/.exec(line);
    if (groupM) {
      flushTask();
      currentGroupIndex = parseInt(groupM[1], 10);
      currentGroupTitle = groupM[2].trim();
      continue;
    }
    const taskM = /^\s*-\s+\[([ xX])\]\s+(.*)$/.exec(line);
    if (taskM) {
      flushTask();
      const completed = taskM[1].toLowerCase() === "x";
      const idM = /^(\d+(?:\.\d+)*)\s+(.*)$/.exec(taskM[2].trim());
      if (!idM) continue;
      currentTask = {
        id: idM[1],
        title: idM[2].trim(),
        status: completed ? "completed" : "pending",
        groupIndex: currentGroupIndex,
        groupTitle: currentGroupTitle,
        lineOffset: i,
      };
      continue;
    }
    if (!currentTask) continue;
    const t = line.trim();
    const reqM = /^-\s*Requirement:\s*(.+)$/i.exec(t);
    const verM = /^-\s*Verification:\s*`?([^`]+?)`?\s*$/i.exec(t);
    const estM = /^-\s*Estimate:\s*(\d+)\s*(?:min|minutes)?\s*$/i.exec(t);
    const depM = /^-\s*Depends\s+on:\s*(.+)$/i.exec(t);
    const resM = /^-\s*Result:\s*(.+)$/i.exec(t);
    if (reqM) currentTask.requirement = reqM[1].trim();
    else if (verM) currentTask.verification = verM[1].trim();
    else if (estM) currentTask.estimate = parseInt(estM[1], 10);
    else if (depM)
      currentTask.dependsOn = depM[1]
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    else if (resM) currentTask.result = resM[1].trim();
  }
  flushTask();

  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  return {
    tasks,
    stats: {
      total,
      completed,
      pending: total - completed,
      progress: total === 0 ? 0 : completed / total,
    },
  };
}

function parseSpecShim(md: string, capability: string): { requirements: GuiRequirement[] } {
  const lines = md.split(/\r?\n/);
  const requirements: GuiRequirement[] = [];
  let currentReq: (GuiRequirement & { text: string[]; scenarios: GuiScenario[] }) | null = null;
  let currentScenario: (GuiScenario & { body: string[] }) | null = null;
  const flushScenario = () => {
    if (currentScenario) {
      const steps: Array<{ keyword: string; text: string }> = [];
      for (const raw of currentScenario.body) {
        const line = raw.trim();
        if (!line) continue;
        const m = /^[-*+]?\s*\*?\*?(GIVEN|WHEN|THEN|AND)\b\*?\*?\s*(.*)$/i.exec(line);
        if (m) steps.push({ keyword: m[1].toUpperCase(), text: m[2].replace(/\*+/g, "").trim() });
      }
      currentReq?.scenarios.push({ name: currentScenario.name, steps });
      currentScenario = null;
    }
  };
  const flushReq = () => {
    flushScenario();
    if (currentReq) {
      const text = currentReq.text.join("\n").trim();
      const level = /\bMUST\b/.test(text)
        ? "MUST"
        : /\bSHALL\b/.test(text)
          ? "SHALL"
          : /\bSHOULD\b/.test(text)
            ? "SHOULD"
            : "MAY";
      requirements.push({
        name: currentReq.name,
        level,
        text,
        scenarios: currentReq.scenarios,
        capability,
        source: "delta",
      });
      currentReq = null;
    }
  };
  for (const line of lines) {
    const reqM = /^###\s+Requirement:\s*(.+?)\s*$/i.exec(line);
    const scM = /^####\s+Scenario:\s*(.+?)\s*$/i.exec(line);
    if (reqM) {
      flushReq();
      currentReq = {
        name: reqM[1].trim(),
        level: "MAY",
        text: [],
        scenarios: [],
        capability,
        source: "delta",
      };
      continue;
    }
    if (scM && currentReq) {
      flushScenario();
      currentScenario = { name: scM[1].trim(), steps: [], body: [] };
      continue;
    }
    if (currentScenario) currentScenario.body.push(line);
    else if (currentReq) currentReq.text.push(line);
  }
  flushReq();
  return { requirements };
}

function parseDeltaSpecShim(md: string, capability: string, deltaPath: string): GuiDeltaSpec {
  const sections = splitByH2Shim(md);
  const requirements: GuiDeltaRequirement[] = [];
  const HEADERS: Record<string, GuiDeltaRequirement["op"]> = {
    "ADDED Requirements": "added",
    "MODIFIED Requirements": "modified",
    "REMOVED Requirements": "removed",
    "RENAMED Requirements": "renamed",
  };
  for (const [header, op] of Object.entries(HEADERS)) {
    const sec = sections.find((s) => s.header.toLowerCase() === header.toLowerCase());
    if (!sec) continue;
    if (op === "removed") {
      for (const line of sec.body.split(/\r?\n/)) {
        const m = /^###\s+Requirement:\s*(.+?)\s*$/i.exec(line);
        if (m) requirements.push({ op, name: m[1].trim() });
      }
    } else if (op === "renamed") {
      const clean = (raw: string): string => {
        const m = /^###\s+Requirement:\s*(.+?)\s*$/i.exec(raw.trim());
        return m ? m[1].trim() : raw.trim();
      };
      let fromName: string | undefined;
      for (const line of sec.body.split(/\r?\n/)) {
        const fromM = /^[-*+]?\s*\*?\*?FROM:?\*?\*?\s*`?([^`]+?)`?\s*$/i.exec(line);
        const toM = /^[-*+]?\s*\*?\*?TO:?\*?\*?\s*`?([^`]+?)`?\s*$/i.exec(line);
        if (fromM) fromName = clean(fromM[1]);
        else if (toM && fromName) {
          requirements.push({ op, name: clean(toM[1]), fromName });
          fromName = undefined;
        }
      }
    } else {
      const inner = parseSpecShim(sec.body, capability);
      for (const req of inner.requirements) {
        requirements.push({
          op,
          name: req.name as string,
          requirement: req,
        });
      }
    }
  }
  return { capability, path: deltaPath, requirements };
}

/**
 * Toggle a single task's checkbox in tasks.md content.
 * Returns the new content, or null if the task wasn't found.
 * Preserves all other lines (evidence subfields, comments, etc.).
 */
function applyTaskToggleShim(content: string, taskId: string, completed: boolean): string | null {
  const lines = content.split(/\r?\n/);
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    const taskM = /^\s*-\s+\[([ xX])\]\s+(.*)$/.exec(lines[i]);
    if (!taskM) continue;
    const idM = /^(\d+(?:\.\d+)*)\s+(.*)$/.exec(taskM[2].trim());
    if (!idM || idM[1] !== taskId) continue;
    const newBox = completed ? "[x]" : "[ ]";
    lines[i] = lines[i].replace(/\[([ xX])\]/, newBox);
    found = true;
    break;
  }
  return found ? lines.join("\n") : null;
}

async function runOpenspecValidate(
  rootPath: string,
  changeId?: string,
): Promise<{
  changeId?: string;
  passed: boolean;
  cliAvailable: boolean;
  issues: Array<{
    file: string;
    line?: number;
    message: string;
    rule?: string;
    severity: "error" | "warning";
  }>;
  rawOutput: string;
  ranAt: number;
}> {
  const ranAt = Date.now();
  const cli = await detectOpenspecCli();
  if (!cli.available) {
    return {
      changeId,
      passed: false,
      cliAvailable: false,
      issues: [],
      rawOutput: "",
      ranAt,
    };
  }
  const args = ["openspec", "validate"];
  if (changeId) args.push(changeId);
  args.push("--strict");
  let result;
  try {
    result = await runCli(rootPath, args);
  } catch (e) {
    return {
      changeId,
      passed: false,
      cliAvailable: true,
      issues: [
        {
          file: "",
          message: `Failed to run openspec: ${(e as Error).message}`,
          severity: "error",
        },
      ],
      rawOutput: "",
      ranAt,
    };
  }
  const raw = `${result.stdout.toString("utf8")}\n${result.stderr.toString("utf8")}`.trim();
  const issues = parseValidationOutput(raw);
  return {
    changeId,
    passed: result.code === 0 && issues.every((i) => i.severity !== "error"),
    cliAvailable: true,
    issues,
    rawOutput: raw,
    ranAt,
  };
}

function parseValidationOutput(raw: string): Array<{
  file: string;
  line?: number;
  message: string;
  rule?: string;
  severity: "error" | "warning";
}> {
  const out: Array<{
    file: string;
    line?: number;
    message: string;
    rule?: string;
    severity: "error" | "warning";
  }> = [];
  // Common formats:
  //   path/to/file.md:10:5 Error: message [rule/name]
  //   Error: message (path/to/file.md:10:5)
  //   error[rule]: message at path/to/file.md:10
  const lineRe =
    /^(?:(?<file>[^:\r\n]+\.(?:md|yaml|yml)):(?<line>\d+)(?::\d+)?:\s*)?(?:(?<level>Error|Warning|Info):\s*)?(?<msg>.+?)(?:\s+\[(?<rule>[^\]]+)\])?\s*$/i;
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = lineRe.exec(line);
    if (!m || !m.groups) continue;
    const lvl = (m.groups.level || "error").toLowerCase();
    if (lvl === "info") continue;
    out.push({
      file: m.groups.file || "",
      line: m.groups.line ? parseInt(m.groups.line, 10) : undefined,
      message: m.groups.msg,
      rule: m.groups.rule,
      severity: lvl === "warning" ? "warning" : "error",
    });
  }
  return out;
}

// ── Server management ─────────────────────────────────────────────────────

type AgentKind = "opencode" | "zero";

type AgentConfig = {
  kind: AgentKind;
  opencodePort: number;
  zeroPort: number;
};

const DEFAULT_AGENT_CONFIG: AgentConfig = {
  kind: "opencode",
  opencodePort: 13284,
  zeroPort: 13286,
};

let agentConfig: AgentConfig = { ...DEFAULT_AGENT_CONFIG };

function agentConfigPath(): string {
  return path.join(app.getPath("userData"), "agent-config.json");
}

function loadAgentConfig(): AgentConfig {
  try {
    const raw = fs.readFileSync(agentConfigPath(), "utf-8");
    const parsed = JSON.parse(raw) as Partial<AgentConfig>;
    return {
      kind: parsed.kind === "zero" ? "zero" : "opencode",
      opencodePort:
        typeof parsed.opencodePort === "number"
          ? parsed.opencodePort
          : DEFAULT_AGENT_CONFIG.opencodePort,
      zeroPort:
        typeof parsed.zeroPort === "number" ? parsed.zeroPort : DEFAULT_AGENT_CONFIG.zeroPort,
    };
  } catch {
    return { ...DEFAULT_AGENT_CONFIG };
  }
}

function saveAgentConfig(config: AgentConfig): void {
  try {
    fs.writeFileSync(agentConfigPath(), JSON.stringify(config, null, 2), "utf-8");
    agentConfig = config;
  } catch (err) {
    console.error("[electron] saveAgentConfig failed:", err);
  }
}

let serverProcess: ChildProcess | null = null;
let serverStatus: { running: boolean; port: number; pid: number } = {
  running: false,
  port: 0,
  pid: 0,
};

async function healthCheck(port: number, timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`http://localhost:${port}/global/health`, (res) => {
          res.resume();
          if (res.statusCode === 200) resolve();
          else reject(new Error(`status ${res.statusCode}`));
        });
        req.on("error", reject);
        req.setTimeout(2000, () => {
          req.destroy();
          reject(new Error("timeout"));
        });
      });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

async function startServer(): Promise<void> {
  if (serverProcess) return;

  const isWin = process.platform === "win32";
  const kind = agentConfig.kind;
  const port = kind === "zero" ? agentConfig.zeroPort : agentConfig.opencodePort;
  const baseCmd = kind === "zero" ? "zero" : "opencode";
  const cmd = isWin ? `${baseCmd}.cmd` : baseCmd;

  serverProcess = spawn(cmd, ["serve", "--port", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
    shell: isWin,
  });

  serverProcess.stdout?.on("data", (data: Buffer) => {
    console.log(`[${kind}]`, data.toString().trim());
  });

  serverProcess.stderr?.on("data", (data: Buffer) => {
    console.error(`[${kind}]`, data.toString().trim());
  });

  serverProcess.on("error", (err) => {
    console.error(`[electron] Failed to start ${kind}:`, err);
    serverProcess = null;
    serverStatus = { running: false, port: 0, pid: 0 };
  });

  serverProcess.on("exit", (code) => {
    console.log(`[electron] ${kind} exited with code`, code);
    serverProcess = null;
    serverStatus = { running: false, port: 0, pid: 0 };
  });

  const healthy = await healthCheck(port);
  if (healthy) {
    serverStatus = {
      running: true,
      port,
      pid: serverProcess?.pid ?? 0,
    };
    console.log(`[electron] ${kind} server healthy on port`, port);
  } else {
    console.warn(`[electron] ${kind} server health check failed`);
  }
}

function stopServer(): void {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    serverProcess = null;
  }
  serverStatus = { running: false, port: 0, pid: 0 };
}

async function restartServer(): Promise<void> {
  stopServer();
  await startServer();
}

// ── IPC handlers ───────────────────────────────────────────────────────────

function registerIpcHandlers() {
  ipcMain.handle("selectDirectory", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Open Project",
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // Read one level of a directory. `relPath` is "" for the root (passed during
  // openProject) or a POSIX-style relative path for sub-directories. `rootPath`
  // is the absolute root chosen by the user.
  ipcMain.handle("readDirectory", async (_e, rootPath: string, relPath: string) => {
    const abs = relPath ? path.join(rootPath, ...relPath.split("/")) : rootPath;
    try {
      const entries = await readDirectoryEntries(abs);
      // Return entries with paths normalized to POSIX and joined with relPath
      // so the renderer can build nested tree paths deterministically.
      return relPath
        ? entries.map((e) => ({
            ...e,
            path: `${relPath}/${e.path}`,
          }))
        : entries;
    } catch (err) {
      console.error("[electron] readDirectory failed:", err);
      return [];
    }
  });

  ipcMain.handle("readWorkspaceDiff", async (_e, rootPath: string) => {
    try {
      return await readWorkspaceDiffs(rootPath);
    } catch (err) {
      console.error("[electron] readWorkspaceDiff failed:", err);
      return [];
    }
  });

  ipcMain.handle("getServerStatus", async () => {
    return serverStatus;
  });

  ipcMain.handle("restartServer", async () => {
    await restartServer();
    return serverStatus;
  });

  ipcMain.handle("getAgentConfig", async () => {
    return agentConfig;
  });

  // Switch active agent: persist config, restart the spawned CLI with the new
  // kind/port, and return updated server status. The renderer is responsible
  // for re-connecting its SSE/REST client afterwards.
  ipcMain.handle("setAgentConfig", async (_e, next: Partial<AgentConfig>) => {
    const merged: AgentConfig = {
      kind: next.kind === "zero" ? "zero" : agentConfig.kind,
      opencodePort:
        typeof next.opencodePort === "number" ? next.opencodePort : agentConfig.opencodePort,
      zeroPort: typeof next.zeroPort === "number" ? next.zeroPort : agentConfig.zeroPort,
    };
    saveAgentConfig(merged);
    await restartServer();
    return { config: agentConfig, status: serverStatus };
  });

  // ── OpenSpec IPC ────────────────────────────────────────────────────────

  ipcMain.handle("readOpenSpecState", async (_e, rootPath: string) => {
    try {
      return await readOpenSpecState(rootPath);
    } catch (err) {
      console.error("[electron] readOpenSpecState failed:", err);
      return null;
    }
  });

  // Toggle a task checkbox in tasks.md. The renderer passes a logical
  // instruction (taskId + desired completed state); main process reads the
  // file, applies a single-line replacement, and writes it back. This keeps
  // the file's other content (evidence subfields, comments) untouched.
  ipcMain.handle(
    "writeOpenSpecTasks",
    async (_e, rootPath: string, changeId: string, taskId: string, completed: boolean) => {
      try {
        if (!/^[a-zA-Z0-9._-]+$/.test(changeId)) {
          return { ok: false, reason: "invalid changeId" };
        }
        const relPath = `openspec/changes/${changeId}/tasks.md`;
        const abs = safeJoinPosix(rootPath, relPath);
        if (!isPathInside(rootPath, abs)) {
          return { ok: false, reason: "path outside project" };
        }
        if (!fs.existsSync(abs)) {
          return { ok: false, reason: "tasks.md not found" };
        }
        const original = fs.readFileSync(abs, "utf-8");
        const newContent = applyTaskToggleShim(original, taskId, completed);
        if (newContent === null) {
          return { ok: false, reason: `task ${taskId} not found` };
        }
        fs.writeFileSync(abs, newContent, "utf-8");
        return { ok: true };
      } catch (err) {
        console.error("[electron] writeOpenSpecTasks failed:", err);
        return { ok: false, reason: String(err) };
      }
    },
  );

  ipcMain.handle("runOpenSpecValidate", async (_e, rootPath: string, changeId?: string) => {
    try {
      return await runOpenspecValidate(rootPath, changeId);
    } catch (err) {
      console.error("[electron] runOpenSpecValidate failed:", err);
      return {
        changeId,
        passed: false,
        cliAvailable: false,
        issues: [
          {
            file: "",
            message: `Failed: ${(err as Error).message}`,
            severity: "error" as const,
          },
        ],
        rawOutput: "",
        ranAt: Date.now(),
      };
    }
  });

  // Initialize openspec/ in the project root.
  // Prefer `openspec init` CLI (matches official layout). If the CLI is not
  // available, fall back to a minimal manual skeleton: openspec/ + specs/ +
  // AGENTS.md placeholder. This lets users enable OpenSpec in browser mode
  // (where CLI invocation is impossible) too.
  ipcMain.handle("initOpenSpec", async (_e, rootPath: string) => {
    try {
      if (!fs.existsSync(rootPath) || !fs.statSync(rootPath).isDirectory()) {
        return { ok: false, reason: "rootPath is not a directory" };
      }
      const openspecRoot = path.join(rootPath, "openspec");
      if (fs.existsSync(openspecRoot)) {
        return { ok: false, reason: "openspec/ already exists" };
      }

      // Try CLI first
      const cli = await detectOpenspecCli();
      if (cli.available) {
        try {
          const result = await runCli(rootPath, ["openspec", "init"]);
          if (result.code === 0) {
            return { ok: true, method: "cli" as const };
          }
          // CLI ran but failed — fall through to manual skeleton
          console.warn(
            "[electron] openspec init exited with code",
            result.code,
            result.stderr.toString("utf8"),
          );
        } catch (e) {
          console.warn("[electron] openspec init threw, falling back:", e);
        }
      }

      // Manual fallback: create minimal skeleton (empty dirs only).
      // Don't fabricate AGENTS.md — that file is auto-generated by
      // `openspec update` and our static content would diverge. Users who
      // later install the CLI can run `openspec update` to materialize it.
      fs.mkdirSync(path.join(openspecRoot, "specs"), { recursive: true });
      fs.mkdirSync(path.join(openspecRoot, "changes"), { recursive: true });
      return { ok: true, method: "manual" as const };
    } catch (err) {
      console.error("[electron] initOpenSpec failed:", err);
      return { ok: false, reason: String(err) };
    }
  });

  // ── Window controls (frameless titlebar) ──────────────────────────────
  ipcMain.handle("window:minimize", () => {
    mainWindow?.minimize();
  });
  ipcMain.handle("window:toggleMaximize", () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    }
    mainWindow.maximize();
    return true;
  });
  ipcMain.handle("window:close", () => {
    mainWindow?.close();
  });
  ipcMain.handle("window:isMaximized", () => {
    return mainWindow?.isMaximized() ?? false;
  });
}

// ── Application menu ──────────────────────────────────────────────────────

async function pickAndOpenFolder(): Promise<void> {
  if (!mainWindow) return;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Open Project Folder",
  });
  if (result.canceled || result.filePaths.length === 0) return;
  mainWindow.webContents.send("menu:openFolder", result.filePaths[0]);
}

function registerMenu() {
  const isMac = process.platform === "darwin";

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ] as MenuItemConstructorOptions[])
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "Open Folder…",
          accelerator: "CmdOrCtrl+O",
          click: () => void pickAndOpenFolder(),
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Window management ──────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "SpecForge",
    // Frameless window with custom titlebar. On macOS keep the traffic-light
    // buttons (titleBarStyle: "hidden") for native familiarity; on Win/Linux
    // go fully frameless and paint our own window controls.
    frame: process.platform === "darwin",
    titleBarStyle: process.platform === "darwin" ? "hidden" : "default",
    trafficLightPosition: { x: 10, y: 10 },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Notify renderer when maximize state changes so the titlebar can swap its
  // maximize/restore icon. macOS uses native traffic lights — no toggle needed.
  const emitMaximizeChange = () => {
    mainWindow?.webContents.send("window:maximizeChange", mainWindow.isMaximized());
  };
  mainWindow.on("maximize", emitMaximizeChange);
  mainWindow.on("unmaximize", emitMaximizeChange);

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // Detach into a standalone window so DevTools doesn't get clipped by the
    // frameless main window and F12 remains accessible.
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

// ── App lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  agentConfig = loadAgentConfig();
  registerIpcHandlers();
  registerMenu();
  await startServer();
  createWindow();
});

app.on("window-all-closed", () => {
  stopServer();
  app.quit();
});

app.on("before-quit", () => {
  stopServer();
});
