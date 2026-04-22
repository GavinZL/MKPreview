# MKPreview - 产品需求文档 (PRD)

> **版本**: v1.0
> **文档日期**: 2026-04-21
> **产品名称**: MKPreview
> **定位**: 跨平台 Markdown 知识库精美渲染与浏览桌面应用

---

## 一、产品概述

### 1.1 产品愿景

MKPreview 是一款面向**技术知识库管理场景**的跨平台桌面应用（macOS + Windows），核心解决「大规模 Markdown 知识库的精美渲染浏览与轻量编辑」问题。

与通用 Markdown 编辑器（Typora、Obsidian、Mark Text）不同，MKPreview 的设计原点是**「阅读优先、目录驱动」**——用户拥有一个按领域-章节-主题三层组织、包含数百篇深度技术文章的知识库，需要一个能将其以「精品书籍」品质呈现出来的工具。

### 1.2 第一用户场景（Golden Path）

基于对目标知识库的实际分析（路径 `Knowledge/learn/`），核心数据画像如下：

| 指标 | 数值 |
|------|------|
| Markdown 文件总数 | ~248 篇 |
| 目录总数 | ~106 个 |
| 一级领域目录 | 16 个（+ 10 篇根级独立文档） |
| 目录层级深度 | 3 层（领域 → 章节 → 文件） |
| 总数据量 | ~14MB（纯文本为主） |
| 最大单文件 | ~216KB / 5190 行 |
| 代码块语言种类 | 20+ 种（Swift、C++、Mermaid、Python 等） |
| Mermaid 图表块 | ~677 处 |
| KaTeX 数学公式块 | ~500+ 处 |
| 表格使用 | 广泛（几乎每篇都有） |
| 引用块使用 | 243 篇（98%） |
| ASCII 艺术框图 | 大量（box-drawing 字符架构图） |

**典型用户旅程**：

打开 MKPreview → 加载 `Knowledge/learn/` 目录 → 左侧看到 16 个领域文件夹树 → 点击展开 `Cpp_Language/01_类型系统与语言基础` → 选中一篇文章 → 右侧以精美排版呈现：层次分明的标题、带语法高亮的 C++ 代码（可一键复制）、Mermaid 架构图、KaTeX 公式、彩色表格、引用块 → 可切换到源码模式查看原始 Markdown → 可在分屏模式下边编辑边预览。

### 1.3 技术栈总览

| 层 | 选型 | 理由 |
|----|------|------|
| 应用框架 | **Tauri 2.0**（Rust + 系统 WebView） | 包体小（~5MB）、内存低、原生系统集成、SoloMD/MarkNote 成功案例验证 |
| 前端框架 | **Vue 3 + TypeScript** | 轻量、模板语法直观、组合式 API 强大 |
| 状态管理 | **Pinia** | Vue 3 官方推荐、类型安全、无 boilerplate |
| Markdown 解析 | **markdown-it**（前端 JS） | 插件体系完善、性能好、可定制 token 规则 |
| 代码编辑器 | **CodeMirror 6** | 现代架构、性能优秀、扩展性强 |
| 代码高亮 | **highlight.js** | 180+ 语言支持、覆盖知识库所有语种 |
| 图表渲染 | **mermaid.js** | 知识库有 677 个 mermaid 块，原生支持 |
| 数学公式 | **KaTeX** | 比 MathJax 快 100 倍，SSR 友好 |
| 样式 | **Tailwind CSS** + 自定义 Markdown 主题 CSS | 工具类高效、主题 CSS 独立可替换 |
| 文件监控 | **Rust notify crate** | 跨平台 fs 事件、低开销 |
| 布局 | **CSS Grid** | 分屏模式更现代、对齐更精确 |

### 1.4 决策依据

- 成功案例验证（SoloMD、MarkNote 等）
- 15MB 级别体积 + 原生级启动速度
- 完整覆盖 Mermaid/KaTeX/代码高亮需求
- Rust 后端保障内存安全与并发处理

---

## 二、目标用户

### 2.1 主要用户画像

**P0 - 技术知识管理者**（Primary Persona）
- 拥有系统化的个人技术知识库，以目录+Markdown 方式组织
- 涵盖编程语言、系统架构、算法、面试准备等多领域
- 文档内容包含大量代码、图表、数学公式
- 需要高品质的阅读体验（类似出版级书籍排版）
- 偶尔需要修正错别字、补充内容（轻量编辑需求）

**P1 - 技术文档写作者**
- 使用 Markdown 编写技术博客、教程、API 文档
- 需要实时预览，关注排版效果
- 使用 Mermaid 绘制架构图和流程图

**P2 - 团队知识库浏览者**
- 需要浏览团队共享的 Markdown 文档目录
- 不需要编辑，只需要高品质渲染阅读

### 2.2 不是目标用户

- 重度双链笔记用户（→ Obsidian）
- 需要实时协作的团队（→ Notion / HackMD）
- 需要发布到网站的静态站点生成器用户（→ VitePress / Docusaurus）

---

## 三、核心功能需求

### FR-001: 目录加载与文件树展示

**描述**：加载指定目录，递归扫描所有 Markdown 文件和子目录，以树形结构展示。

**详细要求**：
- **FR-001.1**: 支持通过系统原生目录选择对话框选择根目录
- **FR-001.2**: 支持拖拽目录到应用窗口打开
- **FR-001.3**: 递归扫描目录，仅展示 `.md` 文件和包含 `.md` 文件的目录（过滤空目录和非 Markdown 文件）
- **FR-001.4**: 树节点展示信息：图标（文件夹/文档）、名称、文件数量角标（目录节点）
- **FR-001.5**: 目录按数字前缀自然排序（如 `01_xxx` < `02_xxx` < `10_xxx`），文件按文件名自然排序
- **FR-001.6**: 支持展开/折叠所有、搜索过滤（模糊匹配文件名和路径中的中英文）
- **FR-001.7**: 记住上次打开的目录路径和树展开状态（持久化到本地存储）
- **FR-001.8**: 文件树宽度可拖拽调节，支持折叠隐藏整个文件树面板

**性能约束**：
- 加载 250 个文件 / 100 个目录的树应在 200ms 内完成
- 树节点使用虚拟滚动（virtual scrolling）以应对大规模目录

### FR-002: 文件内容加载与展示

**描述**：选中文件树中的 Markdown 文件，在右侧内容区展示其内容。

