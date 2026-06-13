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

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Server management ─────────────────────────────────────────────────────

const SERVER_PORT = 13284;
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
        const req = http.get(
          `http://localhost:${port}/global/health`,
          (res) => {
            res.resume();
            if (res.statusCode === 200) resolve();
            else reject(new Error(`status ${res.statusCode}`));
          },
        );
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
  const cmd = isWin ? "opencode.cmd" : "opencode";
  serverProcess = spawn(cmd, ["serve", "--port", String(SERVER_PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
    shell: isWin,
  });

  serverProcess.stdout?.on("data", (data: Buffer) => {
    console.log("[opencode]", data.toString().trim());
  });

  serverProcess.stderr?.on("data", (data: Buffer) => {
    console.error("[opencode]", data.toString().trim());
  });

  serverProcess.on("error", (err) => {
    console.error("[electron] Failed to start opencode:", err);
    serverProcess = null;
    serverStatus = { running: false, port: 0, pid: 0 };
  });

  serverProcess.on("exit", (code) => {
    console.log("[electron] opencode exited with code", code);
    serverProcess = null;
    serverStatus = { running: false, port: 0, pid: 0 };
  });

  const healthy = await healthCheck(SERVER_PORT);
  if (healthy) {
    serverStatus = {
      running: true,
      port: SERVER_PORT,
      pid: serverProcess?.pid ?? 0,
    };
    console.log("[electron] opencode server healthy on port", SERVER_PORT);
  } else {
    console.warn("[electron] opencode server health check failed");
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
  ipcMain.handle(
    "readDirectory",
    async (_e, rootPath: string, relPath: string) => {
      const abs = relPath
        ? path.join(rootPath, ...relPath.split("/"))
        : rootPath;
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
    },
  );

  ipcMain.handle("getServerStatus", async () => {
    return serverStatus;
  });

  ipcMain.handle("restartServer", async () => {
    await restartServer();
    return serverStatus;
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
      ? ([{
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
        }] as MenuItemConstructorOptions[])
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
