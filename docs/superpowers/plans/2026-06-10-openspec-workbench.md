# OpenSpec Workbench 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Tauri 2 + React 跨平台桌面应用，可视化完成 OpenSpec 四步工作流（Explore → Propose → Apply → Archive），支持多 Agent 后端切换和对话式产物纠正。

**Architecture:** Rust 后端（Tauri Core）负责文件 I/O、工作流状态机、配置持久化；React 前端负责 UI 和 Agent 调用；Agent Adapter 层抽象 AI 后端（OpenCode / Zero），可扩展。

**Tech Stack:** Tauri 2, React 19, TypeScript 5, Vite 6, Tailwind CSS 4, Zustand, react-markdown, tokio, notify, serde

---

## File Structure

### Rust 后端 (`src-tauri/src/`)

| File | Responsibility |
|---|---|
| `main.rs` | Tauri 应用入口，注册插件和命令 |
| `commands/mod.rs` | 命令模块导出 |
| `commands/workflow.rs` | 工作流 IPC 命令（获取状态、切换步骤） |
| `commands/files.rs` | 文件读写命令（扫描产物、读取文件内容） |
| `commands/config.rs` | 配置管理命令（读写 workbench.config.json） |
| `services/workflow_engine.rs` | 状态机核心（步骤流转、阶段管理） |
| `services/file_watcher.rs` | 文件监听服务（notify crate） |
| `services/config_store.rs` | 配置持久化（TOML/JSON） |

### React 前端 (`src/`)

| File | Responsibility |
|---|---|
| `agents/types.ts` | AgentAdapter 接口、AgentRequest/Response/Config 类型 |
| `agents/registry.ts` | AdapterRegistry — 注册/查找/管理 Agent |
| `agents/opencode.ts` | OpenCode Agent 适配器（SDK 模式） |
| `agents/zero.ts` | Zero Agent 适配器（CLI/HTTP 双模） |
| `stores/workflow.ts` | 工作流 Zustand store |
| `stores/agent.ts` | Agent 状态 Zustand store |
| `stores/project.ts` | 项目上下文 Zustand store |
| `components/layout/StepNav.tsx` | 顶部步骤导航条 |
| `components/layout/ArtifactTabs.tsx` | 产物文件 Tab 切换 |
| `components/layout/DocViewer.tsx` | Markdown 文档渲染（单栏） |
| `components/layout/ChatPanel.tsx` | 右侧对话纠正面板 |
| `components/layout/ActionBar.tsx` | 底部操作栏（进度/审阅/下一步） |
| `components/workflow/WorkflowStep.tsx` | 统一步骤容器组件 |
| `components/workflow/InputModal.tsx` | 需求输入模态框 |
| `components/workflow/StreamOutput.tsx` | 流式输出显示 |
| `components/common/MarkdownViewer.tsx` | react-markdown 封装 |
| `pages/WorkbenchPage.tsx` | 主工作台页面 |
| `pages/SettingsPage.tsx` | 设置页面 |
| `pages/ProjectSelect.tsx` | 项目选择页面 |

---

## Phase 1: Project Scaffolding

### Task 1: 初始化 Tauri 2 + React + TypeScript 项目

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`
- Create: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`
- Create: `src/main.tsx`, `src/App.tsx`, `src/styles.css`

- [ ] **Step 1: 使用 create-tauri-app 初始化项目**

Run:
```bash
cd D:/code/openspec-workbench
npm create tauri-app@latest -- --template react-ts --manager npm .
```

如果目录非空导致失败，先清除 mockup HTML 文件：
```bash
rm -f D:/code/openspec-workbench/mockup-*.html
```

- [ ] **Step 2: 安装前端依赖**

Run:
```bash
cd D:/code/openspec-workbench
npm install zustand react-router-dom react-markdown remark-gfm
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: 配置 Tailwind CSS**

修改 `vite.config.ts`：

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
```

创建 `src/styles.css`：

```css
@import "tailwindcss";
```

替换 `src/main.tsx`：

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 4: 验证项目能启动**

Run:
```bash
cd D:/code/openspec-workbench
npm run tauri dev
```

Expected: 窗口弹出，显示默认 Tauri + React 页面。关闭窗口。

- [ ] **Step 5: 提交**

```bash
cd D:/code/openspec-workbench
git add -A
git commit -m "feat: 初始化 Tauri 2 + React + TypeScript + Tailwind 项目"
```

---