**详细要求**：
- **FR-002.1**: 点击文件节点加载对应 `.md` 文件的原始文本
- **FR-002.2**: 文件读取由 Rust 后端通过 Tauri IPC 完成（处理 UTF-8 编码）
- **FR-002.3**: 支持多标签页（Tab）——可同时打开多个文件，通过标签切换（Phase 2）
- **FR-002.4**: 标签页展示文件名，鼠标悬停显示完整路径，支持关闭、关闭其他、关闭全部
- **FR-002.5**: 已修改未保存的标签显示修改指示器（圆点）
- **FR-002.6**: 加载超大文件（5000+ 行）时显示进度指示，不阻塞 UI

### FR-003: 三种显示模式

**描述**：内容区支持三种显示模式，通过工具栏切换。

**FR-003.1 — 渲染预览模式（Preview Mode）** [MVP 默认模式]
- 将 Markdown 解析为 HTML 并以精美样式渲染展示
- 这是产品的核心竞争力模式，渲染质量是最高优先级
- 支持目录大纲（Table of Contents）浮动面板——自动从 H1-H6 标题生成，点击跳转
- 渲染区域支持平滑滚动
- 支持通过 Ctrl/Cmd+F 在渲染内容中搜索文本

**FR-003.2 — 源码模式（Source Mode）** [MVP: 只读 | Phase 2: 可编辑]
- 使用 CodeMirror 6 显示原始 Markdown 文本
- **MVP 阶段**：只读查看，支持 Markdown 语法高亮、行号显示
- **Phase 2 阶段**：支持直接编辑，增加代码折叠、搜索替换（Ctrl/Cmd+F / Ctrl/Cmd+H）、Markdown 快捷键（加粗、斜体、标题级别等）

**FR-003.3 — 分屏模式（Split Mode）** [Phase 2]
- 左半源码、右半渲染预览，并排展示
- **同步滚动**：滚动任一侧，另一侧按比例联动
- **光标定位同步**：在源码侧点击某行时，渲染侧滚动到对应位置
- 分屏比例可拖拽调节
- 基于 CSS Grid 布局实现

**模式切换**：
- 工具栏按钮组切换（图标+文字）
- 快捷键：Ctrl/Cmd+1 (Preview)、Ctrl/Cmd+2 (Source)、Ctrl/Cmd+3 (Split)
- 模式切换时保持滚动位置
- MVP 阶段仅支持 Preview + Source 双模式切换

### FR-004: Markdown 渲染引擎

**描述**：基于 markdown-it 的完整 Markdown 渲染，覆盖所有 CommonMark 标准和常用扩展。

**FR-004.1 — 基础元素渲染** [MVP]
- 标题（H1-H6）：每个级别有独特的视觉样式（详见第八节 CSS 规范）
- 段落：适当的行间距和段间距
- 换行与分隔线
- 加粗、斜体、删除线、行内代码
- 有序列表、无序列表、任务列表（复选框）
- 嵌套列表（支持 4 级以上嵌套，每级有不同的符号样式）
- 引用块（blockquote），支持嵌套
- 链接（内部锚点链接 + 外部 URL 链接）
- 图片（支持 PNG/JPG/GIF/WebP，响应式宽度，点击放大）

**FR-004.2 — 表格渲染** [MVP]
- 标准 Markdown 表格
- 表头背景色区分
- 交替行颜色（斑马纹）
- 单元格边框
- 支持表格内的代码、加粗等行内格式
- 宽表格水平滚动

**FR-004.3 — 代码块渲染** [MVP 基础 | Phase 2 增强]
- 语法高亮（highlight.js，覆盖知识库实际使用的 20+ 种语言：Swift、C++、Python、Bash、Kotlin、Java、ObjC、C、GLSL、HLSL、Metal、YAML、XML、CMake 等）
- 代码块头部显示语言标签
- 代码块右上角「复制」按钮（复制原始代码到剪贴板，显示复制成功反馈）
- 行号显示（可配置开/关）
- 超长代码块内横向滚动
- ASCII 艺术框图（box-drawing 字符）的正确等宽渲染

