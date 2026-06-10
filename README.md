# OpenSpec Workbench

OpenSpec 工作流的可视化桌面客户端。将 explore → propose → apply → archive 四步流程串联在一个界面中，支持 AI Agent 执行、流式输出、产物审阅和对话纠正。

## 功能

- **四步工作流导航** — Explore → Propose → Apply → Archive，可视化切换每一步
- **AI Agent 集成** — 支持 OpenCode（SDK）和 Zero（CLI/HTTP），可扩展适配其他 Agent
- **流式输出** — AI 执行过程实时展示，SSE 流式渲染
- **产物审阅** — 动态发现 openspec/ 目录下的所有产物文件，Tab 切换 + Markdown 渲染
- **对话纠正** — 审阅阶段右侧聊天面板，直接对话修改 AI 输出
- **文件监听** — Rust 后端实时监听目录变更，产物文件变化自动刷新
- **跨平台** — Windows (.exe/.msi) + Linux (.deb/.AppImage, glibc >= 2.28)

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript 6 + Vite 8 |
| 样式 | Tailwind CSS 4 |
| 状态管理 | Zustand |
| 桌面框架 | Tauri 2 (Rust) |
| 文件监听 | notify crate |
| Markdown | react-markdown + remark-gfm |

## 开发

### 环境要求

- Node.js >= 20
- pnpm >= 9
- Rust >= 1.77（Tauri 2 要求）
- Tauri CLI: `cargo install tauri-cli`

### 安装

```bash
pnpm install
```

### 启动开发

```bash
pnpm tauri dev
```

### 构建

```bash
pnpm tauri build
```

### 测试

```bash
pnpm test          # 前端单测
pnpm test:watch    # 监听模式

cd src-tauri && cargo test  # Rust 后端测试
```

## 架构

```
┌─────────────────────────────────────────────┐
│              React 前端 (UI)                │
│  StepNav · DocViewer · StreamOutput         │
│  ChatPanel · ActionBar                      │
├────────────────────┬────────────────────────┤
│  Zustand Stores    │   Agent Adapter 层     │
│  workflow · agent  │   OpenCode · Zero      │
│  project           │   AgentAdapter 接口     │
├────────────────────┴────────────────────────┤
│           Tauri IPC (Commands/Events)        │
├─────────────────────────────────────────────┤
│            Rust 后端 (Tauri Core)           │
│  WorkflowEngine · FileService               │
│  FileWatcher · ConfigStore                  │
└─────────────────────────────────────────────┘
```

### Agent 扩展

实现 `AgentAdapter` 接口即可接入新的 AI Agent：

```typescript
interface AgentAdapter {
  name: string;
  type: "sdk" | "cli" | "http";
  start(): Promise<void>;
  stop(): Promise<void>;
  isAvailable(): Promise<boolean>;
  execute(req: AgentRequest): Promise<AgentResponse>;
  executeStream(req: AgentRequest): AsyncIterable<string>;
  chat(messages: ChatMessage[]): AsyncIterable<string>;
}
```

## License

MIT