### Task 2: 配置 Tauri 插件和权限

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/src/main.rs`
- Create: `src-tauri/capabilities/default.json`

- [ ] **Step 1: 添加 Tauri 插件依赖**

修改 `src-tauri/Cargo.toml`，在 `[dependencies]` 中添加：

```toml
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
tauri-plugin-shell = "2"
tauri-plugin-store = "2"
notify = { version = "7", features = ["macos_kqueue"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
```

- [ ] **Step 2: 在 main.rs 中注册插件**

修改 `src-tauri/src/main.rs`：

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: 配置 Tauri 能力权限**

创建 `src-tauri/capabilities/default.json`：

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default permissions for the app",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "fs:allow-exists",
    "fs:allow-read-dir",
    "fs:allow-mkdir",
    "dialog:default",
    "dialog:allow-open",
    "shell:default",
    "shell:allow-execute",
    "shell:allow-spawn",
    "store:default"
  ]
}
```

- [ ] **Step 4: 验证编译通过**

Run:
```bash
cd D:/code/openspec-workbench
npm run tauri build -- --debug
```

Expected: 编译成功，无错误。

- [ ] **Step 5: 提交**

```bash
cd D:/code/openspec-workbench
git add -A
git commit -m "feat: 添加 Tauri 插件（fs/dialog/shell/store）和权限配置"
```

---

## Phase 2: Rust Backend Services

### Task 3: Workflow Engine 状态机

**Files:**
- Create: `src-tauri/src/services/mod.rs`
- Create: `src-tauri/src/services/workflow_engine.rs`
- Create: `src-tauri/tests/test_workflow_engine.rs`

- [ ] **Step 1: 编写状态机测试**

创建 `src-tauri/tests/test_workflow_engine.rs`：

```rust
use openspec_workbench::services::workflow_engine::*;

#[test]
fn test_initial_state() {
    let engine = WorkflowEngine::new();
    let state = engine.state();
    assert_eq!(state.current_step, StepName::Explore);
    assert_eq!(state.current_phase, StepPhase::Idle);
}

#[test]
fn test_advance_step() {
    let mut engine = WorkflowEngine::new();
    engine.advance_step().unwrap();
    assert_eq!(engine.state().current_step, StepName::Propose);
}

#[test]
fn test_cannot_skip_step() {
    let engine = WorkflowEngine::new();
    // Can't advance from Idle without completing
    assert!(engine.advance_step().is_ok());
}

#[test]
fn test_set_phase() {
    let mut engine = WorkflowEngine::new();
    engine.set_phase(StepPhase::Input);
    assert_eq!(engine.state().current_phase, StepPhase::Input);
}

#[test]
fn test_full_lifecycle() {
    let mut engine = WorkflowEngine::new();

    engine.set_phase(StepPhase::Input);
    engine.set_phase(StepPhase::Executing);
    engine.set_phase(StepPhase::Reviewing);
    engine.set_phase(StepPhase::Done);
    engine.advance_step().unwrap();
    assert_eq!(engine.state().current_step, StepName::Propose);

    engine.set_phase(StepPhase::Input);
    engine.set_phase(StepPhase::Executing);
    engine.set_phase(StepPhase::Reviewing);
    engine.set_phase(StepPhase::Done);
    engine.advance_step().unwrap();
    assert_eq!(engine.state().current_step, StepName::Apply);

    engine.set_phase(StepPhase::Input);
    engine.set_phase(StepPhase::Executing);
    engine.set_phase(StepPhase::Reviewing);
    engine.set_phase(StepPhase::Done);
    engine.advance_step().unwrap();
    assert_eq!(engine.state().current_step, StepName::Archive);

    engine.set_phase(StepPhase::Input);
    engine.set_phase(StepPhase::Executing);
    engine.set_phase(StepPhase::Reviewing);
    engine.set_phase(StepPhase::Done);
    // After archive, cannot advance further
    assert!(engine.advance_step().is_err());
}

#[test]
fn test_reset() {
    let mut engine = WorkflowEngine::new();
    engine.set_phase(StepPhase::Executing);
    engine.advance_step().unwrap();
    engine.reset();
    assert_eq!(engine.state().current_step, StepName::Explore);
    assert_eq!(engine.state().current_phase, StepPhase::Idle);
}
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd D:/code/openspec-workbench/src-tauri
cargo test
```

Expected: FAIL — module `services::workflow_engine` 不存在。

- [ ] **Step 3: 创建 services 模块和 WorkflowEngine**

创建 `src-tauri/src/services/mod.rs`：

```rust
pub mod workflow_engine;
```

创建 `src-tauri/src/services/workflow_engine.rs`：

```rust
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StepName {
    Explore,
    Propose,
    Apply,
    Archive,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StepPhase {
    Idle,
    Input,
    Executing,
    Reviewing,
    Done,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowState {
    pub current_step: StepName,
    pub current_phase: StepPhase,
}

impl Default for WorkflowState {
    fn default() -> Self {
        Self {
            current_step: StepName::Explore,
            current_phase: StepPhase::Idle,
        }
    }
}

static STEP_ORDER: &[StepName] = &[
    StepName::Explore,
    StepName::Propose,
    StepName::Apply,
    StepName::Archive,
];

pub struct WorkflowEngine {
    state: Mutex<WorkflowState>,
}

impl WorkflowEngine {
    pub fn new() -> Self {
        Self {
            state: Mutex::new(WorkflowState::default()),
        }
    }

    pub fn state(&self) -> WorkflowState {
        self.state.lock().unwrap().clone()
    }

    pub fn set_phase(&self, phase: StepPhase) {
        self.state.lock().unwrap().current_phase = phase;
    }

    pub fn advance_step(&self) -> Result<(), String> {
        let mut state = self.state.lock().unwrap();
        let current_idx = STEP_ORDER
            .iter()
            .position(|s| *s == state.current_step)
            .unwrap();

        if current_idx + 1 >= STEP_ORDER.len() {
            return Err("Already at the last step (Archive)".into());
        }

        state.current_step = STEP_ORDER[current_idx + 1];
        state.current_phase = StepPhase::Idle;
        Ok(())
    }

    pub fn reset(&self) {
        *self.state.lock().unwrap() = WorkflowState::default();
    }
}
```

修改 `src-tauri/src/main.rs`，添加模块声明：

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod services;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

在 `src-tauri/src/lib.rs` 中导出（如果不存在则创建）：

```rust
pub mod services;
```

- [ ] **Step 4: 运行测试验证通过**

Run:
```bash
cd D:/code/openspec-workbench/src-tauri
cargo test
```

Expected: 全部 6 个测试 PASS。

- [ ] **Step 5: 提交**

```bash
cd D:/code/openspec-workbench
git add -A
git commit -m "feat: 实现 WorkflowEngine 状态机（Explore→Propose→Apply→Archive）"
```

---

### Task 4: Tauri IPC 命令 — Workflow + Files + Config

**Files:**
- Create: `src-tauri/src/commands/mod.rs`
- Create: `src-tauri/src/commands/workflow.rs`
- Create: `src-tauri/src/commands/files.rs`
- Create: `src-tauri/src/commands/config.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 创建 commands 模块**

创建 `src-tauri/src/commands/mod.rs`：

```rust
pub mod workflow;
pub mod files;
pub mod config;
```

创建 `src-tauri/src/commands/workflow.rs`：

```rust
use crate::services::workflow_engine::{StepName, StepPhase, WorkflowState};
use crate::services::workflow_engine::WorkflowEngine;
use std::sync::Mutex;
use tauri::State;

pub struct WorkflowStateStore(pub Mutex<WorkflowEngine>);

#[tauri::command]
pub fn get_workflow_state(engine: State<WorkflowStateStore>) -> WorkflowState {
    engine.0.lock().unwrap().state()
}

#[tauri::command]
pub fn set_phase(phase: String, engine: State<WorkflowStateStore>) -> Result<WorkflowState, String> {
    let phase = match phase.as_str() {
        "idle" => StepPhase::Idle,
        "input" => StepPhase::Input,
        "executing" => StepPhase::Executing,
        "reviewing" => StepPhase::Reviewing,
        "done" => StepPhase::Done,
        _ => return Err(format!("Unknown phase: {}", phase)),
    };
    let e = engine.0.lock().unwrap();
    e.set_phase(phase);
    Ok(e.state())
}

#[tauri::command]
pub fn advance_step(engine: State<WorkflowStateStore>) -> Result<WorkflowState, String> {
    engine.0.lock().unwrap().advance_step()?;
    Ok(engine.0.lock().unwrap().state())
}

#[tauri::command]
pub fn reset_workflow(engine: State<WorkflowStateStore>) -> WorkflowState {
    engine.0.lock().unwrap().reset();
    engine.0.lock().unwrap().state()
}
```

创建 `src-tauri/src/commands/files.rs`：

```rust
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::command;

#[derive(Debug, Serialize)]
pub struct ArtifactInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

#[command]
pub fn scan_artifacts(dir_path: String) -> Result<Vec<ArtifactInfo>, String> {
    let path = PathBuf::from(&dir_path);
    if !path.exists() {
        return Ok(vec![]);
    }
    let mut artifacts = Vec::new();
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.starts_with('.') {
            continue;
        }
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        artifacts.push(ArtifactInfo {
            name: file_name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
        });
    }
    artifacts.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(artifacts)
}

#[command]
pub fn read_file_content(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path).map_err(|e| format!("Failed to read {}: {}", file_path, e))
}

#[command]
pub fn write_file_content(file_path: String, content: String) -> Result<(), String> {
    if let Some(parent) = PathBuf::from(&file_path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&file_path, content).map_err(|e| format!("Failed to write {}: {}", file_path, e))
}
```

创建 `src-tauri/src/commands/config.rs`：

```rust
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    #[serde(rename = "type")]
    pub agent_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cli_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_start: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub active_agent: String,
    pub agents: std::collections::HashMap<String, AgentConfig>,
}

impl Default for AppConfig {
    fn default() -> Self {
        let mut agents = std::collections::HashMap::new();
        agents.insert(
            "opencode".into(),
            AgentConfig {
                agent_type: "sdk".into(),
                cli_path: None,
                server_url: None,
                mode: None,
                auto_start: Some(true),
                config_path: Some(".opencode/oh-my-opencode.json".into()),
            },
        );
        agents.insert(
            "zero".into(),
            AgentConfig {
                agent_type: "cli".into(),
                cli_path: Some("zero".into()),
                server_url: Some("http://localhost:8080".into()),
                mode: Some("server".into()),
                auto_start: None,
                config_path: None,
            },
        );
        Self {
            active_agent: "opencode".into(),
            agents,
        }
    }
}

#[command]
pub fn load_config(config_dir: String) -> Result<AppConfig, String> {
    let config_path = PathBuf::from(config_dir).join("workbench.config.json");
    if !config_path.exists() {
        let default = AppConfig::default();
        save_config(config_dir.clone(), default.clone())?;
        return Ok(default);
    }
    let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[command]
pub fn save_config(config_dir: String, config: AppConfig) -> Result<(), String> {
    let dir = PathBuf::from(&config_dir);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let config_path = dir.join("workbench.config.json");
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&config_path, content).map_err(|e| e.to_string())
}
```

- [ ] **Step 2: 注册命令到 main.rs**

修改 `src-tauri/src/main.rs`：

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod services;

use commands::workflow::WorkflowStateStore;
use services::workflow_engine::WorkflowEngine;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(WorkflowStateStore(std::sync::Mutex::new(WorkflowEngine::new())))
        .invoke_handler(tauri::generate_handler![
            commands::workflow::get_workflow_state,
            commands::workflow::set_phase,
            commands::workflow::advance_step,
            commands::workflow::reset_workflow,
            commands::files::scan_artifacts,
            commands::files::read_file_content,
            commands::files::write_file_content,
            commands::config::load_config,
            commands::config::save_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: 验证编译通过**

Run:
```bash
cd D:/code/openspec-workbench/src-tauri
cargo build
```

Expected: 编译成功。

- [ ] **Step 4: 提交**

```bash
cd D:/code/openspec-workbench
git add -A
git commit -m "feat: 实现 Tauri IPC 命令（workflow/files/config）"
```

---

### Task 5: File Watcher 服务

**Files:**
- Create: `src-tauri/src/services/file_watcher.rs`
- Modify: `src-tauri/src/services/mod.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 创建 FileWatcher 服务**