**FR-004.4 — Mermaid 图表渲染** [Phase 2]
- 检测 ` ```mermaid ` 代码块，使用 mermaid.js 渲染为 SVG 图表
- 支持类型：flowchart、sequence diagram、class diagram、state diagram、Gantt chart、pie chart、ER diagram、mindmap
- 渲染失败时 graceful 降级为代码块显示，并提示语法错误
- 图表尺寸自适应容器宽度
- 图表支持主题跟随（light/dark 模式下不同配色）

**FR-004.5 — KaTeX 数学公式渲染** [Phase 2]
- 行内公式：`$...$` 语法
- 块级公式：`$$...$$` 语法
- 公式渲染失败时显示原始 LaTeX 源码 + 红色错误提示
- 支持常用数学符号、矩阵、分数、积分等

**FR-004.6 — 图片处理** [MVP]
- 支持本地相对路径图片（如 `./row_buffer_sliding_window.drawio.png`）
- 通过 Tauri 的 `asset:` 协议或自定义协议加载本地文件
- 图片最大宽度不超过内容区域，高度按比例缩放
- 点击图片弹出 lightbox 大图查看（支持缩放、拖拽）
- 图片加载失败时显示占位符 + 路径信息

### FR-005: 文件编辑与保存 [Phase 2]

**描述**：在源码模式和分屏模式下支持编辑 Markdown 并保存。

- **FR-005.1**: CodeMirror 6 编辑器支持完整的文本编辑
- **FR-005.2**: 自动保存（可配置间隔，默认 3 秒无操作后自动保存，或禁用仅手动）
- **FR-005.3**: 手动保存快捷键 Ctrl/Cmd+S
- **FR-005.4**: 保存通过 Tauri IPC 调用 Rust 后端写入文件系统
- **FR-005.5**: 编辑时支持 Undo/Redo（Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z）
- **FR-005.6**: 外部修改冲突检测——当文件在外部被修改，且用户本地也有未保存修改时，弹出冲突对话框（保留本地 / 加载外部 / 查看 diff）

### FR-006: 文件系统实时监控

**描述**：使用 Rust `notify` crate 监控已加载目录的文件系统变更。

- **FR-006.1**: 监听事件：文件创建、删除、修改、重命名
- **FR-006.2**: 文件创建/删除 → 自动更新文件树（增加/移除节点）
- **FR-006.3**: 文件修改 → 若该文件当前已在标签页中打开且无本地编辑，自动刷新内容
- **FR-006.4**: 防抖处理——多次快速变更合并为单次更新（debounce 300ms）
- **FR-006.5**: 仅监控 `.md` 文件变更，忽略 `.git`、`node_modules`、`.DS_Store` 等无关路径

### FR-007: 主题与外观

- **FR-007.1**: 支持亮色/暗色两种主题 [MVP]
- **FR-007.2**: 默认跟随系统主题偏好 [MVP]
- **FR-007.3**: 支持手动切换（工具栏按钮 / 快捷键）[MVP]
- **FR-007.4**: Markdown 渲染 CSS 为独立主题文件，支持加载自定义主题
- **FR-007.5**: CodeMirror 编辑器主题跟随应用主题
- **FR-007.6**: Mermaid 图表主题跟随应用主题 [Phase 2]
- **FR-007.7**: 应用字体可配置（正文字体、代码字体、字号）

### FR-008: 全局搜索 [Phase 2]

- **FR-008.1**: 在文件树上方提供全局搜索框
- **FR-008.2**: 支持按文件名搜索（模糊匹配）
- **FR-008.3**: 支持全文内容搜索（搜索所有 `.md` 文件中的文本内容）
- **FR-008.4**: 搜索结果列表展示：文件路径 + 匹配上下文摘要
- **FR-008.5**: 点击搜索结果直接打开对应文件并跳转到匹配位置

---

## 四、非功能需求

### NFR-001: 性能

| 指标 | 目标值 | 场景 |
|------|--------|------|
| 目录树加载 | < 200ms | 250 文件 / 100 目录 |
| 普通文件渲染 | < 100ms | 1000 行 Markdown |
| 大文件渲染 | < 500ms | 5000 行 Markdown |
| 模式切换 | < 150ms | 任意模式切换无闪烁 |
| 内存占用 | < 200MB | 打开 10 个标签页 |
| 应用启动 | < 1.5s | 冷启动到可交互 |
| 同步滚动延迟 | < 16ms | 分屏模式 60fps 滚动同步 |

**关键优化策略**（Phase 3）：
- 大文件渲染使用**增量渲染**——先渲染可视区域，后台异步渲染其余部分
- Mermaid 图表**懒渲染**——仅渲染进入视口的图表块（IntersectionObserver）
- 文件树使用**虚拟滚动**——仅渲染可见节点的 DOM
- 渲染结果**缓存**——文件未修改时复用上次渲染的 HTML

### NFR-002: 跨平台一致性

- macOS（Apple Silicon + Intel）和 Windows（x64 + ARM64）均需支持
- 使用系统原生 WebView（macOS: WKWebView, Windows: WebView2）
- 所有快捷键区分平台修饰键（macOS: Cmd, Windows: Ctrl）
- 文件路径处理兼容 `/`（macOS）和 `\`（Windows）
- 中文路径和文件名的完整支持

### NFR-003: 安装与分发

- macOS: `.dmg` 安装包（支持 Universal Binary）
- Windows: `.msi` 或 `.exe` 安装包（+ portable 版）
- 安装包体积目标 < 15MB
- 无需额外运行时依赖

### NFR-004: 安全性

- 文件系统访问仅限用户选择的目录范围（Tauri scope 机制）
- 渲染区禁止执行任意 JavaScript（Content Security Policy）
- 外部链接在系统浏览器中打开，不在应用内加载
- 不发送任何用户数据到网络（完全离线应用）

### NFR-005: 可访问性

- 支持系统级缩放（Ctrl/Cmd + +/-/0）
- 支持键盘导航（Tab 在文件树中导航、Enter 打开文件）
- 高对比度主题考虑

### NFR-006: 国际化

- 首期仅支持中文 UI（匹配主要用户群）
- 架构预留 i18n 扩展点（所有 UI 文本通过 key-value 管理）

---

## 五、技术架构

### 5.1 三层分层架构

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           MKPreview 应用                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────── 渲染层 (WebView) ─────────────────────────────────┐  │
│  │                                                                    │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐    │  │
│  │  │ markdown-it  │  │ mermaid.js   │  │ highlight.js         │    │  │
│  │  │ Markdown 解析 │  │ 图表渲染     │  │ 代码高亮             │    │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘    │  │
│  │  ┌──────────────┐  ┌──────────────────────────────────────┐      │  │
│  │  │ KaTeX        │  │ CSS 主题系统                          │      │  │
│  │  │ 数学公式渲染  │  │ (light/dark + Markdown 样式)          │      │  │
│  │  └──────────────┘  └──────────────────────────────────────┘      │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─────────────── 前端层 (Vue 3) ───────────────────────────────────┐  │
│  │                                                                    │  │
│  │  ┌──────────┐  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  │  │
│  │  │ 目录树   │  │ 分栏布局     │  │ 三模式切换   │  │ 标签页管理 │  │  │
│  │  │ 组件     │  │ 容器        │  │ 组件          │  │ 组件       │  │  │
│  │  └────┬────┘  └──────┬──────┘  └──────┬───────┘  └─────┬─────┘  │  │
│  │       │              │                │                │         │  │
│  │  ┌────▼──────────────▼────────────────▼────────────────▼─────┐  │  │
│  │  │              状态管理 (Pinia Stores)                        │  │  │
│  │  │  fileTreeStore | tabStore | settingsStore | uiStore        │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  │  ┌─────────────────────┐  ┌─────────────────────────────────┐    │  │
│  │  │ CodeMirror 6        │  │ 响应式界面设计                    │    │  │
│  │  │ 源码编辑器           │  │ (CSS Grid 布局)                  │    │  │
│  │  └─────────────────────┘  └─────────────────────────────────┘    │  │
│  └──────────────────────────┬─────────────────────────────────────┘  │
│                             │ Tauri IPC (invoke / event)             │
│  ┌──────────────────────────▼─────────────────────────────────────┐  │
│  │                     后端层 (Rust / Tauri Core)                   │  │
│  │                                                                    │  │
│  │  ┌──────────────┐  ┌──────────────────┐  ┌────────────────┐      │  │
│  │  │ 文件系统服务  │  │ 目录监控服务      │  │ 窗口管理服务   │      │  │
│  │  │ - read_file  │  │ - notify watcher │  │ - 窗口状态     │      │  │
│  │  │ - write_file │  │ - debounce       │  │ - 菜单栏       │      │  │
│  │  │ - scan_dir   │  │ - event emit     │  │ - 原生对话框   │      │  │
│  │  └──────────────┘  └──────────────────┘  └────────────────┘      │  │
│  │                                                                    │  │
│  │  ┌──────────────────────────────────────────────────────────┐    │  │
│  │  │              配置与持久化服务                               │    │  │
│  │  │  用户偏好 | 最近目录 | 窗口尺寸 | 文件树展开状态            │    │  │
│  │  └──────────────────────────────────────────────────────────┘    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────── 操作系统层 ────────────────────────────────────┐    │
│  │  文件系统 │ 系统 WebView │ 系统主题 │ 原生对话框 │ 剪贴板      │    │
│  └────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

**三层职责划分**：

| 层 | 职责 | 技术 |
|----|------|------|
| **后端层 (Rust)** | 文件系统监控（notify crate）、目录树构建与管理、文件读写操作、原生对话框调用、Tauri Command 通信 | Rust, notify, walkdir, serde |
| **前端层 (Vue 3)** | 目录树组件、分栏布局容器、三模式切换、状态管理（Pinia）、响应式界面设计 | Vue 3, Pinia, CSS Grid |
| **渲染层 (WebView)** | markdown-it 解析、Mermaid.js 图表渲染、KaTeX 数学公式、highlight.js 代码高亮、CSS 主题系统 | markdown-it, mermaid, KaTeX, highlight.js |

### 5.2 Pinia 状态管理

划分为以下 Store：

| Store | 职责 |
|-------|------|
| **fileTreeStore** | 目录树数据、展开状态、选中节点、搜索过滤 |
| **tabStore** | 打开的标签页列表、活动标签、每个标签的文件内容与滚动位置 |
| **editorStore** | 当前编辑状态、光标位置、修改标记 |
| **settingsStore** | 主题、显示模式、字体、自动保存配置 |
| **uiStore** | 面板宽度、分屏比例、搜索面板可见性 |

### 5.3 Rust IPC 命令接口设计

Tauri 的 `#[tauri::command]` 定义以下命令：

