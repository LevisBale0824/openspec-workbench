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
    title: "OpenSpec Workbench",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
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