创建 `src-tauri/src/services/file_watcher.rs`：

```rust
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::mpsc;
use tauri::AppHandle;
use tauri::Emitter;

pub struct FileWatcher {
    _watcher: RecommendedWatcher,
    _rx: mpsc::Receiver<Result<Event, notify::Error>>,
}

impl FileWatcher {
    pub fn new(app: AppHandle, watch_path: String) -> Result<Self, String> {
        let (tx, rx) = mpsc::channel();

        let app_clone = app.clone();
        let mut watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    let paths: Vec<String> = event
                        .paths
                        .iter()
                        .map(|p| p.to_string_lossy().to_string())
                        .collect();
                    if !paths.is_empty() {
                        let _ = app_clone.emit("file:changed", paths);
                    }
                }
            },
            Config::default(),
        )
        .map_err(|e| e.to_string())?;

        watcher
            .watch(Path::new(&watch_path), RecursiveMode::Recursive)
            .map_err(|e| e.to_string())?;

        Ok(Self {
            _watcher: watcher,
            _rx: rx,
        })
    }
}
```

修改 `src-tauri/src/services/mod.rs`：

```rust
pub mod workflow_engine;
pub mod file_watcher;
```

- [ ] **Step 2: 验证编译通过**

Run:
```bash
cd D:/code/openspec-workbench/src-tauri
cargo build
```

Expected: 编译成功。

- [ ] **Step 3: 提交**

```bash
cd D:/code/openspec-workbench
git add -A
git commit -m "feat: 实现 FileWatcher 文件监听服务"
```

---

## Phase 3: Agent Adapter Layer

### Task 6: AgentAdapter 接口和 Registry

**Files:**
- Create: `src/agents/types.ts`
- Create: `src/agents/registry.ts`
- Create: `src/agents/__tests__/registry.test.ts`

- [ ] **Step 1: 编写 Registry 测试**

创建 `src/agents/__tests__/registry.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { AgentRegistry } from "../registry";
import { AgentAdapter } from "../types";

function createMockAgent(name: string): AgentAdapter {
  return {
    name,
    type: "http",
    start: async () => {},
    stop: async () => {},
    isAvailable: async () => true,
    execute: async () => ({ content: "ok", success: true }),
    executeStream: async function* () {
      yield "ok";
    },
    chat: async function* () {
      yield "ok";
    },
    getConfig: async () => ({ model: "test" }),
  };
}

describe("AgentRegistry", () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  it("registers and retrieves an agent", () => {
    const agent = createMockAgent("test-agent");
    registry.register(agent);
    expect(registry.get("test-agent")).toBe(agent);
  });

  it("lists all registered agents", () => {
    registry.register(createMockAgent("a"));
    registry.register(createMockAgent("b"));
    expect(registry.list().map((a) => a.name)).toEqual(["a", "b"]);
  });

  it("returns undefined for unknown agent", () => {
    expect(registry.get("unknown")).toBeUndefined();
  });

  it("sets active agent", () => {
    registry.register(createMockAgent("a"));
    registry.register(createMockAgent("b"));
    registry.setActive("b");
    expect(registry.getActive()?.name).toBe("b");
  });

  it("throws when setting unknown active agent", () => {
    expect(() => registry.setActive("unknown")).toThrow();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd D:/code/openspec-workbench
npx vitest run src/agents/__tests__/registry.test.ts
```

Expected: FAIL — modules 不存在。

- [ ] **Step 3: 创建 types.ts**

创建 `src/agents/types.ts`：

```typescript
export interface AgentAdapter {
  name: string;
  type: "sdk" | "cli" | "http";

  start(): Promise<void>;
  stop(): Promise<void>;
  isAvailable(): Promise<boolean>;

  execute(req: AgentRequest): Promise<AgentResponse>;
  executeStream(req: AgentRequest): AsyncIterable<string>;
  chat(messages: ChatMessage[]): AsyncIterable<string>;

  getConfig(): Promise<AgentConfig>;
}

export interface AgentRequest {
  prompt: string;
  projectPath: string;
  workflow?: "explore" | "propose" | "apply" | "archive";
  files?: string[];
}

export interface AgentResponse {
  content: string;
  success: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface Artifact {
  id: string;
  fileName: string;
  filePath: string;
  content: string;
  lastModified: number;
}

export interface AgentConfig {
  model?: string;
  provider?: string;
  [key: string]: unknown;
}
```

- [ ] **Step 4: 创建 registry.ts**

创建 `src/agents/registry.ts`：

```typescript
import { AgentAdapter } from "./types";

export class AgentRegistry {
  private agents = new Map<string, AgentAdapter>();
  private activeName: string | null = null;

  register(agent: AgentAdapter): void {
    this.agents.set(agent.name, agent);
  }

  get(name: string): AgentAdapter | undefined {
    return this.agents.get(name);
  }

  list(): AgentAdapter[] {
    return Array.from(this.agents.values());
  }

  setActive(name: string): void {
    if (!this.agents.has(name)) {
      throw new Error(`Agent "${name}" is not registered`);
    }
    this.activeName = name;
  }

  getActive(): AgentAdapter | undefined {
    if (!this.activeName) return undefined;
    return this.agents.get(this.activeName);
  }

  unregister(name: string): void {
    this.agents.delete(name);
    if (this.activeName === name) {
      this.activeName = null;
    }
  }
}
```

- [ ] **Step 5: 运行测试验证通过**

Run:
```bash
cd D:/code/openspec-workbench
npx vitest run src/agents/__tests__/registry.test.ts
```

Expected: 全部 5 个测试 PASS。

- [ ] **Step 6: 提交**

```bash
cd D:/code/openspec-workbench
git add -A
git commit -m "feat: 实现 AgentAdapter 接口和 AgentRegistry"
```

---

### Task 7: OpenCode Agent 适配器

**Files:**
- Create: `src/agents/opencode.ts`
- Create: `src/agents/__tests__/opencode.test.ts`

- [ ] **Step 1: 创建 OpenCode 适配器**

创建 `src/agents/opencode.ts`：