| 命令名 | 方向 | 参数 | 返回 | 说明 |
|--------|------|------|------|------|
| `scan_directory` | FE → BE | `path: String` | `FileTreeNode[]` | 递归扫描目录返回树结构 |
| `read_file` | FE → BE | `path: String` | `String` | 读取文件 UTF-8 内容 |
| `write_file` | FE → BE | `path: String, content: String` | `Result<()>` | 写入文件 |
| `get_file_meta` | FE → BE | `path: String` | `FileMeta` | 获取文件元信息 |
| `start_watching` | FE → BE | `path: String` | `()` | 启动目录监控 |
| `stop_watching` | FE → BE | `()` | `()` | 停止目录监控 |
| `search_files` | FE → BE | `dir: String, query: String` | `SearchResult[]` | 全文搜索 |
| `open_directory_dialog` | FE → BE | `()` | `Option<String>` | 系统目录选择框 |
| `get_settings` | FE → BE | `()` | `Settings` | 读取用户配置 |
| `save_settings` | FE → BE | `settings: Settings` | `()` | 保存用户配置 |

**事件（Rust → Frontend）**：

| 事件名 | 载荷 | 说明 |
|--------|------|------|
| `fs:change` | `{type, path}` | 文件系统变更通知 |
| `fs:error` | `{message}` | 文件系统错误 |

### 5.4 关键数据结构

**FileTreeNode**（Rust ↔ Frontend 共享）:
```typescript
interface FileTreeNode {
  name: string        // 文件/目录名
  path: string        // 绝对路径
  isDir: boolean
  children?: FileTreeNode[]  // 子节点（仅目录有）
  fileCount?: number         // 目录下 .md 文件数（递归计数）
}
```

**FileMeta**:
```typescript
interface FileMeta {
  path: string
  size: number    // 字节
  modified: number // 时间戳
  created: number
}
```

**SearchResult**:
```typescript
interface SearchResult {
  path: string
  lineNumber: number
  context: string   // 匹配行 +/- 上下文
}
```

---

## 六、渲染管道设计

### 6.1 完整渲染流水线

```
┌──────────┐     ┌──────────┐     ┌──────────────┐     ┌───────────────┐
│ .md 文件  │────▶│ Rust 后端│────▶│  Tauri IPC   │────▶│  前端接收     │
│ (磁盘)    │     │ read_file│     │  传输 UTF-8  │     │  原始文本     │
└──────────┘     └──────────┘     └──────────────┘     └───────┬───────┘
                                                               │
                                       ┌───────────────────────▼──────────────────┐
                                       │  Stage 1: markdown-it 核心解析            │
                                       │                                           │
                                       │  输入: 原始 Markdown 字符串               │
                                       │  处理: tokenize → parse → render          │
                                       │  插件链:                                  │
                                       │    ├── markdown-it-anchor (标题锚点)      │
                                       │    ├── markdown-it-katex (数学公式)       │
                                       │    ├── markdown-it-task-lists (任务列表)  │
                                       │    └── 自定义 mermaid fence rule         │
                                       │  输出: HTML 字符串                        │
                                       └──────────────────────┬───────────────────┘
                                                              │
                                       ┌──────────────────────▼───────────────────┐
                                       │  Stage 2: DOM 注入                        │
                                       │  将 HTML 插入渲染容器 (v-html)            │
                                       │  触发后续处理钩子                          │
                                       └──────────────────────┬───────────────────┘
                                                              │
                          ┌───────────────┬──────────────────┼──────────────────┐
                          │               │                  │                  │
            ┌─────────────▼──┐ ┌──────────▼───┐ ┌───────────▼──┐ ┌────────────▼──┐
            │ Stage 3a:      │ │ Stage 3b:    │ │ Stage 3c:    │ │ Stage 3d:     │
            │ highlight.js   │ │ mermaid.js   │ │ KaTeX        │ │ 图片路径      │
            │                │ │              │ │ (已在S1完成) │ │ 解析          │
            │ 查找所有       │ │ 查找所有     │ │              │ │               │
            │ pre>code 元素  │ │ .mermaid 容器│ │ 若 S1 未处理 │ │ 替换相对路径  │
            │ 调用 hljs      │ │ 调用 mermaid │ │ 则后处理     │ │ 为 asset://   │
            └────────────────┘ └──────────────┘ └──────────────┘ └───────────────┘
                          │               │                  │                  │
                          └───────────────┴──────────────────┴──────────────────┘
                                                              │
                                       ┌──────────────────────▼───────────────────┐
                                       │  Stage 4: CSS 主题 + 交互增强             │
                                       │  • 应用 Markdown 渲染主题样式表           │
                                       │  • 代码块「复制」按钮事件绑定             │
                                       │  • 图片 lightbox 点击事件                 │
                                       │  • 外部链接 → 系统浏览器拦截              │
                                       │  • TOC 目录生成与锚点绑定                 │
                                       │  • 滚动位置映射表构建(用于同步滚动)       │
                                       └──────────────────────────────────────────┘
```

