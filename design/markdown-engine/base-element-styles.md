# F06-02 基础元素渲染样式

## 1. 功能描述与目标

本特性定义 `.mk-body` 容器下所有 Markdown 基础元素的渲染样式，是整个渲染引擎的**视觉核心**。需严格遵循 PRD 第八节 CSS 样式规范（8.1-8.12），实现出版级书籍排版的精美效果。

覆盖元素包括：
- 标题 H1-H6（含 H2 红色竖线装饰、H1 底部分隔线）
- 段落与正文（行间距、段间距、加粗/斜体/删除线/行内代码）
- 列表（无序/有序/任务列表，含嵌套缩进与符号变化）
- 引用块 blockquote（蓝色竖线 + 背景 + 嵌套渐变）
- 链接（悬浮下划线 + 外部链接图标）
- 分隔线 hr
- 图片（居中、圆角、阴影、悬浮放大）
- Mermaid 图表容器
- KaTeX 公式容器
- ASCII 框图特殊处理

样式必须同时支持**亮色主题**和**暗色主题**，通过 CSS 变量自动适配。

## 2. 技术实现方案

### 2.1 文件位置

```
src/assets/styles/markdown/
├── base.css          # 本特性：基础元素完整样式
└── (其他由后续特性补充: code.css, table.css, mermaid.css)
```

### 2.2 CSS 架构设计

采用**CSS 变量驱动**的样式架构：
- 所有颜色、字体、间距值使用 CSS 自定义属性（变量）
- `.mk-body` 作为样式隔离容器，所有选择器以 `.mk-body` 开头
- 亮色/暗色主题通过 `html[data-theme="light|dark"]` 切换变量值
- 与 Tailwind CSS 工具类不冲突（无全局选择器污染）

### 2.3 完整 CSS 代码

