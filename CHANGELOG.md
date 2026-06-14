# 更新日志

所有重要的项目变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2026-06-13

### 新增 (Added)
- 🤖 AI Agent 交互式执行功能
- 📁 智能文件树浏览（支持 Web File System API 和 Electron IPC）
- 📊 完整的会话管理系统
  - 创建新会话
  - 会话选择和切换
  - 会话历史记录
  - 会话删除功能
- 🎯 浮动窗口系统
  - 独立窗口管理
  - 窗口拖拽
  - 层级控制
  - 多窗口支持
- 💻 Electron 桌面应用
  - 本地文件系统集成
  - 原生菜单
  - 跨平台支持（Windows, macOS, Linux）
- 🌐 国际化支持（中英文）
- 🎨 UI 组件
  - 欢迎页面
  - 聊天视图
  - 文件树
  - 输入面板
  - 设置面板
  - 状态栏
  - 工具窗口（Bash, Edit, Default）
- ⚡ CLI Bridge HTTP 客户端
- 🔧 后端适配器系统
  - OpenCode 适配器
  - 后端注册表
  - 类型定义

### 技术栈 (Technical)
- Vue 3.5.28 (Composition API)
- TypeScript 6.0.3
- Vite 7.3.1
- Electron 42.4.0
- Tailwind CSS 4.1.18
- Vue Router 4.5.1
- Vue I18n 11.3.0
- Vitest 4.1.2

### 构建 (Build)
- Web 应用构建
- Electron 应用打包
- 跨平台安装包（NSIS, AppImage）

### 文档 (Documentation)
- 项目 README
- 贡献指南
- 变更日志
- 环境变量模板

---

## 版本说明

- **[Unreleased]**: 尚未发布的功能
- **[1.0.0]**: 当前稳定版本
- **[0.x.y]**: 早期开发版本（如存在）

### 变更类型
- `新增` - 新功能
- `变更` - 功能变更
- `弃用` - 即将移除的功能
- `移除` - 已移除的功能
- `修复` - Bug 修复
- `安全` - 安全相关修复