### 6.2 markdown-it 插件配置策略

markdown-it 实例的创建采用**工厂模式**，便于复用和测试：

1. **核心实例配置**: `html: false`（安全）、`linkify: true`、`typographer: true`、`breaks: true`

2. **插件加载顺序**（顺序敏感）：
   - `markdown-it-anchor` — 为所有标题生成 id 锚点
   - `markdown-it-toc-done-right` — 生成 TOC 数据结构
   - `markdown-it-katex` — 处理 `$...$` 和 `$$...$$`
   - `markdown-it-task-lists` — 渲染 `- [x]` 任务列表
   - 自定义 `fence` 覆盖规则 — 拦截 `mermaid` 语言标记的代码块，输出为 `<div class="mermaid">` 容器

3. **自定义渲染规则**：
   - `image` 规则 — 将 `src` 中的相对路径转换为 Tauri asset 协议路径
   - `link_open` 规则 — 为外部链接添加 `target="_blank"` 和 `rel="noopener"`
   - `code_block` / `fence` 规则 — 添加语言类名、复制按钮容器

### 6.3 性能优化策略 [Phase 3]

- **渲染缓存**: 维护 `Map<filePath, {hash, html}>` 缓存，文件内容 hash 未变则直接复用
- **Mermaid 懒渲染**: 使用 `IntersectionObserver` 监测 mermaid 容器进入视口时才调用 `mermaid.render()`
- **大文件分片**: 超过 3000 行的文件，先渲染前 100 个 block-level token，再用 `requestIdleCallback` 渐进渲染
- **Web Worker 解析**: markdown-it 的 tokenize + render 可在 Web Worker 中执行，避免阻塞主线程

### 6.4 同步滚动算法 [Phase 2]

分屏模式下源码与预览的同步滚动采用**段落映射法**：

1. markdown-it 解析时记录每个 block token 的源码行号范围（`map` 属性）
2. 渲染后为每个块级元素添加 `data-source-line="N"` 属性
3. 构建映射表：`sourceLineRanges[] ↔ renderedElementOffsets[]`
4. 滚动源码时，根据当前可见行号查映射表找到对应渲染元素，`scrollTo` 对应偏移
5. 反向同理：滚动预览时，根据可见元素的 `data-source-line` 回映到源码行
6. 使用 `requestAnimationFrame` 节流，确保 60fps

---

## 七、UI/UX 设计规范

### 7.1 整体布局

```
┌──────────────────────────────────────────────────────────────────────┐
│  MKPreview                                            ─  □  ✕       │
├──────────────────────────────────────────────────────────────────────┤
│  📂 Knowledge/learn  │  [Preview] [Source] [Split]           🔍  🌙 │
├──────────┬───────────┴───────────────────────────────────────────────┤
│          │ 📄 tab1.md  │ 📄 tab2.md  │                              │
│ 🔍 搜索  ├──────────────────────────────────────────────────────────┤
│          │                                                          │
│ 📁 Cpp   │   # 标题                                                │
│  📁 01_  │                                                          │
│   📄 文件│   正文内容 ......                                        │
│   📄 文件│                                                          │
│  📁 02_  │   ```cpp                                                 │
│ 📁 Swift │   int main() { ... }                                    │
│  📁 01_  │   ```                                                    │
│ 📁 iOS   │                                                          │
│  ...     │   [mermaid 图表]                                         │
│          │                                                          │
│          │   | 表头 | 表头 |                                        │
│          │   | ---- | ---- |                                        │
│          │   | 数据 | 数据 |                                        │
│          │                                                          │
│          ├──────────────────────────────────────────────────────────┤
│          │  UTF-8  │  Markdown  │  5190 行                          │
└──────────┴──────────────────────────────────────────────────────────┘
```

### 7.2 布局规格（CSS Grid）

| 区域 | 默认尺寸 | 可调 | 最小 | 最大 |
|------|---------|------|------|------|
| 文件树面板 | 260px | 拖拽 | 180px | 400px |
| 内容区 | 1fr（剩余空间） | 自动 | 400px | — |
| 分屏模式左右比 | 1fr 1fr | 拖拽 | 30% | 70% |
| 标签栏高度 | 36px | 固定 | — | — |
| 工具栏高度 | 40px | 固定 | — | — |
| 状态栏高度 | 24px | 固定 | — | — |

### 7.3 颜色系统

**亮色主题 (Light)**:

| 语义 Token | 值 | 用途 |
|------------|------|------|
| `--bg-primary` | `#FFFFFF` | 应用背景 |
| `--bg-secondary` | `#F8F9FA` | 文件树背景 |
| `--bg-tertiary` | `#F1F3F5` | 标签栏/工具栏背景 |
| `--bg-code` | `#F6F8FA` | 代码块背景 |
| `--text-primary` | `#1A1A2E` | 正文 |
| `--text-secondary` | `#6B7280` | 辅助文字 |
| `--text-muted` | `#9CA3AF` | 占位/禁用 |
| `--border` | `#E5E7EB` | 分割线/边框 |
| `--accent` | `#3B82F6` | 主强调色（链接/选中） |
| `--accent-red` | `#EF4444` | H2 左边框、警告 |
| `--accent-green` | `#10B981` | 成功、代码新增 |
| `--accent-amber` | `#F59E0B` | 提醒 |

**暗色主题 (Dark)**:

| 语义 Token | 值 | 用途 |
|------------|------|------|
| `--bg-primary` | `#0D1117` | 应用背景 |
| `--bg-secondary` | `#161B22` | 文件树背景 |
| `--bg-tertiary` | `#21262D` | 标签栏/工具栏背景 |
| `--bg-code` | `#1C2128` | 代码块背景 |
| `--text-primary` | `#E6EDF3` | 正文 |
| `--text-secondary` | `#8B949E` | 辅助文字 |
| `--text-muted` | `#484F58` | 占位/禁用 |
| `--border` | `#30363D` | 分割线/边框 |
| `--accent` | `#58A6FF` | 主强调色 |
| `--accent-red` | `#F85149` | H2 左边框 |
| `--accent-green` | `#3FB950` | 成功 |
| `--accent-amber` | `#D29922` | 提醒 |

### 7.4 字体系统

| 用途 | 字体族 | 默认字号 | 行高 |
|------|--------|---------|------|
| UI 界面 | `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` | 13px | 1.5 |
| Markdown 正文 | `'LXGW WenKai', 'Noto Serif SC', Georgia, serif` | 16px | 1.8 |
| 代码 | `'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace` | 14px | 1.6 |
| 标题 | 与正文相同字体族 | 按级别递减 | 1.3 |