```css
/* ============================================================
   MKPreview - Markdown 基础元素渲染样式
   文件: src/assets/styles/markdown/base.css
   范围: .mk-body 容器下的所有基础 Markdown 元素
   规范: PRD 第八节 8.1-8.12
   ============================================================ */

/* -------------------- 容器基础 -------------------- */
.mk-body {
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.8;
  color: var(--text-primary);
  max-width: 860px;
  margin: 0 auto;
  padding: 40px 48px;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* -------------------- 8.1 标题样式 -------------------- */

.mk-body h1,
.mk-body h2,
.mk-body h3,
.mk-body h4,
.mk-body h5,
.mk-body h6 {
  font-family: var(--font-body);
  line-height: 1.3;
  scroll-margin-top: 80px;  /* TOC 锚点跳转预留工具栏高度 */
}

/* H1: 2.2em, 700, 底部 2px 实线分隔 */
.mk-body h1 {
  font-size: 2.2em;
  font-weight: 700;
  margin: 2.5em 0 1em;
  padding-bottom: 0.4em;
  border-bottom: 2px solid var(--border);
}

/* H2: 1.7em, 700, 左侧 4px 红色竖线 */
.mk-body h2 {
  font-size: 1.7em;
  font-weight: 700;
  margin: 2em 0 0.8em;
  padding-left: 12px;
  border-left: 4px solid var(--accent-red);
}

/* H3: 1.4em, 600 */
.mk-body h3 {
  font-size: 1.4em;
  font-weight: 600;
  margin: 1.8em 0 0.6em;
}

/* H4: 1.2em, 600, text-secondary 颜色 */
.mk-body h4 {
  font-size: 1.2em;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 1.5em 0 0.5em;
}

/* H5: 1.05em, 600, text-secondary 颜色 */
.mk-body h5 {
  font-size: 1.05em;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 1.2em 0 0.4em;
}

/* H6: 1em, 600, text-muted 颜色, 大写字母 */
.mk-body h6 {
  font-size: 1em;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 1em 0 0.4em;
}

/* 第一个标题去除顶部 margin */
.mk-body h1:first-child,
.mk-body h2:first-child,
.mk-body h3:first-child {
  margin-top: 0;
}

/* 标题锚点链接样式（markdown-it-anchor 生成） */
.mk-body .header-anchor {
  float: left;
  margin-left: -20px;
  padding-right: 4px;
  text-decoration: none;
  opacity: 0;
  transition: opacity 0.15s;
  color: var(--accent);
  font-size: 0.85em;
}

.mk-body h1:hover .header-anchor,
.mk-body h2:hover .header-anchor,
.mk-body h3:hover .header-anchor,
.mk-body h4:hover .header-anchor,
.mk-body h5:hover .header-anchor,
.mk-body h6:hover .header-anchor {
  opacity: 1;
}

/* -------------------- 8.2 段落与正文 -------------------- */

.mk-body p {
  margin-bottom: 1.2em;
}

/* 加粗 */
.mk-body strong,
.mk-body b {
  font-weight: 600;
  color: var(--text-primary);
}

/* 斜体 */
.mk-body em,
.mk-body i {
  font-style: italic;
}

/* 删除线 */
.mk-body del,
.mk-body s {
  text-decoration: line-through;
  color: var(--text-muted);
}

/* 行内代码 */
.mk-body code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--bg-code);
  padding: 2px 6px;
  border-radius: 3px;
  color: var(--accent-red);
  word-break: break-word;
}

/* 行内代码在链接中 */
.mk-body a code {
  color: inherit;
}

/* 高亮标记 */
.mk-body mark {
  background: color-mix(in srgb, var(--accent-amber) 30%, transparent);
  color: var(--text-primary);
  padding: 0 2px;
  border-radius: 2px;
}

/* 上标/下标（若插件支持） */
.mk-body sup,
.mk-body sub {
  font-size: 0.75em;
  line-height: 0;
}

/* -------------------- 8.3 列表 -------------------- */

.mk-body ul,
.mk-body ol {
  margin: 0 0 1.2em 1.5em;
  padding-left: 1em;
}

/* 无序列表符号层级 */
.mk-body ul {
  list-style-type: disc;
}

.mk-body ul ul {
  list-style-type: circle;
}

.mk-body ul ul ul {
  list-style-type: square;
}

.mk-body ul ul ul ul {
  list-style-type: disc;  /* 四级回到 disc */
}

/* 有序列表使用 CSS counter */
.mk-body ol {
  list-style-type: decimal;
  counter-reset: list-item;
}

.mk-body ol ol {
  list-style-type: lower-alpha;
}

.mk-body ol ol ol {
  list-style-type: lower-roman;
}

/* 列表项间距 */
.mk-body li {
  margin-bottom: 0.4em;
}

.mk-body li > p {
  margin-bottom: 0.4em;
}

.mk-body li > p:last-child {
  margin-bottom: 0;
}

/* 嵌套列表缩进 */
.mk-body li > ul,
.mk-body li > ol {
  margin-top: 0.4em;
  margin-bottom: 0.4em;
}

/* 任务列表（markdown-it-task-lists） */
.mk-body .task-list-item {
  list-style-type: none;
  position: relative;
  padding-left: 1.5em;
}

/* 自定义 Checkbox 样式（覆盖原生 appearance） */
.mk-body .task-list-item > input[type="checkbox"] {
  position: absolute;
  left: 0;
  top: 0.35em;
  width: 16px;
  height: 16px;
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
  border: 2px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  cursor: default;
  transition: all 0.15s ease;
}

.mk-body .task-list-item > input[type="checkbox"]:checked {
  background: var(--accent);
  border-color: var(--accent);
}

.mk-body .task-list-item > input[type="checkbox"]:checked::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 0px;
  width: 5px;
  height: 9px;
  border: solid var(--bg-primary);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.mk-body .task-list-item > label {
  cursor: default;
}

/* -------------------- 8.4 引用块 Blockquote -------------------- */

.mk-body blockquote {
  margin: 1.2em 0;
  padding: 1em 1.2em;
  border-left: 4px solid var(--accent);
  background: color-mix(in srgb, var(--bg-secondary) 50%, transparent);
  border-radius: 0 6px 6px 0;
  color: var(--text-secondary);
}

.mk-body blockquote > :first-child {
  margin-top: 0;
}

.mk-body blockquote > :last-child {
  margin-bottom: 0;
}

.mk-body blockquote p {
  margin-bottom: 0.6em;
}

.mk-body blockquote p:last-child {
  margin-bottom: 0;
}

/* 嵌套引用：竖线颜色渐变变浅 */
.mk-body blockquote blockquote {
  border-left-color: color-mix(in srgb, var(--accent) 60%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 30%, transparent);
  margin: 0.6em 0;
}

.mk-body blockquote blockquote blockquote {
  border-left-color: color-mix(in srgb, var(--accent) 40%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 15%, transparent);
}

/* 引用块中的代码和链接 */
.mk-body blockquote code {
  background: color-mix(in srgb, var(--bg-code) 60%, transparent);
}

.mk-body blockquote a {
  color: var(--accent);
}

/* -------------------- 8.6 表格 -------------------- */

/* 表格外层滚动容器（由 MarkdownPreview.vue Stage 4 注入） */
.mk-body .table-wrapper {
  width: 100%;
  overflow-x: auto;
  margin: 1.2em 0;
}

.mk-body table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95em;
}

/* 表头 */
.mk-body thead th {
  background: var(--bg-tertiary);
  font-weight: 600;
  text-align: left;
  padding: 10px 14px;
  border: 1px solid var(--border);
  color: var(--text-primary);
}

/* 表体单元格 */
.mk-body tbody td {
  padding: 10px 14px;
  border: 1px solid var(--border);
  color: var(--text-primary);
}

/* 交替行背景（斑马纹） */
.mk-body tbody tr:nth-child(even) {
  background: var(--bg-secondary);
}

.mk-body tbody tr:nth-child(odd) {
  background: transparent;
}

/* 悬浮行高亮 */
.mk-body tbody tr:hover {
  background: color-mix(in srgb, var(--accent) 5%, var(--bg-secondary));
}

/* -------------------- 8.7 分隔线 -------------------- */

.mk-body hr {
  border: none;
  height: 2px;
  background: var(--border);
  margin: 2em 0;
}

/* -------------------- 8.8 链接 -------------------- */

.mk-body a {
  color: var(--accent);
  text-decoration: none;
  transition: color 0.15s, text-decoration 0.15s;
}

.mk-body a:hover {
  text-decoration: underline;
}

/* 外部链接：右上角小图标 ↗ */
.mk-body a.external-link::after {
  content: '';
  display: inline-block;
  width: 0.7em;
  height: 0.7em;
  margin-left: 0.2em;
  margin-bottom: 0.15em;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%233B82F6' stroke-width='2.5'%3E%3Cpath d='M7 17L17 7M17 7H7M17 7V17'/%3E%3C/svg%3E");
  background-size: contain;
  background-repeat: no-repeat;
  vertical-align: middle;
}

[data-theme="dark"] .mk-body a.external-link::after {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2358A6FF' stroke-width='2.5'%3E%3Cpath d='M7 17L17 7M17 7H7M17 7V17'/%3E%3C/svg%3E");
}

/* 锚点链接 */
.mk-body a[href^="#"] {
  scroll-behavior: smooth;
}

/* -------------------- 8.9 图片 -------------------- */

.mk-body img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  display: block;
  margin: 1.2em auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  cursor: zoom-in;
}

.mk-body img:hover {
  transform: scale(1.02);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

/* 图片标题（alt 文字） */
.mk-body .image-wrapper {
  margin: 1.2em 0;
  text-align: center;
}

.mk-body .image-wrapper img {
  margin: 0 auto;
}

.mk-body .image-caption {
  font-size: 0.85em;
  color: var(--text-secondary);
  margin-top: 0.5em;
  font-style: italic;
}

/* 图片加载失败占位 */
.mk-body img.img-error {
  cursor: default;
  transform: none !important;
  box-shadow: none !important;
  padding: 20px;
  background: var(--bg-secondary);
  border: 1px dashed var(--border);
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* -------------------- 8.10 Mermaid 图表 -------------------- */

.mk-body .mermaid {
  display: flex;
  justify-content: center;
  padding: 1.5em;
  margin: 1.2em 0;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border);
  overflow-x: auto;
}

.mk-body .mermaid svg {
  max-width: 100%;
  height: auto;
}

/* Mermaid 渲染失败错误提示 */
.mk-body .mermaid-error {
  border: 1px solid var(--accent-red);
  background: color-mix(in srgb, var(--accent-red) 8%, var(--bg-secondary));
  padding: 1em 1.2em;
  border-radius: 8px;
  font-family: var(--font-mono);
  font-size: 13px;
}

.mk-body .mermaid-error .error-title {
  color: var(--accent-red);
  font-weight: 600;
  margin-bottom: 0.5em;
}

.mk-body .mermaid-error pre {
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  color: var(--text-secondary);
}

/* -------------------- 8.11 KaTeX 公式 -------------------- */

/* 行内公式 */
.mk-body .katex {
  font-size: 1em;
  line-height: 1.2;
}

/* 块级公式 */
.mk-body .katex-display {
  margin: 1.5em 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.mk-body .katex-display .katex {
  display: block;
  text-align: center;
}

/* KaTeX 渲染失败 */
.mk-body .katex-error {
  color: var(--accent-red);
  font-family: var(--font-mono);
  font-size: 0.95em;
  padding: 0.5em;
  border: 1px dashed var(--accent-red);
  border-radius: 4px;
  display: inline-block;
}

/* -------------------- 8.12 ASCII 框图特殊处理 -------------------- */

/* 无语言标记的代码块（可能是 ASCII 框图） */
.mk-body pre:has(> code.language-plaintext),
.mk-body pre:has(> code:not([class*="language-"])) {
  line-height: 1.2;
}

.mk-body pre code.language-plaintext,
.mk-body pre code:not([class*="language-"]) {
  line-height: 1.2;
  letter-spacing: 0;
  font-variant-ligatures: none;
  white-space: pre;
}

/* 等宽字体严格渲染 */
.mk-body pre,
.mk-body pre code {
  font-family: var(--font-mono);
  letter-spacing: 0;
  font-variant-ligatures: none;
}

/* -------------------- 嵌套元素通用处理 -------------------- */

/* 标题内的代码 */
.mk-body h1 code,
.mk-body h2 code,
.mk-body h3 code,
.mk-body h4 code,
.mk-body h5 code,
.mk-body h6 code {
  font-size: 0.85em;
  vertical-align: middle;
}

/* 表格内的行内元素（详见 F06-04） */
.mk-body table code {
  white-space: nowrap;
}

/* 确保图片和块级元素不被溢出 */
.mk-body pre,
.mk-body .code-block-wrapper,
.mk-body .mermaid,
.mk-body .katex-display,
.mk-body table {
  max-width: 100%;
}

/* 打印样式 */
@media print {
  .mk-body {
    max-width: none;
    padding: 0;
    color: #000;
  }

  .mk-body h2 {
    border-left-color: #333;
  }

  .mk-body a {
    color: #333;
    text-decoration: underline;
  }

  .mk-body a.external-link::after {
    display: none;
  }

  .mk-body img {
    box-shadow: none;
    page-break-inside: avoid;
  }
}
```