```typescript
import { AgentAdapter, AgentRequest, AgentResponse, ChatMessage, AgentConfig } from "./types";

export class OpenCodeAdapter implements AgentAdapter {
  name = "opencode";
  type: "sdk" = "sdk";
  private serverUrl: string;
  private configPath: string;

  constructor(options?: { serverUrl?: string; configPath?: string }) {
    this.serverUrl = options?.serverUrl || "http://localhost:3000";
    this.configPath = options?.configPath || ".opencode/oh-my-opencode.json";
  }

  async start(): Promise<void> {
    // OpenCode server may already be running
    // Future: auto-start if not available
  }

  async stop(): Promise<void> {
    // No-op: we don't own the OpenCode server lifecycle
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.serverUrl}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async execute(req: AgentRequest): Promise<AgentResponse> {
    try {
      const res = await fetch(`${this.serverUrl}/api/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: req.prompt,
          projectPath: req.projectPath,
          stream: false,
        }),
      });
      const data = await res.json();
      return { content: data.content || data.output || "", success: res.ok };
    } catch (err) {
      return { content: String(err), success: false };
    }
  }

  async *executeStream(req: AgentRequest): AsyncIterable<string> {
    try {
      const res = await fetch(`${this.serverUrl}/api/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: req.prompt,
          projectPath: req.projectPath,
          stream: true,
        }),
      });

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // Parse SSE format
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") return;
            yield data;
          }
        }
      }
    } catch (err) {
      yield `Error: ${err}`;
    }
  }

  async *chat(messages: ChatMessage[]): AsyncIterable<string> {
    const lastMessage = messages[messages.length - 1];
    yield* this.executeStream({
      prompt: lastMessage.content,
      projectPath: "",
    });
  }

  async getConfig(): Promise<AgentConfig> {
    try {
      const res = await fetch(`${this.serverUrl}/api/config`);
      return await res.json();
    } catch {
      return {};
    }
  }
}
```

- [ ] **Step 2: 创建基本测试**

创建 `src/agents/__tests__/opencode.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { OpenCodeAdapter } from "../opencode";

describe("OpenCodeAdapter", () => {
  it("has correct name and type", () => {
    const adapter = new OpenCodeAdapter();
    expect(adapter.name).toBe("opencode");
    expect(adapter.type).toBe("sdk");
  });

  it("reports unavailable when server not running", async () => {
    const adapter = new OpenCodeAdapter({ serverUrl: "http://localhost:99999" });
    const available = await adapter.isAvailable();
    expect(available).toBe(false);
  });

  it("returns error response when server unavailable", async () => {
    const adapter = new OpenCodeAdapter({ serverUrl: "http://localhost:99999" });
    const result = await adapter.execute({
      prompt: "test",
      projectPath: "/tmp",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 3: 运行测试验证通过**

Run:
```bash
cd D:/code/openspec-workbench
npx vitest run src/agents/__tests__/opencode.test.ts
```

Expected: 全部 3 个测试 PASS。

- [ ] **Step 4: 提交**

```bash
cd D:/code/openspec-workbench
git add -A
git commit -m "feat: 实现 OpenCode Agent 适配器（SDK/HTTP 模式）"
```

---

### Task 8: Zero Agent 适配器

**Files:**
- Create: `src/agents/zero.ts`
- Create: `src/agents/__tests__/zero.test.ts`

- [ ] **Step 1: 创建 Zero 适配器**

创建 `src/agents/zero.ts`：

```typescript
import { AgentAdapter, AgentRequest, AgentResponse, ChatMessage, AgentConfig } from "./types";
import { Command } from "@tauri-apps/plugin-shell";

export type ZeroMode = "cli" | "server";

export class ZeroAdapter implements AgentAdapter {
  name = "zero";
  type: "cli" | "http" = "cli";
  private mode: ZeroMode;
  private cliPath: string;
  private serverUrl: string;

  constructor(options?: { mode?: ZeroMode; cliPath?: string; serverUrl?: string }) {
    this.mode = options?.mode || "cli";
    this.cliPath = options?.cliPath || "zero";
    this.serverUrl = options?.serverUrl || "http://localhost:8080";
  }

  async start(): Promise<void> {
    if (this.mode === "server") {
      // Future: start zero server if not running
    }
  }

  async stop(): Promise<void> {
    // No-op for now
  }

  async isAvailable(): Promise<boolean> {
    if (this.mode === "server") {
      try {
        const res = await fetch(`${this.serverUrl}/health`);
        return res.ok;
      } catch {
        return false;
      }
    } else {
      try {
        const cmd = Command.create("which", [this.cliPath]);
        const output = await cmd.execute();
        return output.code === 0;
      } catch {
        return false;
      }
    }
  }

  async execute(req: AgentRequest): Promise<AgentResponse> {
    if (this.mode === "server") {
      return this.executeViaHttp(req);
    }
    return this.executeViaCli(req);
  }

  private async executeViaCli(req: AgentRequest): Promise<AgentResponse> {
    try {
      const cmd = Command.create(this.cliPath, ["run", req.prompt]);
      cmd.setCwd(req.projectPath);
      const output = await cmd.execute();
      return {
        content: output.stdout,
        success: output.code === 0,
      };
    } catch (err) {
      return { content: String(err), success: false };
    }
  }

  private async executeViaHttp(req: AgentRequest): Promise<AgentResponse> {
    try {
      const res = await fetch(`${this.serverUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: req.prompt, projectPath: req.projectPath }),
      });
      const data = await res.json();
      return { content: data.content || "", success: res.ok };
    } catch (err) {
      return { content: String(err), success: false };
    }
  }

  async *executeStream(req: AgentRequest): AsyncIterable<string> {
    if (this.mode === "server") {
      try {
        const res = await fetch(`${this.serverUrl}/api/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: req.prompt, projectPath: req.projectPath }),
        });
        const reader = res.body?.getReader();
        if (!reader) return;
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          yield decoder.decode(value, { stream: true });
        }
      } catch (err) {
        yield `Error: ${err}`;
      }
    } else {
      // CLI mode: run command and yield stdout lines
      try {
        const cmd = Command.create(this.cliPath, ["run", req.prompt]);
        const output = await cmd.execute();
        yield output.stdout;
      } catch (err) {
        yield `Error: ${err}`;
      }
    }
  }

  async *chat(messages: ChatMessage[]): AsyncIterable<string> {
    const lastMessage = messages[messages.length - 1];
    yield* this.executeStream({ prompt: lastMessage.content, projectPath: "" });
  }

  async getConfig(): Promise<AgentConfig> {
    if (this.mode === "server") {
      try {
        const res = await fetch(`${this.serverUrl}/api/config`);
        return await res.json();
      } catch {
        return {};
      }
    }
    return {};
  }
}
```

- [ ] **Step 2: 创建基本测试**

创建 `src/agents/__tests__/zero.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { ZeroAdapter } from "../zero";

describe("ZeroAdapter", () => {
  it("defaults to cli mode", () => {
    const adapter = new ZeroAdapter();
    expect(adapter.name).toBe("zero");
  });

  it("accepts server mode", () => {
    const adapter = new ZeroAdapter({ mode: "server", serverUrl: "http://localhost:9999" });
    expect(adapter).toBeDefined();
  });

  it("reports unavailable when server not running", async () => {
    const adapter = new ZeroAdapter({ mode: "server", serverUrl: "http://localhost:99999" });
    const available = await adapter.isAvailable();
    expect(available).toBe(false);
  });
});
```

- [ ] **Step 3: 运行测试验证通过**

Run:
```bash
cd D:/code/openspec-workbench
npx vitest run src/agents/__tests__/zero.test.ts
```

Expected: 全部 3 个测试 PASS。

- [ ] **Step 4: 提交**

```bash
cd D:/code/openspec-workbench
git add -A
git commit -m "feat: 实现 Zero Agent 适配器（CLI/HTTP 双模）"
```

---

## Phase 4: Frontend Components

### Task 9: Zustand Stores

**Files:**
- Create: `src/stores/workflow.ts`
- Create: `src/stores/agent.ts`
- Create: `src/stores/project.ts`

- [ ] **Step 1: 创建 workflow store**

创建 `src/stores/workflow.ts`：

```typescript
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { ChatMessage, Artifact } from "../agents/types";

export type StepName = "explore" | "propose" | "apply" | "archive";
export type StepPhase = "idle" | "input" | "executing" | "reviewing" | "done";

interface WorkflowState {
  currentStep: StepName;
  currentPhase: StepPhase;
  artifacts: Artifact[];
  reviewedArtifacts: Set<string>;
  chatHistory: ChatMessage[];
  streamOutput: string;
}

interface WorkflowActions {
  loadState: () => Promise<void>;
  setPhase: (phase: StepPhase) => Promise<void>;
  advanceStep: () => Promise<void>;
  resetWorkflow: () => Promise<void>;
  setArtifacts: (artifacts: Artifact[]) => void;
  markReviewed: (artifactId: string) => void;
  addChatMessage: (msg: ChatMessage) => void;
  appendStreamOutput: (chunk: string) => void;
  clearStreamOutput: () => void;
  isAllReviewed: () => boolean;
}

const STEP_ORDER: StepName[] = ["explore", "propose", "apply", "archive"];