### 7.5 交互规范

- **文件树**：单击选中+打开、双击在新标签打开、右键上下文菜单（在 Finder/Explorer 中显示、复制路径）
- **标签页**：单击切换、中键关闭、拖拽排序、右键（关闭/关闭其他/关闭右侧）
- **分割条**：鼠标悬停变色、拖拽调整、双击恢复默认比例
- **过渡动画**：主题切换 300ms 渐变、面板折叠 200ms 滑动、模式切换 150ms 淡入淡出

---

## 八、Markdown CSS 样式规范

所有样式封装在 `.mk-body` 容器类中，避免与应用 UI 样式冲突。

### 8.1 标题样式

| 级别 | 字号 | 字重 | 特殊样式 | 间距 |
|------|------|------|---------|------|
| H1 | 2.2em | 700 | 底部 2px 实线分隔（`--border` 色） | margin-top: 2.5em, margin-bottom: 1em |
| H2 | 1.7em | 700 | **左侧 4px 红色竖线** (`--accent-red`) + padding-left: 12px | margin-top: 2em, margin-bottom: 0.8em |
| H3 | 1.4em | 600 | 无特殊装饰 | margin-top: 1.8em, margin-bottom: 0.6em |
| H4 | 1.2em | 600 | `--text-secondary` 颜色 | margin-top: 1.5em, margin-bottom: 0.5em |
| H5 | 1.05em | 600 | `--text-secondary` 颜色 | margin-top: 1.2em, margin-bottom: 0.4em |
| H6 | 1em | 600 | `--text-muted` 颜色、大写字母 | margin-top: 1em, margin-bottom: 0.4em |

所有标题：`scroll-margin-top: 80px`（为 TOC 锚点跳转预留工具栏高度）。

### 8.2 段落与正文

- 段落间距：`margin-bottom: 1.2em`
- 正文颜色：`--text-primary`
- **加粗**：`font-weight: 600`，颜色比正文略深
- *斜体*：保持正文颜色
- ~~删除线~~：`text-decoration: line-through`，颜色 `--text-muted`
- `行内代码`：背景 `--bg-code`、圆角 3px、padding 2px 6px、字号 0.9em、代码字体

### 8.3 列表

- **无序列表**：一级 `disc (●)`、二级 `circle (○)`、三级 `square (■)`、四级回到 `disc`
- **有序列表**：使用 CSS counter，一级 `1.`、嵌套层 `a.`、`i.` 等
- **任务列表**：自定义 checkbox 样式（选中为 `--accent` 色填充、圆角方框）
- 列表项间距：`margin-bottom: 0.4em`
- 嵌套缩进：每级 `padding-left: 1.5em`

### 8.4 引用块（Blockquote）

- 左侧 4px 竖线，颜色 `--accent`（蓝色，区别于 H2 的红色竖线）
- 背景：`--bg-secondary` 带 50% 透明度
- padding: `1em 1.2em`
- 文字颜色：`--text-secondary`
- 嵌套引用：竖线颜色渐变变浅

### 8.5 代码块

```
┌─ cpp ──────────────────────────────────────────── 📋 ─┐
│  1 │ #include <iostream>                               │
│  2 │                                                   │
│  3 │ int main() {                                      │
│  4 │     std::cout << "Hello" << std::endl;            │
│  5 │     return 0;                                     │
│  6 │ }                                                 │
└────────────────────────────────────────────────────────┘
```

- 圆角: 8px
- 背景: `--bg-code`
- 边框: 1px `--border`
- 头部条：显示语言标签，背景略深于代码区
- 行号：`--text-muted` 颜色、右对齐、固定宽度、与代码之间有分隔
- 复制按钮：右上角、悬浮时显示、点击后变为 "已复制" 2 秒后恢复
- 代码字体：`--font-mono`
- 溢出：横向 `overflow-x: auto`，不自动换行
- 高亮主题：亮色用 `github`、暗色用 `github-dark`

### 8.6 表格

- 宽度：默认 `width: 100%`，超宽时横向滚动（外包 `overflow-x: auto` 容器）
- **表头**（`thead th`）：背景 `--bg-tertiary`、字重 600、`text-align: left`
- **表体**：交替行背景（偶数行 `--bg-secondary`，奇数行透明）
- 边框：`1px solid --border`，`border-collapse: collapse`
- 单元格 padding：`10px 14px`
- 悬浮行：背景色加深（hover 效果）

### 8.7 分隔线（hr）

- 高度 2px、颜色 `--border`
- margin: `2em 0`

### 8.8 链接

- 颜色：`--accent`
- 下划线：默认无、悬浮时出现
- 外部链接：右上角小图标 `↗`（CSS `::after` 伪元素）
- 内部锚点链接：平滑滚动跳转

### 8.9 图片

- `max-width: 100%`、`height: auto`
- 居中显示（block 级）
- 圆角 6px、轻微阴影（`box-shadow`）
- `alt` 文字作为标题（caption）显示在图片下方
- 悬浮时轻微放大（`transform: scale(1.02)`，300ms transition）

### 8.10 Mermaid 图表

- 容器居中、padding 1.5em
- SVG 宽度自适应、max-width 100%
- 暗色模式下使用 mermaid 的 `dark` 主题
- 渲染失败时显示错误提示框：红色边框 + 原始代码 + 错误信息

### 8.11 KaTeX 公式

- 行内公式：与正文基线对齐
- 块级公式：居中、`margin: 1.5em 0`
- 公式字号：与正文一致（1em）
- 渲染失败：红色文字显示原始 LaTeX 代码

### 8.12 ASCII 框图特殊处理

知识库大量使用等宽 box-drawing 字符（`┌ ─ ┐ │ └ ┘ ├ ┤ ┬ ┴ ┼` 等）绘制架构图：

- 在无语言标记的代码块中，使用等宽字体严格渲染
- `line-height: 1.2`（不能太大否则框线断裂）
- `letter-spacing: 0`
- `font-variant-ligatures: none`（禁用连字）

---

## 九、项目结构