### 2.4 CSS 变量定义（主题系统）

```css
/* src/assets/styles/themes/light.css */
:root,
html[data-theme="light"] {
  --bg-primary: #FFFFFF;
  --bg-secondary: #F8F9FA;
  --bg-tertiary: #F1F3F5;
  --bg-code: #F6F8FA;
  --text-primary: #1A1A2E;
  --text-secondary: #6B7280;
  --text-muted: #9CA3AF;
  --border: #E5E7EB;
  --accent: #3B82F6;
  --accent-red: #EF4444;
  --accent-green: #10B981;
  --accent-amber: #F59E0B;
  --font-body: 'LXGW WenKai', 'Noto Serif SC', Georgia, serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace;
}

/* src/assets/styles/themes/dark.css */
html[data-theme="dark"] {
  --bg-primary: #0D1117;
  --bg-secondary: #161B22;
  --bg-tertiary: #21262D;
  --bg-code: #1C2128;
  --text-primary: #E6EDF3;
  --text-secondary: #8B949E;
  --text-muted: #484F58;
  --border: #30363D;
  --accent: #58A6FF;
  --accent-red: #F85149;
  --accent-green: #3FB950;
  --accent-amber: #D29922;
  --font-body: 'LXGW WenKai', 'Noto Serif SC', Georgia, serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace;
}
```

