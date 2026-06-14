# OpenSpec Workbench

一个现代化的 AI 辅助开发工作台，提供完整的 OpenSpec 项目管理、交互式 Agent 执行和代码审查功能。

## 特性

- 🤖 **AI Agent 交互式执行** - 与 OpenSpec Agent 进行实时对话，执行开发任务
- 📁 **智能文件树浏览** - 支持本地文件系统导航，实时显示项目结构
- 📊 **会话管理** - 完整的会话历史记录、会话切换和删除功能
- 🎯 **浮动窗口系统** - 独立的浮动窗口用于代码审查和结果展示
- 💻 **跨平台支持** - 同时支持 Web 浏览器和 Electron 桌面应用
- 🌐 **国际化** - 内置中英文双语支持
- ⚡ **高性能架构** - 基于 Vue 3 + TypeScript + Vite 构建

## 技术栈

### 前端
- **框架**: Vue 3 (Composition API)
- **语言**: TypeScript
- **构建工具**: Vite 7
- **路由**: Vue Router 4
- **国际化**: Vue I18n
- **样式**: Tailwind CSS 4

### 桌面端 (Electron)
- **运行时**: Electron 42
- **构建**: Electron Builder
- **进程通信**: IPC (Inter-Process Communication)

### 开发工具
- **测试**: Vitest + Happy DOM
- **类型检查**: vue-tsc
- **包管理**: pnpm

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### 安装依赖

```bash
pnpm install
```

### 开发模式

#### Web 开发
```bash
pnpm dev
```

访问 http://localhost:5173

#### Electron 桌面开发
```bash
pnpm electron:dev
```

### 构建

#### Web 构建
```bash
pnpm build
```

#### Electron 构建
```bash
pnpm electron:build
```

构建产物位于 `release/` 目录。

## 项目结构

```
openspec-workbench/
├── app/                    # 前端应用代码
│   ├── components/         # Vue 组件
│   ├── composables/        # 组合式函数
│   ├── backends/           # 后端适配器
│   ├── utils/              # 工具函数
│   ├── types/              # TypeScript 类型定义
│   ├── i18n/               # 国际化配置
│   ├── router/             # 路由配置
│   ├── styles/             # 全局样式
│   └── workers/            # Web Workers
├── electron/               # Electron 主进程代码
│   ├── main.ts             # 主进程入口
│   └── preload.cjs         # 预加载脚本
├── cli-bridge/             # CLI Bridge 服务
├── dist/                   # Web 构建产物
├── dist-electron/          # Electron 构建产物
├── scripts/                # 构建脚本
└── package.json
```

## 主要功能

### 1. 文件树浏览
- 支持 Web (File System API) 和 Electron (IPC) 两种模式
- 自动忽略 `node_modules`, `.git` 等目录
- 支持目录展开/折叠
- 文件和目录排序

### 2. 会话管理
- 创建新会话
- 选择现有会话
- 删除会话
- 会话历史记录

### 3. 消息交互
- 与 OpenCode Agent 实时对话
- 显示工具调用结果
- 代码内容高亮
- 文件变更可视化

### 4. 浮动窗口
- 独立窗口管理
- 窗口拖拽和层级控制
- 多窗口支持

## 开发指南

### 添加新组件

1. 在 `app/components/` 创建组件文件
2. 使用 TypeScript 定义 props
3. 遵循现有代码风格

### 添加国际化文本

编辑 `app/locales/` 目录下的语言文件：

```typescript
// app/locales/zh-CN.ts
export default {
  common: {
    confirm: '确认',
    cancel: '取消',
  }
}
```

### 调试

Web 模式下使用浏览器 DevTools：
- 打开 `http://localhost:5173`
- 按 `F12` 或 `Ctrl+Shift+I`

Electron 模式下：
- 自动打开 DevTools
- 主进程日志在终端显示

## 配置说明

### 环境变量

创建 `.env.local` 文件（参考 `.env.example`）：

```env
VITE_API_BASE_URL=http://localhost:13284
VITE_DEV_MODE=true
```

### Electron 配置

编辑 `package.json` 中的 `build` 字段配置打包选项。

## 测试

```bash
# 运行测试
pnpm test

# 监听模式
pnpm test:watch
```

## 代码规范

```bash
# 类型检查
pnpm lint
```

## 故障排除

### Electron 启动失败
- 检查端口 13284 是否被占用
- 确认 OpenCode CLI 已正确安装
- 查看主进程日志

### 构建失败
- 清理缓存：`rm -rf node_modules dist dist-electron`
- 重新安装依赖：`pnpm install`

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT

## 联系方式

- 问题反馈: [GitHub Issues]
- 文档: [项目 Wiki]