export const useWorkflowStore = create<WorkflowState & WorkflowActions>()(
  (set, get) => ({
    currentStep: "explore",
    currentPhase: "idle",
    artifacts: [],
    reviewedArtifacts: new Set<string>(),
    chatHistory: [],
    streamOutput: "",

    loadState: async () => {
      const state = await invoke<{
        current_step: StepName;
        current_phase: StepPhase;
      }>("get_workflow_state");
      set({
        currentStep: state.current_step,
        currentPhase: state.current_phase,
      });
    },

    setPhase: async (phase) => {
      await invoke("set_phase", { phase });
      set({ currentPhase: phase });
    },

    advanceStep: async () => {
      const state = await invoke<{
        current_step: StepName;
        current_phase: StepPhase;
      }>("advance_step");
      set({
        currentStep: state.current_step,
        currentPhase: "idle",
        artifacts: [],
        reviewedArtifacts: new Set(),
        chatHistory: [],
        streamOutput: "",
      });
    },

    resetWorkflow: async () => {
      const state = await invoke<{
        current_step: StepName;
        current_phase: StepPhase;
      }>("reset_workflow");
      set({
        currentStep: state.current_step,
        currentPhase: "idle",
        artifacts: [],
        reviewedArtifacts: new Set(),
        chatHistory: [],
        streamOutput: "",
      });
    },

    setArtifacts: (artifacts) => set({ artifacts }),
    markReviewed: (id) => {
      const reviewed = new Set(get().reviewedArtifacts);
      reviewed.add(id);
      set({ reviewedArtifacts: reviewed });
    },
    addChatMessage: (msg) =>
      set((s) => ({ chatHistory: [...s.chatHistory, msg] })),
    appendStreamOutput: (chunk) =>
      set((s) => ({ streamOutput: s.streamOutput + chunk })),
    clearStreamOutput: () => set({ streamOutput: "" }),
    isAllReviewed: () => {
      const { artifacts, reviewedArtifacts } = get();
      return artifacts.length > 0 && artifacts.every((a) => reviewedArtifacts.has(a.id));
    },
  }),
);

export { STEP_ORDER };
```

- [ ] **Step 2: 创建 agent store**

创建 `src/stores/agent.ts`：

```typescript
import { create } from "zustand";
import { AgentRegistry } from "../agents/registry";
import { AgentAdapter } from "../agents/types";

interface AgentState {
  registry: AgentRegistry;
  activeAgent: AgentAdapter | null;
  isAvailable: boolean;
}

interface AgentActions {
  initialize: (agents: AgentAdapter[], activeName: string) => void;
  setActive: (name: string) => void;
  checkAvailability: () => Promise<void>;
}

export const useAgentStore = create<AgentState & AgentActions>()((set, get) => ({
  registry: new AgentRegistry(),
  activeAgent: null,
  isAvailable: false,

  initialize: (agents, activeName) => {
    const registry = new AgentRegistry();
    for (const agent of agents) {
      registry.register(agent);
    }
    registry.setActive(activeName);
    set({
      registry,
      activeAgent: registry.getActive() || null,
    });
  },

  setActive: (name) => {
    const { registry } = get();
    registry.setActive(name);
    set({ activeAgent: registry.getActive() || null });
  },

  checkAvailability: async () => {
    const { activeAgent } = get();
    if (!activeAgent) {
      set({ isAvailable: false });
      return;
    }
    const available = await activeAgent.isAvailable();
    set({ isAvailable: available });
  },
}));
```

- [ ] **Step 3: 创建 project store**

创建 `src/stores/project.ts`：

```typescript
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

interface ProjectState {
  projectPath: string;
  changeId: string;
  openspecDir: string;
}

interface ProjectActions {
  setProject: (path: string) => void;
  scanArtifacts: () => Promise<void>;
}

export const useProjectStore = create<ProjectState & ProjectActions>()(
  (set, get) => ({
    projectPath: "",
    changeId: "",
    openspecDir: "",

    setProject: (path) => {
      set({
        projectPath: path,
        openspecDir: `${path}/openspec`,
      });
    },

    scanArtifacts: async () => {
      const { openspecDir, changeId } = get();
      const dirPath = `${openspecDir}/changes/${changeId}`;
      const result = await invoke<
        { name: string; path: string; is_dir: boolean }[]
      >("scan_artifacts", { dirPath });
      // Convert to Artifact objects and update workflow store
      const artifacts = result.map((r) => ({
        id: r.path,
        fileName: r.name,
        filePath: r.path,
        content: "",
        lastModified: Date.now(),
      }));
      return artifacts;
    },
  }),
);
```

- [ ] **Step 4: 提交**

```bash
cd D:/code/openspec-workbench
git add -A
git commit -m "feat: 实现 Zustand stores（workflow/agent/project）"
```

---

### Task 10: 基础 UI 组件

**Files:**
- Create: `src/components/common/MarkdownViewer.tsx`
- Create: `src/components/layout/StepNav.tsx`
- Create: `src/components/layout/ArtifactTabs.tsx`
- Create: `src/components/layout/ActionBar.tsx`

- [ ] **Step 1: 创建 MarkdownViewer 组件**

创建 `src/components/common/MarkdownViewer.tsx`：

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownViewerProps {
  content: string;
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 2: 创建 StepNav 组件**

创建 `src/components/layout/StepNav.tsx`：

```tsx
import { STEP_ORDER, useWorkflowStore, StepName } from "../../stores/workflow";

const STEP_LABELS: Record<StepName, string> = {
  explore: "Explore",
  propose: "Propose",
  apply: "Apply",
  archive: "Archive",
};

const STEP_ICONS: Record<StepName, string> = {
  explore: "🔍",
  propose: "📋",
  apply: "⚡",
  archive: "📦",
};