### 2.5 全局样式入口

```css
/* src/assets/styles/global.css */
@import './themes/light.css';
@import './themes/dark.css';
@import './markdown/base.css';
/* 后续追加: @import './markdown/code.css'; */
/* 后续追加: @import './markdown/table.css'; */
/* 后续追加: @import './markdown/mermaid.css'; */

@tailwind base;
@tailwind components;
@tailwind utilities;
```

## 3. 接口定义

### 3.1 无 JS 接口

本特性为纯 CSS 文件，无 JavaScript 接口。样式通过 CSS 类名自动应用：

| 类名 | 用途 |
|------|------|
| `.mk-body` | Markdown 渲染内容根容器 |
| `.header-anchor` | 标题锚点链接（markdown-it-anchor 生成） |
| `.task-list-item` | 任务列表项（markdown-it-task-lists 生成） |
| `.external-link` | 外部链接（F06-01 link_open 规则添加） |
| `.mermaid` | Mermaid 图表容器（F06-01 fence 规则生成） |
| `.mermaid-error` | Mermaid 渲染失败提示（F06-07 注入） |
| `.katex` / `.katex-display` | KaTeX 公式容器 |
| `.katex-error` | KaTeX 渲染失败提示（F06-08 注入） |
| `.code-block-wrapper` | 增强代码块容器（F06-01 fence 规则生成） |

