# OpenSpec Workbench 设计文档

## Why

OpenSpec 工作流（explore → propose → apply → archive）目前通过 CLI 命令逐个调用，用户需要手动执行每个步骤、手动打开产物文件审阅、手动校验格式。缺少一个可视化界面将整个流程串联起来，降低使用门槛并提升审阅效率。

## What

构建一个跨平台桌面应用（Tauri 2 + React + TypeScript），提供完整的 OpenSpec 可视化工作流：

- 四步流程可视化导航（Explore → Propose → Apply → Archive）
- 每步支持用户输入需求 → AI 执行 → 流式输出 → 产物审阅 → 对话纠正
- 可切换 AI Agent 后端（OpenCode、Zero、自定义 Agent）
- 动态发现并展示 OpenSpec 产物文件

## Architecture

### 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript 5 + Vite 6 |
| 样式 | Tailwind CSS 4 |
| 状态管理 | Zustand |
| Markdown 渲染 | react-markdown |
| 桌面框架 | Tauri 2 (Rust) |
| 异步运行时 | tokio (Rust) |
| 文件监听 | notify (Rust) |
| 序列化 | serde (Rust) |
| 打包 | Windows (.msi/.exe), Linux (.deb/.AppImage) |

### 整体架构

```
┌─────────────────────────────────────────────┐
│              React 前端 (UI)                │
│  StepNav · DocPanel · StreamOutput          │
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

### 职责划分

**Rust 后端负责：**
- WorkflowEngine：工作流状态机（explore → propose → apply → archive），管理当前步骤、完成状态
- FileService：读写 openspec/ 目录文件，动态扫描产物
- FileWatcher：监听 openspec/ 目录变更，实时通知前端
- ConfigStore：用户配置持久化（active agent、连接参数等）
- CliService：调用 openspec CLI（validate, archive 等命令）

**React 前端负责：**
- UI 渲染和交互
- 通过 AgentAdapter 调用 AI Agent（执行流程、对话纠正）
- 流式输出展示
- Markdown 文档渲染

**Agent Adapter 层负责：**
- 统一 AI Agent 调用接口
- 各 Agent 的连接管理（SDK / CLI / HTTP）
- 配置读取和复用

## Agent Adapter 设计

### 接口定义

```typescript
interface AgentAdapter {
  // 基本信息
  name: string;
  type: "sdk" | "cli" | "http";

  // 生命周期
  start(): Promise<void>;
  stop(): Promise<void>;
  isAvailable(): Promise<boolean>;

  // 核心功能
  execute(req: AgentRequest): Promise<AgentResponse>;
  executeStream(req: AgentRequest): AsyncIterable<string>;
  chat(messages: ChatMessage[]): AsyncIterable<string>;

  // 配置
  getConfig(): Promise<AgentConfig>;
}

interface AgentRequest {
  prompt: string;
  projectPath: string;
  workflow?: "explore" | "propose" | "apply" | "archive";
  files?: string[];
}

interface Artifact {
  id: string;              // 文件相对路径
  fileName: string;        // 文件名
  filePath: string;        // 绝对路径
  content: string;         // 文件内容
  lastModified: number;    // 修改时间戳
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  diff?: string;           // AI 回复中附带的 diff 信息
}

interface AgentConfig {
  model?: string;
  provider?: string;
  [key: string]: unknown;
}
```

### 现有适配器

| Agent | 类型 | 连接方式 | 配置来源 |
|---|---|---|---|
| OpenCode | sdk | JS/TS SDK (HTTP) | .opencode/oh-my-opencode.json |
| Zero | cli / http | CLI 命令 或 HTTP API | kilo 配置体系 |

### 用户配置

```json
{
  "activeAgent": "zero",
  "agents": {
    "opencode": {
      "type": "sdk",
      "autoStart": true,
      "configPath": ".opencode/oh-my-opencode.json"
    },
    "zero": {
      "type": "cli",
      "cliPath": "zero",
      "serverUrl": "http://localhost:8080",
      "mode": "server"
    }
  }
}
```

新增 Agent 只需：实现 AgentAdapter 接口（约 50-100 行 TS）→ 注册到 AdapterRegistry → 用户在设置页面启用。

## Workflow Engine 状态机

### 步骤流转

```
Explore → Propose → Apply → Archive
  │          │        │        │
  ▼          ▼        ▼        ▼
[执行]    [执行]    [执行]    [执行]
  │          │        │        │
  ▼          ▼        ▼        ▼
[审阅]    [审阅]    [审阅]    [审阅]
  │          │        │        │
  ▼          ▼        ▼        ▼
[下一步]  [下一步]  [下一步]  [完成]
```

### 每步状态

```typescript
type StepPhase = "idle" | "input" | "executing" | "reviewing" | "done";

