# OpenSpec Workbench 架构文档

## 概述

OpenSpec Workbench 是一个基于 Vue 3 + Electron 的现代化 AI 辅助开发工作台。项目采用分层架构，支持 Web 和 Electron 两种运行模式。

## 技术架构

### 分层结构

```
┌─────────────────────────────────────────────┐
│           Presentation Layer                 │
│   (Vue Components, Composables, UI)          │
├─────────────────────────────────────────────┤
│         Business Logic Layer                 │
│  (State Management, Services, Utils)         │
├─────────────────────────────────────────────┤
│          Data Access Layer                   │
│   (Backend Adapters, IPC Bridge, Workers)    │
├─────────────────────────────────────────────┤
│         Infrastructure Layer                 │
│  (Electron, File System API, HTTP Client)    │
└─────────────────────────────────────────────┘
```

## 核心模块

### 1. 前端应用 (app/)

#### 组件 (components/)
- `App.vue` - 应用根组件
- `TopBar.vue` - 顶部导航栏
- `SidePanel.vue` - 侧边栏（会话列表）
- `StatusBar.vue` - 状态栏
- `InputPanel.vue` - 输入面板
- `ChatView.vue` - 聊天视图
- `MessageViewer.vue` - 消息查看器
- `FileTree.vue` - 文件树
- `FloatingWindow.vue` - 浮动窗口
- `SettingsPanel.vue` - 设置面板
- `ToolWindow/` - 工具窗口组件
  - `Bash.vue` - Bash 输出窗口
  - `Edit.vue` - 编辑窗口
  - `Default.vue` - 默认窗口

#### 组合式函数 (composables/)
- `useBackend.ts` - 后端通信管理
- `useProject.ts` - 项目状态管理
- `useFloatingWindows.ts` - 浮动窗口管理

#### 后端适配器 (backends/)
- `openCodeAdapter.ts` - OpenCode API 适配器
- `registry.ts` - 后端注册表
- `types.ts` - 后端类型定义

#### 工具函数 (utils/)
- `electronBridge.ts` - Electron IPC 桥接
- `httpClient.ts` - HTTP 客户端

#### 类型定义 (types/)
- `backend.ts` - 后端类型
- `electron.ts` - Electron 类型
- `frontend.ts` - 前端类型

### 2. Electron 主进程 (electron/)

- `main.ts` - 主进程入口
  - 窗口管理
  - IPC 处理器
  - 菜单管理
  - 文件系统访问
  - CLI Bridge 进程管理
- `preload.cjs` - 预加载脚本（安全上下文）

### 3. CLI Bridge (cli-bridge/)

- `server.ts` - HTTP 服务
- `client.ts` - HTTP 客户端

## 数据流

### 会话管理流程

```
用户操作 → InputPanel → useBackend → Backend Adapter → API
         ↓
    MessageViewer ← State Update ← Response
```

### 文件浏览流程

**Web 模式:**
```
用户选择 → File System API → useProject → FileTree
```

**Electron 模式:**
```
用户选择 → IPC → Electron Main → 文件系统 → IPC → useProject → FileTree
```

### 消息处理流程

```
InputPanel 发送消息
    ↓
useBackend 创建消息
    ↓
Backend Adapter 调用 API
    ↓
接收流式响应
    ↓
更新消息状态
    ↓
MessageViewer 渲染
    ↓
工具调用结果 → FloatingWindow
```

## 状态管理

### 全局状态

1. **项目状态** (`useProject`)
   - 当前打开的目录
   - 文件树结构
   - 加载状态
   - 错误信息

2. **后端状态** (`useBackend`)
   - 会话列表
   - 当前会话
   - 消息历史
   - 连接状态

3. **浮动窗口状态** (`useFloatingWindows`)
   - 窗口列表
   - 激活窗口
   - 窗口位置

### 状态同步

- 使用 Vue 3 响应式系统
- 组合式函数提供集中式状态管理
- 组件通过 props 和事件通信

## 安全设计

### Electron 安全

1. **Context Isolation**
   - 启用 `contextIsolation: true`
   - 使用 preload 脚本暴露安全 API

2. **Node Integration**
   - 禁用 `nodeIntegration: false`
   - 仅通过 IPC 访问原生功能

3. **Content Security Policy**
   - 限制资源加载来源
   - 防止 XSS 攻击

### Web 模式安全

1. **File System API**
   - 用户显式授权
   - 权限隔离
   - 临时句柄管理

## 性能优化

### 代码分割

- 路由懒加载
- 组件动态导入
- 第三方库按需加载

### 资源优化

- Tailwind CSS 按需生成
- 图标按需加载
- 图片懒加载

### 运行时优化

- 虚拟滚动（长列表）
- 防抖和节流
- Web Workers 处理重计算

## 扩展性

### 后端适配器系统

通过 `registry.ts` 支持多种后端：

```typescript
interface BackendAdapter {
  name: string;
  createSession(): Promise<Session>;
  sendMessage(sessionId: string, message: Message): Promise<void>;
  // ...
}
```

### 插件化设计

- 工具窗口可插拔
- 消息渲染器可扩展
- 主题系统支持

## 部署架构

### Web 部署

```
Vite Build → dist/ → 静态文件服务器
```

### Electron 打包

```
Vite Build + Electron Build → NSIS/AppImage → 用户安装
```

## 开发工作流

1. **功能开发**
   - 创建 feature 分支
   - 开发功能
   - 编写测试
   - 代码审查
   - 合并主分支

2. **发布流程**
   - 版本号更新
   - CHANGELOG 更新
   - 构建测试
   - 发布 GitHub Release
   - 打包分发

## 监控和日志

### 前端日志

```typescript
console.log('[component]', message)
console.warn('[warning]', message)
console.error('[error]', message)
```

### Electron 日志

```typescript
// 主进程
console.log('[electron]', message)

// 传输到渲染进程
mainWindow.webContents.send('log', { level, message })
```

## 未来规划

- [ ] 插件系统
- [ ] 多标签页支持
- [ ] 高级搜索
- [ ] 协作功能
- [ ] 云同步
- [ ] 性能监控面板