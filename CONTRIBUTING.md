# 贡献指南

感谢您对 OpenSpec Workbench 的关注！我们欢迎任何形式的贡献。

## 如何贡献

### 报告问题

如果您发现 bug 或有新功能建议：

1. 在 [GitHub Issues](https://github.com/your-username/openspec-workbench/issues) 搜索现有 issue
2. 如果未找到，创建新的 issue
3. 提供详细的复现步骤和环境信息

### 提交代码

1. **Fork 项目**
   ```bash
   # 在 GitHub 上 Fork 项目后
   git clone https://github.com/YOUR_USERNAME/openspec-workbench.git
   cd openspec-workbench
   ```

2. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

3. **开发**
   - 遵循现有代码风格
   - 添加必要的测试
   - 更新相关文档

4. **提交代码**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   # 或
   git commit -m "fix: resolve bug description"
   ```

5. **推送分支**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **创建 Pull Request**
   - 在 GitHub 上创建 PR
   - 填写 PR 模板
   - 等待代码审查

## 开发规范

### Git 提交信息

遵循 [约定式提交](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型 (type):**
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具链相关

**示例:**
```
feat(chat): add message timestamp display

- Add timestamp component
- Format time according to locale
- Update i18n files

Closes #123
```

### 代码风格

#### TypeScript
- 使用严格模式
- 明确类型定义
- 避免使用 `any`

#### Vue
- 使用 Composition API
- 组件使用 PascalCase 命名
- Props 使用 camelCase

#### CSS
- 使用 Tailwind CSS
- 遵循 BEM 命名规范（如需要自定义 CSS）

### 测试要求

- 新功能需要添加单元测试
- Bug 修复需要添加回归测试
- 确保所有测试通过：`pnpm test`
- 测试覆盖率不低于 80%

## 开发流程

### 环境设置

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev  # Web
pnpm electron:dev  # Electron
```

### 代码审查

提交 PR 后，会自动触发：
- 类型检查：`vue-tsc --noEmit`
- 单元测试：`vitest run`
- 代码规范检查（配置后）

确保所有检查通过。

### 文档更新

如果您的修改涉及：
- 新增功能
- API 变更
- 配置调整

请同步更新相关文档：
- README.md
- API 文档
- 注释

## Issue 模板

### Bug 报告

```markdown
**Bug 描述**
简要描述 bug。

**复现步骤**
1. 打开页面
2. 点击按钮
3. 查看结果

**期望行为**
描述期望的正确行为。

**实际行为**
描述实际发生的错误行为。

**环境信息**
- OS: [e.g. Windows 11, macOS 14]
- Node.js: [e.g. 18.0.0]
- Browser: [e.g. Chrome 120]

**截图**
如有截图，请附上。

**附加信息**
其他相关信息。
```

### 功能请求

```markdown
**功能描述**
简要描述您希望添加的功能。

**问题背景**
这个功能解决什么问题？

**建议方案**
描述您希望的实现方式。

**替代方案**
其他可能的实现方式。

**附加信息**
其他相关信息。
```

## 行为准则

- 尊重所有贡献者
- 建设性反馈
- 保持耐心和礼貌
- 关注代码和内容，而非个人

## 获取帮助

如有问题，可以：
- 在 Issues 中提问
- 查看 [项目文档](README.md)
- 联系维护者

## 许可证

贡献的代码将采用项目的 MIT 许可证。

---

感谢您的贡献！