### 3.2 主题切换接口（由 F08-02 提供）

```typescript
// useTheme.ts 控制 html 元素的 data-theme 属性
document.documentElement.setAttribute('data-theme', 'light' | 'dark');
```

## 4. 数据结构

本特性无独立数据结构，样式与 HTML 结构紧密耦合。关键 DOM 结构映射：

### 4.1 标题层级结构

```html
<article class="mk-body">
  <h1 id="指针基础">指针基础</h1>          <!-- H1: 底部边框 -->
  <h2 id="注意事项">注意事项</h2>            <!-- H2: 红色左竖线 -->
  <h3 id="常见错误">常见错误</h3>            <!-- H3: 纯文本 -->
</article>
```

### 4.2 引用块嵌套结构

```html
<blockquote>                                 <!-- 一级：蓝色竖线 -->
  <p>警告信息</p>
  <blockquote>                               <!-- 二级：浅色竖线 -->
    <p>嵌套引用</p>
  </blockquote>
</blockquote>
```

### 4.3 列表层级结构

```html
<ul>                                         <!-- 一级：disc -->
  <li>项目 1</li>
  <li>项目 2
    <ul>                                     <!-- 二级：circle -->
      <li>子项目
        <ul>                                 <!-- 三级：square -->
          <li>孙项目</li>
        </ul>
      </li>
    </ul>
  </li>
</ul>
```

## 5. 依赖关系

### 5.1 依赖的上游模块

| 模块 | 特性 | 说明 |
|------|------|------|
| F01-02 | 前端基础配置 | Vite CSS 导入、Tailwind 基础设施 |
| F06-01 | markdown-it 核心配置 | 自定义规则输出的 HTML 类名需与 base.css 匹配 |
| F08-01 | CSS 变量主题系统 | 定义 --bg-primary / --text-primary 等变量 |