interface WorkflowStep {
  name: "explore" | "propose" | "apply" | "archive";
  phase: StepPhase;
  artifacts: Artifact[];       // 动态发现的产物文件
  reviewedArtifacts: Set<string>; // 已审阅的产物 ID
  chatHistory: ChatMessage[];  // 对话纠正历史
}
```

### 状态存储

- Rust 端维护权威状态（WorkflowEngine），通过 IPC Commands 读写
- 前端 Zustand store 作为缓存，通过 Tauri Events 同步

## UI 设计

### 页面结构

1. **ProjectSelect** — 选择/打开项目目录
2. **WorkbenchPage** — 主工作台（占 90% 使用时间）
3. **SettingsPage** — Agent 配置、通用设置

### WorkbenchPage 布局

```
┌──────────────────────────────────────────────┐
│ StepNav: [Explore] [Propose] [Apply] [Archive]│
├─────────────────────────────┬────────────────┤
│                             │                │
│     文档审阅区               │   对话纠正区    │
│                             │                │
│  ┌─ 产物 Tab ──────────┐   │  Chat Messages │
│  │ brainstorm.md │ ... │   │                │
│  └────────────────────┘   │  ┌───────────┐ │
│                             │  │ 输入框     │ │
│  Markdown 渲染内容          │  └───────────┘ │
│                             │                │
├─────────────────────────────┴────────────────┤
│ ActionBar: [进度] [标记已审阅] [重新执行] [下一步] │
└──────────────────────────────────────────────┘
```

### 四步流程统一交互模式

每一步都遵循相同的交互流程：

1. **Idle** — 用户看到当前步骤的描述和"开始"按钮
2. **Input** — 弹出模态框，用户输入需求：
   - 顶部选择 Agent（OpenCode / Zero）
   - 中间文本框输入需求描述
   - 底部可选：附带项目上下文、指定文件范围、自定义 Prompt
3. **Executing** — AI 执行，流式输出显示在文档区
4. **Reviewing** — 审阅产物：
   - Tab 切换产物文件（动态发现）
   - 单栏 Markdown 渲染展示
   - 右侧对话面板：用户可直接对话修改，AI 实时更新文档并显示 diff
   - 逐个标记"已审阅"，进度条显示
   - 全部审阅完成后解锁"下一步"按钮
5. **Done** — 进入下一步

### 各步骤差异

| 步骤 | 用户输入 | 产物 | AI 行为 |
|---|---|---|---|
| Explore | 需求描述 | brainstorm.md, exploration-summary.md（取决于 schema） | 分析项目、提出方案建议、识别风险 |
| Propose | 确认 explore 结果 | proposal.md, design.md, tasks.md, specs/（最多） | 生成提案、设计文档、任务拆分、规格增量 |
| Apply | 确认提案 | 代码变更、测试代码、tasks.md 更新 | 逐任务 TDD 执行、验证、标记完成 |
| Archive | 确认归档 | 归档目录、合并后 specs、归档报告 | validate --strict、archive、合并 deltas |

### 产物动态发现

不硬编码产物文件名。通过 Rust FileService 扫描 `openspec/changes/<change-id>/` 目录，将找到的所有文件作为 Tab 展示。FileWatcher 监听目录变更，新文件实时出现。

### 对话纠正机制

- 右侧聊天面板始终可用（执行完成后激活）
- 用户消息发给当前 Agent，Agent 理解修改意图后直接更新产物文件
- 前端通过 FileWatcher 收到文件变更事件，自动刷新文档内容
- AI 回复中展示 diff（红色删除、绿色新增）
- 对话历史保存在 WorkflowStep.chatHistory 中

## Error Handling

### Agent 不可用
- 启动时检测所有已配置 Agent 的可用性
- 不可用的 Agent 在选择器中灰显并提示原因
- 用户尝试执行时如果 Agent 断连，显示错误并可重试或切换 Agent

### 执行超时
- 每次执行设置可配置超时（默认 5 分钟）
- 超时后显示提示，用户可选择继续等待或取消

### 文件冲突
- 对话纠正时如果文件被外部修改，提示用户选择保留哪个版本

### CLI 不可用
- openspec CLI 未安装时，Archive 步骤的 validate/archive 功能降级
- 显示安装提示，不阻塞其他步骤

## 项目结构

```
openspec-workbench/
├── src-tauri/                      # Tauri Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── workflow.rs          # 工作流 IPC 命令
│       │   ├── files.rs             # 文件读写命令
│       │   └── config.rs            # 配置管理命令
│       └── services/
│           ├── workflow_engine.rs   # 状态机核心
│           ├── file_watcher.rs      # 文件监听
│           └── config_store.rs      # 配置持久化
│
├── src/                            # React 前端
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── StepNav.tsx          # 流程步骤导航
│   │   │   ├── ArtifactTabs.tsx     # 产物文件 Tab
│   │   │   ├── DocViewer.tsx        # Markdown 文档渲染
│   │   │   ├── ChatPanel.tsx        # 对话纠正面板
│   │   │   └── ActionBar.tsx        # 执行/审阅/下一步
│   │   ├── workflow/
│   │   │   ├── WorkflowStep.tsx      # 统一步骤组件
│   │   │   ├── InputModal.tsx        # 需求输入模态框
│   │   │   └── StreamOutput.tsx      # 流式输出显示
│   │   └── common/
│   │       └── MarkdownViewer.tsx    # Markdown 渲染器
│   ├── agents/
│   │   ├── types.ts                 # AgentAdapter 接口
│   │   ├── registry.ts              # AdapterRegistry
│   │   ├── opencode.ts              # OpenCode 适配器
│   │   └── zero.ts                  # Zero 适配器
│   ├── stores/
│   │   ├── workflow.ts              # 工作流状态
│   │   ├── agent.ts                 # Agent 状态
│   │   └── project.ts               # 项目上下文
│   └── pages/
│       ├── WorkbenchPage.tsx         # 主工作台
│       ├── SettingsPage.tsx          # 设置页面
│       └── ProjectSelect.tsx         # 项目选择
│
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

## Non-goals

- 不做翻译功能（用户可在对话中自行要求翻译）
- 不做插件化架构（当前只需 OpenCode + Zero，YAGNI）
- 不做代码编辑器（Apply 阶段的代码审阅用外部编辑器完成）
- 不做 CI/CD 集成
- 不做多项目并行管理
