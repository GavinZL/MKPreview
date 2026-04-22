# MKPreview - UI 设计原型

## 概述

本文档为 MKPreview 跨平台 Markdown 知识库渲染应用的完整 UI 设计原型说明。设计遵循 PRD.md 中定义的规范，包含所有核心界面状态与交互流程。

**原型文件**: [prototype.html](prototype.html)

---

## 使用方式

1. 直接在浏览器中打开 `prototype.html`
2. 使用工具栏按钮切换不同模式（Preview / Source / Split）
3. 使用快捷键体验完整交互：
   - `Cmd/Ctrl + 1` — 预览模式
   - `Cmd/Ctrl + 2` — 源码模式
   - `Cmd/Ctrl + 3` — 分屏模式
   - `Cmd/Ctrl + B` — 切换侧栏
   - `Cmd/Ctrl + Shift + F` — 全局搜索
   - `Cmd/Ctrl + Shift + T` — 切换主题

---

## 设计系统

### 颜色规范

#### 亮色主题 (Light)

| Token | 色值 | 用途 |
|-------|------|------|
| `--bg-primary` | `#FFFFFF` | 应用主背景、内容区背景 |
| `--bg-secondary` | `#F8F9FA` | 文件树背景、标签栏背景 |
| `--bg-tertiary` | `#F1F3F5` | 工具栏/状态栏背景、代码块头部 |
| `--bg-code` | `#F6F8FA` | 代码块背景 |
| `--text-primary` | `#1A1A2E` | 正文、标题 |
| `--text-secondary` | `#6B7280` | 辅助文字、描述 |
| `--text-muted` | `#9CA3AF` | 占位符、禁用态、行号 |
| `--border` | `#E5E7EB` | 分割线、边框 |
| `--accent` | `#3B82F6` | 主强调色、链接、选中态 |
| `--accent-red` | `#EF4444` | H2 左边框、警告、行内代码 |
| `--accent-green` | `#10B981` | 成功、代码新增 |
| `--accent-amber` | `#F59E0B` | 提醒、文件夹图标 |

#### 暗色主题 (Dark)

| Token | 色值 | 用途 |
|-------|------|------|
| `--bg-primary` | `#0D1117` | 应用主背景 |
| `--bg-secondary` | `#161B22` | 文件树背景 |
| `--bg-tertiary` | `#21262D` | 工具栏/状态栏背景 |
| `--bg-code` | `#1C2128` | 代码块背景 |
| `--text-primary` | `#E6EDF3` | 正文 |
| `--text-secondary` | `#8B949E` | 辅助文字 |
| `--text-muted` | `#484F58` | 占位符 |
| `--border` | `#30363D` | 分割线 |
| `--accent` | `#58A6FF` | 主强调色 |
| `--accent-red` | `#F85149` | H2 左边框 |
| `--accent-green` | `#3FB950` | 成功 |
| `--accent-amber` | `#D29922` | 提醒 |

### 字体规范

| 用途 | 字体族 | 默认字号 | 行高 |
|------|--------|---------|------|
| UI 界面 | `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` | 13px | 1.5 |
| Markdown 正文 | `'Noto Serif SC', Georgia, serif` | 16px | 1.8 |
| 代码 | `'JetBrains Mono', 'Fira Code', Menlo, monospace` | 14px | 1.6 |
| 标题 | 与正文相同 | 按级别递减 | 1.3 |

### 布局规格

| 区域 | 默认尺寸 | 可调 | 最小 | 最大 |
|------|---------|------|------|------|
| 文件树面板 | 260px | 拖拽 | 180px | 400px |
| 内容区 | 1fr | 自动 | 400px | — |
| 分屏模式左右比 | 1fr 1fr | 拖拽 | 30% | 70% |
| 标签栏高度 | 36px | 固定 | — | — |
| 工具栏高度 | 40px | 固定 | — | — |
| 状态栏高度 | 24px | 固定 | — | — |

---

## 界面状态说明

### 1. 默认布局 — 预览模式 (Preview Mode)