```
mkpreview/
├── src-tauri/                          # Rust 后端 (Tauri)
│   ├── Cargo.toml                      # Rust 依赖配置
│   ├── tauri.conf.json                 # Tauri 应用配置 (窗口/安全/打包)
│   ├── capabilities/                   # Tauri 2.0 权限声明
│   │   └── default.json
│   ├── icons/                          # 应用图标
│   └── src/
│       ├── main.rs                     # 入口
│       ├── lib.rs                      # 模块注册
│       ├── commands/                   # IPC 命令定义
│       │   ├── mod.rs
│       │   ├── file_system.rs          # scan_directory / read_file / write_file
│       │   ├── watcher.rs              # start_watching / stop_watching
│       │   ├── search.rs              # search_files
│       │   └── settings.rs            # get_settings / save_settings
│       ├── services/                   # 业务服务
│       │   ├── mod.rs
│       │   ├── dir_scanner.rs          # 目录递归扫描逻辑
│       │   ├── file_watcher.rs         # notify watcher 封装
│       │   └── config_store.rs         # 持久化配置 (JSON 文件)
│       └── models/                     # 数据结构
│           ├── mod.rs
│           ├── file_tree.rs            # FileTreeNode / FileMeta
│           ├── search_result.rs        # SearchResult
│           └── settings.rs             # Settings
│
├── src/                                # 前端 (Vue 3 + TypeScript)
│   ├── main.ts                         # Vue 入口
│   ├── App.vue                         # 根组件
│   │
│   ├── assets/
│   │   └── styles/
│   │       ├── global.css              # 全局样式 + Tailwind 引入
│   │       ├── themes/
│   │       │   ├── light.css           # 亮色主题 CSS 变量
│   │       │   └── dark.css            # 暗色主题 CSS 变量
│   │       └── markdown/
│   │           ├── base.css            # Markdown 渲染基础样式 (.mk-body)
│   │           ├── code.css            # 代码块样式
│   │           ├── table.css           # 表格样式
│   │           └── mermaid.css         # Mermaid 图表样式
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.vue           # 整体布局骨架 (CSS Grid)
│   │   │   ├── Sidebar.vue             # 左侧面板容器
│   │   │   ├── ContentArea.vue         # 右侧内容区容器
│   │   │   ├── Toolbar.vue             # 顶部工具栏
│   │   │   ├── StatusBar.vue           # 底部状态栏
│   │   │   └── GridResizer.vue         # CSS Grid 可拖拽分割条
│   │   │
│   │   ├── file-tree/
│   │   │   ├── FileTree.vue            # 文件树主组件
│   │   │   ├── TreeNode.vue            # 单个树节点
│   │   │   └── TreeSearch.vue          # 文件树搜索框
│   │   │
│   │   ├── tabs/
│   │   │   ├── TabBar.vue              # 标签栏
│   │   │   └── TabItem.vue             # 单个标签
│   │   │
│   │   ├── editor/
│   │   │   ├── SourceEditor.vue        # CodeMirror 6 封装
│   │   │   └── markdown-lang.ts        # Markdown 语法支持配置
│   │   │
│   │   ├── preview/
│   │   │   ├── MarkdownPreview.vue     # 渲染预览主组件
│   │   │   ├── CodeBlock.vue           # 代码块增强 (复制按钮)
│   │   │   ├── MermaidBlock.vue        # Mermaid 懒渲染组件
│   │   │   ├── ImageLightbox.vue       # 图片放大查看
│   │   │   └── TableOfContents.vue     # 目录大纲
│   │   │
│   │   ├── split/
│   │   │   └── SplitView.vue           # 分屏模式容器 (CSS Grid)
│   │   │
│   │   ├── search/
│   │   │   ├── GlobalSearch.vue        # 全局搜索面板
│   │   │   └── SearchResultList.vue    # 搜索结果列表
│   │   │
│   │   └── settings/
│   │       └── SettingsPanel.vue       # 设置面板
│   │
│   ├── composables/                    # Vue 3 组合式函数
│   │   ├── useFileTree.ts              # 文件树逻辑
│   │   ├── useMarkdownRenderer.ts      # markdown-it 渲染
│   │   ├── useCodeMirror.ts            # CodeMirror 初始化
│   │   ├── useScrollSync.ts            # 同步滚动
│   │   ├── useTheme.ts                 # 主题切换
│   │   ├── useKeyboard.ts             # 快捷键管理
│   │   ├── useResizable.ts            # 面板拖拽调整
│   │   └── useDebounce.ts             # 防抖
│   │
│   ├── stores/                         # Pinia 状态管理
│   │   ├── fileTreeStore.ts
│   │   ├── tabStore.ts
│   │   ├── editorStore.ts
│   │   ├── settingsStore.ts
│   │   └── uiStore.ts
│   │
│   ├── services/                       # Tauri IPC 调用封装
│   │   ├── tauriCommands.ts            # 所有 invoke 调用
│   │   └── tauriEvents.ts             # 事件监听封装
│   │
│   ├── lib/                            # 工具库（渲染层）
│   │   ├── markdownIt.ts               # markdown-it 实例工厂 + 插件配置
│   │   ├── highlighter.ts              # highlight.js 配置 + 按需加载
│   │   ├── mermaidConfig.ts            # mermaid.js 初始化配置
│   │   ├── katexConfig.ts              # KaTeX 配置
│   │   ├── scrollSyncEngine.ts         # 滚动同步算法
│   │   └── naturalSort.ts             # 自然排序 (数字感知)
│   │
│   └── types/                          # TypeScript 类型定义
│       ├── fileTree.ts                 # FileTreeNode / FileMeta
│       ├── search.ts                   # SearchResult
│       └── settings.ts                # Settings
│
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vite.config.ts
└── env.d.ts                            # Vite 环境类型声明
```

---

## 十、里程碑规划

### Phase 1: MVP 开发

**目标**: 能加载目录、浏览文件树、以精美样式渲染 Markdown，支持双模式切换和主题。

**交付物**：
1. Tauri 2.0 + Vue 3 + TypeScript + Pinia 项目脚手架
2. Rust 后端：`scan_directory`、`read_file` 命令、`start_watching`/`stop_watching` 文件监控
3. 前端 AppLayout 布局骨架（CSS Grid 左右分栏 + 工具栏 + 状态栏）
4. FileTree 组件（展示目录树、点击选中文件、自然排序、虚拟滚动）
5. MarkdownPreview 基础版（markdown-it 渲染：H1-H6 + 段落 + 列表 + 引用 + 表格 + 链接 + 图片）
6. SourceEditor 只读版（CodeMirror 6 只读 + Markdown 语法高亮 + 行号）
7. 双模式切换（Preview + Source）
8. 完整 Markdown CSS 主题（亮色 + 暗色）
9. 主题切换（跟随系统 + 手动）
10. 基础代码块语法高亮（highlight.js）+ 复制按钮
11. 文件系统变更自动更新文件树