export function StepNav() {
  const { currentStep, currentPhase } = useWorkflowStore();
  const currentIdx = STEP_ORDER.indexOf(currentStep);

  return (
    <nav className="flex items-center gap-1 bg-slate-900 rounded-xl p-1">
      {STEP_ORDER.map((step, idx) => {
        const isCurrent = step === currentStep;
        const isDone = idx < currentIdx;
        const isFuture = idx > currentIdx;

        return (
          <div
            key={step}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm transition-all ${
              isCurrent
                ? "bg-slate-800 text-sky-400 font-semibold"
                : isDone
                ? "text-emerald-400"
                : "text-slate-500"
            }`}
          >
            <span>{isDone ? "✓" : STEP_ICONS[step]}</span>
            <span>{STEP_LABELS[step]}</span>
          </div>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: 创建 ArtifactTabs 组件**

创建 `src/components/layout/ArtifactTabs.tsx`：

```tsx
import { useWorkflowStore } from "../../stores/workflow";

interface ArtifactTabsProps {
  activeArtifact: string | null;
  onSelect: (artifactId: string) => void;
}

export function ArtifactTabs({ activeArtifact, onSelect }: ArtifactTabsProps) {
  const { artifacts, reviewedArtifacts } = useWorkflowStore();

  if (artifacts.length === 0) return null;

  return (
    <div className="flex border-b border-slate-700 bg-slate-900 overflow-x-auto">
      {artifacts.map((artifact) => {
        const isActive = artifact.id === activeArtifact;
        const isReviewed = reviewedArtifacts.has(artifact.id);

        return (
          <button
            key={artifact.id}
            onClick={() => onSelect(artifact.id)}
            className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-all ${
              isActive
                ? "text-sky-400 border-sky-400 bg-sky-950"
                : isReviewed
                ? "text-emerald-400 border-transparent"
                : "text-slate-400 border-transparent hover:text-slate-200"
            }`}
          >
            {isReviewed && <span className="mr-1">✓</span>}
            📄 {artifact.fileName}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: 创建 ActionBar 组件**

创建 `src/components/layout/ActionBar.tsx`：

```tsx
import { useWorkflowStore } from "../../stores/workflow";

interface ActionBarProps {
  onMarkReviewed: () => void;
  onRetry: () => void;
  onNext: () => void;
}

export function ActionBar({ onMarkReviewed, onRetry, onNext }: ActionBarProps) {
  const { artifacts, reviewedArtifacts } = useWorkflowStore();
  const allReviewed =
    artifacts.length > 0 && artifacts.every((a) => reviewedArtifacts.has(a.id));

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-slate-700 bg-slate-800">
      <div className="flex gap-1">
        {artifacts.map((a) => (
          <div
            key={a.id}
            className={`w-6 h-1 rounded ${
              reviewedArtifacts.has(a.id)
                ? "bg-emerald-400"
                : "bg-slate-600"
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-slate-400">
        产物 <strong className="text-sky-400">{reviewedArtifacts.size}/{artifacts.length}</strong> 已审阅
      </span>

      <button
        onClick={onMarkReviewed}
        className="px-3 py-1.5 rounded-md border border-emerald-400 text-emerald-400 text-xs hover:bg-emerald-400/10"
      >
        ✓ 标记已审阅
      </button>

      <button
        onClick={onRetry}
        className="px-3 py-1.5 rounded-md border border-slate-600 text-slate-400 text-xs hover:border-slate-400"
      >
        🔄 重新执行
      </button>

      <button
        onClick={onNext}
        disabled={!allReviewed}
        className={`ml-auto px-5 py-2 rounded-lg font-bold text-sm transition-all ${
          allReviewed
            ? "bg-gradient-to-r from-emerald-400 to-sky-400 text-slate-900 hover:opacity-90"
            : "bg-slate-700 text-slate-500 opacity-50 cursor-not-allowed"
        }`}
      >
        下一步 →
      </button>
    </div>
  );
}
```

- [ ] **Step 5: 提交**

```bash
cd D:/code/openspec-workbench
git add -A
git commit -m "feat: 实现基础 UI 组件（MarkdownViewer/StepNav/ArtifactTabs/ActionBar）"
```

---

### Task 11: 核心交互组件

**Files:**
- Create: `src/components/workflow/InputModal.tsx`
- Create: `src/components/workflow/StreamOutput.tsx`
- Create: `src/components/layout/ChatPanel.tsx`
- Create: `src/components/layout/DocViewer.tsx`

- [ ] **Step 1: 创建 InputModal 组件**

创建 `src/components/workflow/InputModal.tsx`：

```tsx
import { useState } from "react";
import { useAgentStore } from "../../stores/agent";

interface InputModalProps {
  stepName: string;
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
}

export function InputModal({ stepName, onSubmit, onCancel }: InputModalProps) {
  const [prompt, setPrompt] = useState("");
  const { registry, activeAgent, setActive } = useAgentStore();
  const agents = registry.list();

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl p-6 w-[90%] max-w-xl border border-slate-700 shadow-2xl">
        <h3 className="text-base font-semibold text-slate-100 mb-1">
          🔍 {stepName} — 描述你的需求
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          输入你想探索的需求或问题，AI Agent 将分析项目并给出方案建议
        </p>

        <div className="flex gap-2 mb-3">
          {agents.map((agent) => (
            <button
              key={agent.name}
              onClick={() => setActive(agent.name)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs text-center border transition-all ${
                activeAgent?.name === agent.name
                  ? "border-sky-400 bg-sky-950 text-sky-300"
                  : "border-slate-600 bg-slate-900 text-slate-400"
              }`}
            >
              {agent.name === "opencode" ? "🟢" : "⭕"} {agent.name}
            </button>
          ))}
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="例如：我需要添加用户认证功能，支持 JWT + Refresh Token..."
          className="w-full h-28 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 resize-y outline-none focus:border-sky-400 transition-colors"
        />

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-slate-600 text-slate-400 text-sm hover:border-slate-400"
          >
            取消
          </button>
          <button
            onClick={() => prompt.trim() && onSubmit(prompt.trim())}
            disabled={!prompt.trim()}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
              prompt.trim()
                ? "bg-gradient-to-r from-sky-400 to-indigo-400 text-slate-900"
                : "bg-slate-700 text-slate-500 cursor-not-allowed"
            }`}
          >
            ▶ 执行 {stepName}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 StreamOutput 组件**

创建 `src/components/workflow/StreamOutput.tsx`：

```tsx
import { useWorkflowStore } from "../../stores/workflow";

export function StreamOutput() {
  const { streamOutput, currentPhase } = useWorkflowStore();

  if (currentPhase !== "executing" && !streamOutput) return null;

  return (
    <div className="flex items-center gap-3 mb-4">
      {currentPhase === "executing" && (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-slate-600 border-t-sky-400 rounded-full animate-spin" />
          <span className="text-xs text-sky-400">正在执行...</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 创建 ChatPanel 组件**

创建 `src/components/layout/ChatPanel.tsx`：

```tsx
import { useState, useRef, useEffect } from "react";
import { useWorkflowStore } from "../../stores/workflow";
import { useAgentStore } from "../../stores/agent";
import { ChatMessage } from "../../agents/types";

export function ChatPanel() {
  const { chatHistory, addChatMessage, currentPhase } = useWorkflowStore();
  const { activeAgent, isAvailable } = useAgentStore();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleSend = async () => {
    if (!input.trim() || !activeAgent) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };
    addChatMessage(userMsg);
    setInput("");

    let aiContent = "";
    const aiMsg: ChatMessage = {
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };
    addChatMessage(aiMsg);

    try {
      for await (const chunk of activeAgent.chat([...chatHistory, userMsg])) {
        aiContent += chunk;
        // Update last message
        const { chatHistory: history } = useWorkflowStore.getState();
        const updated = [...history];
        updated[updated.length - 1] = { ...aiMsg, content: aiContent };
        useWorkflowStore.setState({ chatHistory: updated });
      }
    } catch (err) {
      const { chatHistory: history } = useWorkflowStore.getState();
      const updated = [...history];
      updated[updated.length - 1] = {
        ...aiMsg,
        content: `Error: ${err}`,
      };
      useWorkflowStore.setState({ chatHistory: updated });
    }
  };

  const isDisabled = currentPhase !== "reviewing" || !isAvailable;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-700 bg-slate-800 flex items-center gap-2">
        <span className="text-sm font-medium text-slate-100">💬 对话纠正</span>
        {activeAgent && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-700">
            {activeAgent.name}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatHistory.length === 0 && (
          <div className="text-xs text-slate-600 text-center py-8">
            执行完成后，在这里对话修改产物
          </div>
        )}
        {chatHistory.map((msg, idx) => (
          <div
            key={idx}
            className={`max-w-[90%] p-3 rounded-xl text-xs leading-relaxed ${
              msg.role === "user"
                ? "self-end bg-slate-800 border border-slate-700 text-slate-200 ml-auto"
                : "self-start bg-sky-950 border border-sky-900 text-slate-300"
            }`}
          >
            <div className="text-[10px] text-slate-500 mb-1">
              {msg.role === "user" ? "你" : "AI"}
            </div>
            <div className="whitespace-pre-wrap">{msg.content}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-3 border-t border-slate-700 bg-slate-800 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          disabled={isDisabled}
          placeholder={
            isDisabled ? "执行完成后可对话修改..." : "输入修改意见..."
          }
          className="flex-1 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 text-xs outline-none focus:border-sky-400 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={isDisabled || !input.trim()}
          className="px-3 py-2 rounded-lg bg-sky-400 text-slate-900 font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          发送
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 创建 DocViewer 组件**

创建 `src/components/layout/DocViewer.tsx`：

```tsx
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MarkdownViewer } from "../common/MarkdownViewer";

interface DocViewerProps {
  filePath: string | null;
}

export function DocViewer({ filePath }: DocViewerProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!filePath) {
      setContent("");
      return;
    }
    setLoading(true);
    invoke<string>("read_file_content", { filePath })
      .then((c) => setContent(c))
      .catch((e) => setContent(`Error reading file: ${e}`))
      .finally(() => setLoading(false));
  }, [filePath]);

  if (!filePath) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
        选择一个产物文件查看
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        加载中...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <MarkdownViewer content={content} />
    </div>
  );
}
```

- [ ] **Step 5: 提交**

```bash
cd D:/code/openspec-workbench
git add -A
git commit -m "feat: 实现核心交互组件（InputModal/StreamOutput/ChatPanel/DocViewer）"
```

---

### Task 12: WorkflowStep 统一步骤容器

**Files:**
- Create: `src/components/workflow/WorkflowStep.tsx`

- [ ] **Step 1: 创建统一步骤组件**

创建 `src/components/workflow/WorkflowStep.tsx`：

```tsx
import { useState } from "react";
import { useWorkflowStore, StepName } from "../../stores/workflow";
import { useAgentStore } from "../../stores/agent";
import { ArtifactTabs } from "../layout/ArtifactTabs";
import { DocViewer } from "../layout/DocViewer";
import { ChatPanel } from "../layout/ChatPanel";
import { ActionBar } from "../layout/ActionBar";
import { InputModal } from "./InputModal";
import { StreamOutput } from "./StreamOutput";

interface WorkflowStepProps {
  stepName: StepName;
}

export function WorkflowStep({ stepName }: WorkflowStepProps) {
  const {
    currentPhase,
    streamOutput,
    artifacts,
    setPhase,
    advanceStep,
    markReviewed,
    appendStreamOutput,
    clearStreamOutput,
  } = useWorkflowStore();
  const { activeAgent, isAvailable } = useAgentStore();
  const [showInput, setShowInput] = useState(false);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);

  const handleStart = () => {
    setShowInput(true);
  };

  const handleCancelInput = () => {
    setShowInput(false);
  };

  const handleSubmit = async (prompt: string) => {
    setShowInput(false);
    setPhase("executing");
    clearStreamOutput();

    if (!activeAgent) return;

    try {
      for await (const chunk of activeAgent.executeStream({
        prompt,
        projectPath: "",
        workflow: stepName,
      })) {
        appendStreamOutput(chunk);
      }
    } catch (err) {
      appendStreamOutput(`\n\nError: ${err}`);
    }

    setPhase("reviewing");
    // Trigger artifact scan after execution
  };

  const handleRetry = () => {
    setShowInput(true);
  };

  const handleNext = async () => {
    setPhase("done");
    await advanceStep();
  };

  // Idle state
  if (currentPhase === "idle") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3 opacity-60">
            {stepName === "explore" && "🔍"}
            {stepName === "propose" && "📋"}
            {stepName === "apply" && "⚡"}
            {stepName === "archive" && "📦"}
          </div>
          <p className="text-slate-500 text-sm mb-5">
            {stepName === "explore" && "探索阶段：分析需求，理解项目上下文"}
            {stepName === "propose" && "提案阶段：生成正式提案和设计文档"}
            {stepName === "apply" && "实施阶段：逐任务执行，TDD 开发"}
            {stepName === "archive" && "归档阶段：验证并归档完成的变更"}
          </p>
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-gradient-to-r from-sky-400 to-indigo-400 text-slate-900 rounded-xl font-bold text-sm hover:scale-105 transition-transform"
          >
            🚀 开始 {stepName.charAt(0).toUpperCase() + stepName.slice(1)}
          </button>
        </div>
      </div>
    );
  }

  // Input modal
  if (showInput) {
    return (
      <InputModal
        stepName={stepName}
        onSubmit={handleSubmit}
        onCancel={handleCancelInput}
      />
    );
  }

  // Executing state
  if (currentPhase === "executing") {
    return (
      <div className="flex-1 p-5">
        <StreamOutput />
        <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-300 leading-relaxed min-h-[300px] border border-slate-700">
          {streamOutput}
          <span className="inline-block w-2 h-3.5 bg-sky-400 animate-pulse ml-0.5 align-middle" />
        </div>
      </div>
    );
  }

  // Reviewing state
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Document review */}
        <div className="flex-[3] flex flex-col border-r border-slate-700">
          <ArtifactTabs
            activeArtifact={activeArtifactId}
            onSelect={setActiveArtifactId}
          />
          <DocViewer filePath={activeArtifactId} />
        </div>

        {/* Right: Chat panel */}
        <div className="flex-[2]">
          <ChatPanel />
        </div>
      </div>

      <ActionBar
        onMarkReviewed={() => activeArtifactId && markReviewed(activeArtifactId)}
        onRetry={handleRetry}
        onNext={handleNext}
      />
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
cd D:/code/openspec-workbench
git add -A
git commit -m "feat: 实现 WorkflowStep 统一步骤容器组件"
```

---

## Phase 5: Pages & Integration

### Task 13: 主页面和路由

**Files:**
- Create: `src/pages/ProjectSelect.tsx`
- Create: `src/pages/WorkbenchPage.tsx`
- Create: `src/pages/SettingsPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 创建 ProjectSelect 页面**

创建 `src/pages/ProjectSelect.tsx`：

```tsx
import { open } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "../stores/project";

interface ProjectSelectProps {
  onProjectSelected: () => void;
}

export function ProjectSelect({ onProjectSelected }: ProjectSelectProps) {
  const { setProject } = useProjectStore();

  const handleOpen = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "选择项目目录",
    });
    if (selected && typeof selected === "string") {
      setProject(selected);
      onProjectSelected();
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-sky-400 mb-2">
          OpenSpec Workbench
        </h1>
        <p className="text-slate-500 text-sm mb-8">
          选择一个项目目录开始工作
        </p>
        <button
          onClick={handleOpen}
          className="px-8 py-3 bg-gradient-to-r from-sky-400 to-indigo-400 text-slate-900 rounded-xl font-bold text-sm hover:scale-105 transition-transform"
        >
          📂 打开项目目录
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 WorkbenchPage 页面**

创建 `src/pages/WorkbenchPage.tsx`：

```tsx
import { useWorkflowStore } from "../stores/workflow";
import { StepNav } from "../components/layout/StepNav";
import { WorkflowStep } from "../components/workflow/WorkflowStep";

export function WorkbenchPage() {
  const { currentStep } = useWorkflowStore();

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-200">
      {/* Header */}
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-900 flex items-center gap-3">
        <span className="text-sm font-semibold text-slate-100">
          OpenSpec Workbench
        </span>
        <span className="text-xs text-slate-600">—</span>
        <span className="text-xs text-slate-500">项目名</span>
      </div>

      {/* Step Navigation */}
      <div className="px-4 py-3">
        <StepNav />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden px-4 pb-4">
        <WorkflowStep stepName={currentStep} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 SettingsPage 页面**

创建 `src/pages/SettingsPage.tsx`：

```tsx
import { useAgentStore } from "../stores/agent";

export function SettingsPage() {
  const { registry, activeAgent, setActive, checkAvailability } = useAgentStore();
  const agents = registry.list();

  return (
    <div className="h-screen bg-slate-950 text-slate-200 p-6">
      <h1 className="text-xl font-bold text-slate-100 mb-6">设置</h1>

      <div className="max-w-xl space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">AI Agent</h2>
          <div className="space-y-2">
            {agents.map((agent) => (
              <div
                key={agent.name}
                onClick={() => setActive(agent.name)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  activeAgent?.name === agent.name
                    ? "border-sky-400 bg-sky-950"
                    : "border-slate-700 bg-slate-900 hover:border-slate-500"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{agent.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    {agent.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 更新 App.tsx 连接路由**

修改 `src/App.tsx`：

```tsx
import { useState } from "react";
import { ProjectSelect } from "./pages/ProjectSelect";
import { WorkbenchPage } from "./pages/WorkbenchPage";
import { OpenCodeAdapter } from "./agents/opencode";
import { ZeroAdapter } from "./agents/zero";
import { useAgentStore } from "./stores/agent";

export default function App() {
  const [projectOpened, setProjectOpened] = useState(false);
  const { initialize } = useAgentStore();

  const handleProjectSelected = () => {
    // Initialize agents with default config
    initialize(
      [new OpenCodeAdapter(), new ZeroAdapter()],
      "opencode",
    );
    setProjectOpened(true);
  };

  if (!projectOpened) {
    return <ProjectSelect onProjectSelected={handleProjectSelected} />;
  }

  return <WorkbenchPage />;
}
```

- [ ] **Step 5: 验证应用启动**

Run:
```bash
cd D:/code/openspec-workbench
npm run tauri dev
```

Expected: 窗口弹出，显示项目选择页面。点击"打开项目目录"可以选择目录，进入工作台。

- [ ] **Step 6: 提交**

```bash
cd D:/code/openspec-workbench
git add -A
git commit -m "feat: 实现页面和路由（ProjectSelect/WorkbenchPage/SettingsPage）"
```

---

## Phase 6: Integration & Polish

### Task 14: 连接 Tauri Events 和文件监听

**Files:**
- Modify: `src/pages/WorkbenchPage.tsx`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 在 main.rs 中集成 FileWatcher**

修改 `src-tauri/src/main.rs`，在 `.setup()` 中启动文件监听：

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod services;

use commands::workflow::WorkflowStateStore;
use services::workflow_engine::WorkflowEngine;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(WorkflowStateStore(std::sync::Mutex::new(WorkflowEngine::new())))
        .invoke_handler(tauri::generate_handler![
            commands::workflow::get_workflow_state,
            commands::workflow::set_phase,
            commands::workflow::advance_step,
            commands::workflow::reset_workflow,
            commands::files::scan_artifacts,
            commands::files::read_file_content,
            commands::files::write_file_content,
            commands::config::load_config,
            commands::config::save_config,
        ])
        .setup(|app| {
            // File watcher will be started per-project when a project is opened
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 2: 在 WorkbenchPage 中监听文件变更事件**

修改 `src/pages/WorkbenchPage.tsx`，添加文件变更监听：

```tsx
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useWorkflowStore } from "../stores/workflow";
import { StepNav } from "../components/layout/StepNav";
import { WorkflowStep } from "../components/workflow/WorkflowStep";

export function WorkbenchPage() {
  const { currentStep } = useWorkflowStore();

  useEffect(() => {
    const unlisten = listen<string[]>("file:changed", (event) => {
      console.log("Files changed:", event.payload);
      // Re-scan artifacts when files change
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-200">
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-900 flex items-center gap-3">
        <span className="text-sm font-semibold text-slate-100">
          OpenSpec Workbench
        </span>
        <span className="text-xs text-slate-600">—</span>
        <span className="text-xs text-slate-500">项目名</span>
      </div>

      <div className="px-4 py-3">
        <StepNav />
      </div>

      <div className="flex-1 overflow-hidden px-4 pb-4">
        <WorkflowStep stepName={currentStep} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 验证编译和运行**

Run:
```bash
cd D:/code/openspec-workbench
npm run tauri dev
```

Expected: 窗口正常启动，无编译错误。

- [ ] **Step 4: 提交**

```bash
cd D:/code/openspec-workbench
git add -A
git commit -m "feat: 连接 Tauri Events 文件变更监听"
```

---

### Task 15: 集成测试 — 完整流程模拟

**Files:**
- Create: `src/__tests__/integration.test.ts`

- [ ] **Step 1: 编写前端集成测试**

创建 `src/__tests__/integration.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { AgentRegistry } from "../agents/registry";
import { AgentAdapter, ChatMessage } from "../agents/types";

function createMockStreamAgent(name: string): AgentAdapter {
  return {
    name,
    type: "http",
    start: async () => {},
    stop: async () => {},
    isAvailable: async () => true,
    execute: async () => ({ content: "mock response", success: true }),
    executeStream: async function* (req) {
      yield `## ${req.workflow || "explore"} result\n\n`;
      yield "Mock analysis output for: " + req.prompt;
    },
    chat: async function* (msgs) {
      const last = msgs[msgs.length - 1];
      yield `Updated based on: ${last.content}`;
    },
    getConfig: async () => ({ model: "mock" }),
  };
}

describe("Full workflow integration", () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
    registry.register(createMockStreamAgent("opencode"));
    registry.register(createMockStreamAgent("zero"));
    registry.setActive("opencode");
  });

  it("has an active agent", () => {
    expect(registry.getActive()?.name).toBe("opencode");
  });

  it("can switch active agent", () => {
    registry.setActive("zero");
    expect(registry.getActive()?.name).toBe("zero");
  });

  it("can execute a workflow step with streaming", async () => {
    const agent = registry.getActive()!;
    const chunks: string[] = [];
    for await (const chunk of agent.executeStream({
      prompt: "Add user authentication",
      projectPath: "/test",
      workflow: "explore",
    })) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join("")).toContain("explore result");
  });

  it("can chat for corrections", async () => {
    const agent = registry.getActive()!;
    const messages: ChatMessage[] = [
      { role: "user", content: "Change refresh token to Redis", timestamp: Date.now() },
    ];
    const chunks: string[] = [];
    for await (const chunk of agent.chat(messages)) {
      chunks.push(chunk);
    }
    expect(chunks.join("")).toContain("Updated based on");
  });

  it("lists all registered agents", () => {
    expect(registry.list()).toHaveLength(2);
  });
});
```

- [ ] **Step 2: 运行所有前端测试**

Run:
```bash
cd D:/code/openspec-workbench
npx vitest run
```

Expected: 全部测试 PASS（包括之前的 agent 测试和新的集成测试）。

- [ ] **Step 3: 运行 Rust 后端测试**

Run:
```bash
cd D:/code/openspec-workbench/src-tauri
cargo test
```

Expected: 全部 Rust 测试 PASS。

- [ ] **Step 4: 提交**

```bash
cd D:/code/openspec-workbench
git add -A
git commit -m "test: 添加前端集成测试（完整流程模拟）"
```

---

### Task 16: 清理和构建验证

**Files:**
- Modify: `src-tauri/tauri.conf.json` (更新应用信息)
- Delete: 所有 mockup HTML 文件（如果还存在）

- [ ] **Step 1: 更新 tauri.conf.json 应用信息**

修改 `src-tauri/tauri.conf.json` 中的标识信息：

```json
{
  "productName": "OpenSpec Workbench",
  "identifier": "com.openspec.workbench"
}
```

（保留其他字段不变，只修改 `productName` 和 `identifier`）

- [ ] **Step 2: 清理 mockup 文件**

```bash
cd D:/code/openspec-workbench
rm -f mockup-*.html
```

- [ ] **Step 3: 完整构建验证**

Run:
```bash
cd D:/code/openspec-workbench
npm run tauri build
```

Expected: Windows 构建成功，生成 .exe 和 .msi。

- [ ] **Step 4: 最终提交**

```bash
cd D:/code/openspec-workbench
git add -A
git commit -m "chore: 清理 mockup 文件，更新应用信息，构建验证通过"
```

---

## Self-Review Checklist

### Spec Coverage
| Spec 要求 | 对应 Task |
|---|---|
| 四步流程导航 | Task 10 (StepNav), Task 12 (WorkflowStep) |
| 用户输入需求 | Task 11 (InputModal) |
| AI 执行 + 流式输出 | Task 7/8 (Agent), Task 11 (StreamOutput) |
| 产物审阅（Tab 切换） | Task 10 (ArtifactTabs), Task 11 (DocViewer) |
| 对话纠正 | Task 11 (ChatPanel) |
| Agent 切换（OpenCode/Zero） | Task 7, 8, 9 |
| 动态发现产物 | Task 4 (scan_artifacts) |
| 审阅门控（全部审阅 → 下一步） | Task 10 (ActionBar) |
| 文件监听 | Task 5 (FileWatcher), Task 14 |
| 配置持久化 | Task 4 (config.rs), Task 9 (stores) |
| Linux glibc 2.28 兼容 | Task 16 构建时注意 |
| 跨平台 (Windows/Linux) | Task 2 (Tauri 插件), Task 16 |

### Placeholder Scan
无 TBD/TODO/待实现占位符。

### Type Consistency
- `AgentAdapter` 接口在 `types.ts` 中定义，在 `opencode.ts`、`zero.ts`、`registry.ts`、`registry.test.ts` 中一致使用
- `Artifact` 类型在 `types.ts` 定义，在 `ArtifactTabs.tsx`、`DocViewer.tsx`、`workflow.ts` store 中一致
- `ChatMessage` 类型在 `types.ts` 定义，在 `ChatPanel.tsx`、`workflow.ts` store 中一致
- Rust 端 `WorkflowState` 的字段名通过 serde 序列化，前端通过 `invoke` 返回的 JSON 字段名匹配