- **布局**: 左侧文件树 + 右侧内容区
- **内容区**: 以精美排版渲染 Markdown 内容
- **特色元素**:
  - 文件树展示目录层级，支持展开/折叠
  - 目录节点显示文件数量角标
  - 标签页展示打开的文件，支持关闭
  - 右侧浮动 TOC 目录面板
  - 代码块带语言标签和复制按钮
  - H2 标题左侧红色竖线装饰

### 2. 源码模式 (Source Mode)

- **布局**: 左侧文件树 + 右侧源码编辑器
- **内容区**: CodeMirror 6 风格编辑器
- **特色元素**:
  - 左侧行号显示
  - Markdown 语法高亮（标题、代码块、注释等）
  - 等宽字体显示
  - 只读状态（MVP 阶段）

### 3. 分屏模式 (Split Mode)

- **布局**: 左侧源码 + 右侧预览，并排展示
- **特色元素**:
  - CSS Grid 实现左右分栏
  - 中间拖拽分割条可调整比例
  - 两侧独立滚动（Phase 2 实现同步滚动）

### 4. 搜索面板 (Search Overlay)

- **触发**: 点击工具栏搜索按钮或 `Cmd+Shift+F`
- **内容**:
  - 搜索输入框
  - 过滤标签（全部/文件名/内容）
  - 搜索结果列表（文件路径 + 标题 + 匹配上下文）
  - 高亮匹配关键词

### 5. 设置面板 (Settings Overlay)

- **触发**: 点击侧栏底部设置按钮
- **内容**:
  - 外观设置（主题、字体）
  - 编辑器设置（自动保存、行号、代码折叠）
  - 预览设置（Mermaid、KaTeX 开关）
  - Toggle 开关控件

---

## 用户体验流程

```
打开应用
  │
  ▼
显示空状态 / 自动加载上次目录
  │
  ▼
文件树加载完成（< 200ms）
  │
  ▼
点击文件树中的文件 ──────────────────────┐
  │                                      │
  ▼                                      │
标签页添加新标签 / 切换到已有标签         │
  │                                      │
  ▼                                      │
内容区加载并渲染 Markdown                │
  │                                      │
  ├──► 按 Cmd+1 切换到预览模式            │
  ├──► 按 Cmd+2 切换到源码模式            │
  ├──► 按 Cmd+3 切换到分屏模式            │
  │                                      │
  ▼                                      │
用户阅读 / 编辑内容                      │
  │                                      │
  ├──► 点击代码块复制按钮                 │
  ├──► 点击 TOC 跳转标题                  │
  ├──► 按 Cmd+Shift+F 全局搜索            │
  │                                      │
  ▼                                      │
按 Cmd+S 保存（Phase 2）                  │
  │                                      │
  └──────────────────────────────────────┘
```

---

## 组件清单

| 组件 | 文件位置 | 说明 |
|------|---------|------|
| AppLayout | `components/layout/AppLayout.vue` | CSS Grid 整体布局骨架 |
| Sidebar | `components/layout/Sidebar.vue` | 左侧面板容器 |
| FileTree | `components/file-tree/FileTree.vue` | 文件树主组件 |
| TreeNode | `components/file-tree/TreeNode.vue` | 单个树节点 |
| Toolbar | `components/layout/Toolbar.vue` | 顶部工具栏 |
| TabBar | `components/tabs/TabBar.vue` | 标签栏 |
| MarkdownPreview | `components/preview/MarkdownPreview.vue` | 渲染预览主组件 |
| SourceEditor | `components/editor/SourceEditor.vue` | CodeMirror 6 封装 |
| SplitView | `components/split/SplitView.vue` | 分屏模式容器 |
| GlobalSearch | `components/search/GlobalSearch.vue` | 全局搜索面板 |
| SettingsPanel | `components/settings/SettingsPanel.vue` | 设置面板 |
| TableOfContents | `components/preview/TableOfContents.vue` | TOC 浮动面板 |

---

## 备注

- 原型使用纯 HTML/CSS/JS 实现，无需构建步骤即可在浏览器中查看
- 所有颜色、字体、间距均严格遵循 PRD 规范
- 暗色主题为默认主题，支持亮色主题切换
- 实际开发时参考此原型中的 CSS 变量和类名命名