**验收标准**: 打开 `Knowledge/learn/`，浏览任意文件，渲染出结构正确且美观的 HTML，支持切换到源码查看模式，支持亮/暗主题切换。

### Phase 2: 核心功能

**目标**: 完成分屏模式、高级渲染（Mermaid/KaTeX）、编辑功能、多标签页、全局搜索。

**交付物**：
1. 分屏模式实现（CSS Grid 布局 + 同步滚动算法）
2. Mermaid 图表渲染集成（677 个 mermaid 块可正确渲染）
3. KaTeX 数学公式渲染
4. 代码高亮优化（highlight.js 按需加载、更多语言支持）
5. 源码模式编辑功能（CodeMirror 6 可编辑 + 代码折叠 + 搜索替换）
6. 文件保存（Ctrl/Cmd+S 手动保存 + 自动保存）
7. `write_file` Rust IPC 命令
8. 外部修改冲突检测
9. 多标签页管理（打开/关闭/切换/排序）
10. 全局搜索（文件名 + 全文内容搜索）
11. TOC 目录大纲浮动面板
12. 图片 lightbox 大图查看
13. Mermaid/highlight.js/CodeMirror 主题跟随

**验收标准**: 打开知识库中最复杂的文章（含 mermaid + 代码 + 表格 + 公式），所有元素正确美观渲染。分屏模式同步滚动流畅。编辑保存正常。

### Phase 3: 性能优化与发布

**目标**: 性能达标、交互体验打磨、生产就绪并打包发布。

**交付物**：
1. 大文件处理优化（增量渲染 + Web Worker）
2. Mermaid 懒渲染（IntersectionObserver）
3. 渲染结果缓存
4. 文件树虚拟滚动优化
5. 启动速度优化
6. 内存占用优化
7. 用户配置持久化（主题、字体、最近目录、窗口状态）
8. 快捷键系统完善
9. 状态栏信息（行数、文件大小、编码）
10. 应用图标 + 菜单栏
11. 跨平台构建验证（macOS + Windows）
12. macOS `.dmg` 安装包（Universal Binary）
13. Windows `.msi` 安装包

**验收标准**: 全部 NFR 性能指标达标。248 个文件的知识库使用流畅无卡顿。安装包可在 macOS 和 Windows 上正常安装运行。

---

## 十一、未来扩展

以下功能不在首期范围内，但架构设计预留扩展点：

| 编号 | 扩展方向 | 描述 | 预留策略 |
|------|---------|------|---------|
| EXT-001 | 视频播放 | 支持 Markdown 中嵌入的视频文件播放 | markdown-it 渲染规则预留 `video` 标签处理 |
| EXT-002 | 导出 PDF | 将渲染后的 Markdown 导出为 PDF | 渲染结果为标准 HTML+CSS，可通过 `window.print()` 导出 |
| EXT-003 | 多语言 UI | 支持英语等多语言界面 | UI 文本通过 i18n key-value 管理 |
| EXT-004 | 自定义主题导入 | 用户导入自定义 CSS 主题文件 | Markdown CSS 为独立文件，支持运行时替换 |
| EXT-005 | Git 集成 | 显示文件 git 状态、diff 视图 | 后端 `commands` 目录可添加 `git.rs` 模块 |
| EXT-006 | 插件系统 | 支持用户开发 markdown-it 插件扩展 | markdown-it 已有插件架构，暴露配置入口 |
| EXT-007 | 双链 / Backlinks | Markdown 文件间的双向链接 | 后端扫描时可构建链接图谱 |
| EXT-008 | AI 辅助 | AI 摘要、翻译、续写 | 工具栏预留 AI 按钮位，后端预留 API 调用模块 |
| EXT-009 | 网络图片缓存 | 缓存远程图片到本地 | 图片加载管道中增加缓存层 |
| EXT-010 | Markdown 扩展语法 | 支持 admonition (:::tip)、脚注、上下标 | markdown-it 插件机制直接支持 |

---

## 附录 A: 快捷键汇总

| 功能 | macOS | Windows |
|------|-------|---------|
| 打开目录 | Cmd+O | Ctrl+O |
| 保存文件 | Cmd+S | Ctrl+S |
| 预览模式 | Cmd+1 | Ctrl+1 |
| 源码模式 | Cmd+2 | Ctrl+2 |
| 分屏模式 | Cmd+3 | Ctrl+3 |
| 搜索 | Cmd+F | Ctrl+F |
| 全局搜索 | Cmd+Shift+F | Ctrl+Shift+F |
| 关闭标签 | Cmd+W | Ctrl+W |
| 切换标签 | Cmd+Tab / Cmd+Shift+Tab | Ctrl+Tab / Ctrl+Shift+Tab |
| 放大 | Cmd+= | Ctrl+= |
| 缩小 | Cmd+- | Ctrl+- |
| 重置缩放 | Cmd+0 | Ctrl+0 |
| 切换主题 | Cmd+Shift+T | Ctrl+Shift+T |
| 切换侧栏 | Cmd+B | Ctrl+B |

---

## 附录 B: 第三方依赖清单

### Rust (Cargo)

| Crate | 版本 | 用途 |
|-------|------|------|
| `tauri` | 2.x | 应用框架 |
| `tauri-build` | 2.x | 构建脚本 |
| `notify` | 6.x | 文件系统监控 |
| `serde` / `serde_json` | 1.x | 序列化 |
| `walkdir` | 2.x | 递归目录遍历 |

### 前端 (npm)

| Package | 用途 |
|---------|------|
| `vue` | UI 框架 |
| `pinia` | 状态管理 |
| `typescript` | 类型系统 |
| `@tauri-apps/api` | Tauri 前端 API |
| `@tauri-apps/plugin-dialog` | 系统对话框 |
| `@tauri-apps/plugin-fs` | 文件系统访问 |
| `markdown-it` | Markdown 解析 |
| `@types/markdown-it` | 类型定义 |
| `markdown-it-katex` | KaTeX 插件 |
| `markdown-it-anchor` | 标题锚点 |
| `markdown-it-task-lists` | 任务列表 |
| `highlight.js` | 代码语法高亮 |
| `mermaid` | 图表渲染 |
| `katex` | 数学公式 |
| `@codemirror/view` | 代码编辑器核心 |
| `@codemirror/state` | 编辑器状态 |
| `@codemirror/lang-markdown` | Markdown 语言支持 |
| `codemirror` | 编辑器基础包 |
| `tailwindcss` | CSS 工具类 |
| `vite` | 构建工具 |
| `@vitejs/plugin-vue` | Vue Vite 插件 |
| `vue-tsc` | Vue TypeScript 检查 |