### 5.2 下游依赖本模块

| 模块 | 特性 | 说明 |
|------|------|------|
| F06-03 | 代码块渲染 | code.css 补充代码块样式，与 base.css 的 pre/code 基础样式配合 |
| F06-04 | 表格渲染 | table.css 补充表格样式 |
| F06-05 | 图片处理 | 图片样式由 base.css 定义，lightbox 组件叠加交互 |
| F06-06 | 预览主组件 | MarkdownPreview.vue 注入 .mk-body 容器类 |
| F06-07 | Mermaid 图表 | `.mermaid` 容器样式 |
| F06-08 | KaTeX 公式 | `.katex` / `.katex-display` 样式 |
| F08-02 | 主题切换 | 切换 `data-theme` 属性触发变量值变化 |

### 5.3 无额外 npm 依赖

样式纯 CSS 实现，依赖已由 F01-02（Tailwind）和 F08-01（CSS 变量）覆盖。

## 6. 测试要点

### 6.1 视觉回归测试

使用浏览器 DevTools 或 Playwright 截图对比，验证以下元素在亮/暗主题下的渲染：

| 测试项 | 验证内容 |
|--------|---------|
| H1 样式 | 字号 2.2em、底部 2px 边框、margin-top 2.5em |
| H2 样式 | 字号 1.7em、左侧 4px 红色竖线、padding-left 12px |
| H6 样式 | text-muted 颜色、uppercase、letter-spacing |
| 段落间距 | margin-bottom 1.2em |
| 加粗文字 | font-weight 600、颜色略深 |
| 行内代码 | bg-code 背景、圆角 3px、accent-red 颜色 |
| 无序列表层级 | disc → circle → square → disc |
| 有序列表层级 | decimal → lower-alpha → lower-roman |
| 任务列表 | checkbox 样式、accent 色填充 |
| 引用块 | 蓝色竖线、半透明背景、圆角右侧 |
| 嵌套引用 | 竖线颜色渐变变浅 |
| 链接悬浮 | 悬浮出现下划线 |
| 外部链接图标 | ::after 伪元素显示 ↗ |
| 分隔线 | 2px 高度、border 颜色、2em margin |
| 图片 | max-width 100%、圆角 6px、阴影、悬浮放大 |
| Mermaid 容器 | 居中、padding 1.5em、背景色 |
| KaTeX 块级 | 居中、margin 1.5em |
| ASCII 框图 | line-height 1.2、letter-spacing 0、禁用连字 |

### 6.2 主题切换测试

```typescript
// 测试主题切换时所有元素颜色正确变化
describe('主题切换', () => {
  it('亮色主题下 H2 边框应为 #EF4444', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const h2 = document.querySelector('.mk-body h2');
    expect(getComputedStyle(h2!).borderLeftColor).toBe('rgb(239, 68, 68)');
  });

  it('暗色主题下 H2 边框应为 #F85149', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const h2 = document.querySelector('.mk-body h2');
    expect(getComputedStyle(h2!).borderLeftColor).toBe('rgb(248, 81, 73)');
  });
});
```

### 6.3 浏览器兼容性测试

| 特性 | 兼容性要求 | 降级方案 |
|------|-----------|---------|
| `color-mix()` | Chrome 111+, Safari 16.2+, Firefox 113+ | 使用半透明 rgba 回退 |
| `:has()` | Chrome 105+, Safari 15.4+ | 为 ASCII 框图添加显式类名 |
| CSS 变量 | 现代浏览器 | 不支持则放弃旧浏览器 |
| `scroll-margin-top` | 现代浏览器 | 不影响功能 |

### 6.4 性能测试

| 指标 | 目标 | 测试方法 |
|------|------|---------|
| 样式计算时间 | < 5ms（1000 个元素） | DevTools Performance 面板 |
| CSS 文件体积 | < 15KB（gzip） | `gzip -c base.css \| wc -c` |
| 重绘开销 | 无大面积重绘 | 主题切换时仅变量值变化 |
