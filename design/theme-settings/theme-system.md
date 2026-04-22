# F08-01 CSS 变量主题系统 [MVP]

## 1. 功能描述与目标

**功能描述**：实现完整的 CSS 变量（CSS Custom Properties）主题系统，定义应用级和 Markdown 渲染级的所有语义化颜色 Token 和字体变量，支持亮色（Light）和暗色（Dark）两套主题。

**目标**：
- 定义完整的语义化 CSS 变量体系（背景、文字、边框、强调色等）
- 亮色和暗色两套主题变量完整覆盖 PRD 7.3 所有 Token
- 字体系统完整定义 PRD 7.4 所有字体族、字号、行高
- 通过 `data-theme` 属性切换主题，所有组件自动响应
- CSS 变量与 Tailwind CSS 集成，支持 `bg-[var(--bg-primary)]` 等用法
- Markdown 渲染样式封装在 `.mk-body` 下，避免与应用 UI 样式冲突

**PRD 关联**：FR-007.1 ~ FR-007.7（主题与外观）、PRD 7.3 颜色系统、PRD 7.4 字体系统

---

## 2. 技术实现方案

### 2.1 主题文件结构

```
src/assets/styles/
├── global.css              # 全局样式 + Tailwind 引入 + 主题基础设施
├── themes/
│   ├── light.css           # 亮色主题变量
│   └── dark.css            # 暗色主题变量
└── markdown/
    ├── base.css            # Markdown 基础样式 (.mk-body)
    ├── code.css            # 代码块样式
    ├── table.css           # 表格样式
    └── mermaid.css         # Mermaid 图表样式
```

### 2.2 主题切换基础设施

```css
/* global.css */

/* 1. Tailwind CSS */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* 2. 主题变量默认（跟随系统，JS 会覆盖） */
:root {
  /* 默认加载亮色主题 */
}

/* 3. 亮色主题 */
@import './themes/light.css';

/* 4. 暗色主题（通过 data-theme="dark" 激活） */
[data-theme="dark"] {
  @import './themes/dark.css';
}

/* 5. 全局过渡动画 */
* {
  transition: background-color 300ms ease,
              color 300ms ease,
              border-color 300ms ease;
}

/* 排除不希望有过渡的元素 */
.cm-editor *,
.pre *,
.scrollbar * {
  transition: none;
}

/* 6. 基础重置 */
html, body, #app {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

body {
  font-family: var(--font-ui);
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-primary);
  background: var(--bg-primary);
}
```

### 2.3 亮色主题完整变量

```css
/* themes/light.css */
[data-theme="light"],
:root:not([data-theme="dark"]) {
  /* ========== 背景色 ========== */
  --bg-primary: #FFFFFF;
  --bg-secondary: #F8F9FA;
  --bg-tertiary: #F1F3F5;
  --bg-code: #F6F8FA;
  --bg-overlay: rgba(0, 0, 0, 0.5);
  --bg-hover: rgba(59, 130, 246, 0.08);
  --bg-active: rgba(59, 130, 246, 0.12);

  /* ========== 文字色 ========== */
  --text-primary: #1A1A2E;
  --text-secondary: #6B7280;
  --text-muted: #9CA3AF;
  --text-inverse: #FFFFFF;
  --text-link: #3B82F6;
  --text-link-hover: #2563EB;

  /* ========== 边框色 ========== */
  --border: #E5E7EB;
  --border-hover: #D1D5DB;
  --border-focus: #3B82F6;
  --divider: #E5E7EB;

  /* ========== 强调色 ========== */
  --accent: #3B82F6;
  --accent-hover: #2563EB;
  --accent-red: #EF4444;
  --accent-green: #10B981;
  --accent-amber: #F59E0B;
  --accent-purple: #8B5CF6;

  /* ========== 状态色 ========== */
  --status-success: #10B981;
  --status-warning: #F59E0B;
  --status-error: #EF4444;
  --status-info: #3B82F6;

  /* ========== 阴影 ========== */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.1);

  /* ========== 字体系统 ========== */
  --font-ui: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-body: 'LXGW WenKai', 'Noto Serif SC', Georgia, 'Times New Roman', serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Consolas, monospace;

  --font-size-ui: 13px;
  --font-size-body: 16px;
  --font-size-code: 14px;
  --font-size-small: 12px;
  --font-size-caption: 11px;

  --line-height-ui: 1.5;
  --line-height-body: 1.8;
  --line-height-code: 1.6;
  --line-height-heading: 1.3;

  /* ========== 尺寸系统 ========== */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;

  /* ========== 滚动条 ========== */
  --scrollbar-track: transparent;
  --scrollbar-thumb: rgba(156, 163, 175, 0.4);
  --scrollbar-thumb-hover: rgba(107, 114, 128, 0.6);

  /* ========== Z-Index 层级 ========== */
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-modal: 300;
  --z-popover: 400;
  --z-tooltip: 500;
}
```

### 2.4 暗色主题完整变量

```css
/* themes/dark.css */
[data-theme="dark"] {
  /* ========== 背景色 ========== */
  --bg-primary: #0D1117;
  --bg-secondary: #161B22;
  --bg-tertiary: #21262D;
  --bg-code: #1C2128;
  --bg-overlay: rgba(0, 0, 0, 0.7);
  --bg-hover: rgba(88, 166, 255, 0.08);
  --bg-active: rgba(88, 166, 255, 0.12);

  /* ========== 文字色 ========== */
  --text-primary: #E6EDF3;
  --text-secondary: #8B949E;
  --text-muted: #484F58;
  --text-inverse: #0D1117;
  --text-link: #58A6FF;
  --text-link-hover: #79B8FF;

  /* ========== 边框色 ========== */
  --border: #30363D;
  --border-hover: #484F58;
  --border-focus: #58A6FF;
  --divider: #30363D;

  /* ========== 强调色 ========== */
  --accent: #58A6FF;
  --accent-hover: #79B8FF;
  --accent-red: #F85149;
  --accent-green: #3FB950;
  --accent-amber: #D29922;
  --accent-purple: #BC8CFF;

  /* ========== 状态色 ========== */
  --status-success: #3FB950;
  --status-warning: #D29922;
  --status-error: #F85149;
  --status-info: #58A6FF;

  /* ========== 阴影 ========== */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.6);

  /* 字体系统与亮色一致，不需要覆盖 */

  /* ========== 滚动条 ========== */
  --scrollbar-thumb: rgba(72, 79, 88, 0.6);
  --scrollbar-thumb-hover: rgba(139, 148, 158, 0.6);
}
```

### 2.5 Markdown 渲染样式（base.css 节选）

```css
/* markdown/base.css */

.mk-body {
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  color: var(--text-primary);
  max-width: 860px;
  margin: 0 auto;
  padding: 40px 48px;
}

/* ========== 标题系统 ========== */
.mk-body h1 {
  font-size: 2.2em;
  font-weight: 700;
  margin: 2.5em 0 1em;
  padding-bottom: 0.4em;
  border-bottom: 2px solid var(--border);
  scroll-margin-top: 80px;
}

.mk-body h2 {
  font-size: 1.7em;
  font-weight: 700;
  margin: 2em 0 0.8em;
  padding-left: 12px;
  border-left: 4px solid var(--accent-red);
  scroll-margin-top: 80px;
}

.mk-body h3 {
  font-size: 1.4em;
  font-weight: 600;
  margin: 1.8em 0 0.6em;
  scroll-margin-top: 80px;
}

.mk-body h4 {
  font-size: 1.2em;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 1.5em 0 0.5em;
}

.mk-body h5 {
  font-size: 1.05em;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 1.2em 0 0.4em;
}

.mk-body h6 {
  font-size: 1em;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 1em 0 0.4em;
}

.mk-body h1:first-child {
  margin-top: 0;
}

/* ========== 段落与行内元素 ========== */
.mk-body p {
  margin-bottom: 1.2em;
}

.mk-body strong {
  font-weight: 600;
  color: var(--text-primary);
}

.mk-body em {
  font-style: italic;
}

.mk-body del {
  text-decoration: line-through;
  color: var(--text-muted);
}

.mk-body code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--bg-code);
  padding: 2px 6px;
  border-radius: 3px;
  color: var(--accent-red);
}

/* ========== 链接 ========== */
.mk-body a {
  color: var(--text-link);
  text-decoration: none;
}

.mk-body a:hover {
  text-decoration: underline;
}

.mk-body a[href^="http"]::after {
  content: ' ↗';
  font-size: 0.8em;
  opacity: 0.6;
}

/* ========== 引用块 ========== */
.mk-body blockquote {
  margin: 1.2em 0;
  padding: 1em 1.2em;
  border-left: 4px solid var(--accent);
  background: color-mix(in srgb, var(--bg-secondary) 50%, transparent);
  border-radius: 0 6px 6px 0;
  color: var(--text-secondary);
}

.mk-body blockquote p:last-child {
  margin-bottom: 0;
}

/* ========== 分隔线 ========== */
.mk-body hr {
  border: none;
  height: 2px;
  background: var(--border);
  margin: 2em 0;
}

/* ========== 图片 ========== */
.mk-body img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  display: block;
  margin: 1.2em auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: transform 300ms ease;
}

.mk-body img:hover {
  transform: scale(1.02);
}

/* ========== Mermaid 图表容器 ========== */
.mk-body .mermaid {
  display: flex;
  justify-content: center;
  padding: 1.5em;
  margin: 1.2em 0;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border);
}
```

### 2.6 Tailwind CSS 配置集成

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 映射 CSS 变量到 Tailwind 颜色名
        'mk-bg': {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
          code: 'var(--bg-code)',
        },
        'mk-text': {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        'mk-accent': {
          DEFAULT: 'var(--accent)',
          red: 'var(--accent-red)',
          green: 'var(--accent-green)',
          amber: 'var(--accent-amber)',
        },
        'mk-border': 'var(--border)',
      },
      fontFamily: {
        ui: 'var(--font-ui)',
        body: 'var(--font-body)',
        mono: 'var(--font-mono)',
      },
      fontSize: {
        'ui': 'var(--font-size-ui)',
        'body': 'var(--font-size-body)',
        'code': 'var(--font-size-code)',
      },
      lineHeight: {
        'ui': 'var(--line-height-ui)',
        'body': 'var(--line-height-body)',
        'code': 'var(--line-height-code)',
      },
    },
  },
  plugins: [],
}

export default config
```

---

## 3. 接口定义

### 3.1 CSS 变量命名规范

```typescript
// types/theme.ts

/** 主题名称 */
export type ThemeName = 'light' | 'dark'

/** CSS 变量名集合（用于 TypeScript 中引用） */
export const ThemeTokens = {
  // 背景
  bgPrimary: '--bg-primary',
  bgSecondary: '--bg-secondary',
  bgTertiary: '--bg-tertiary',
  bgCode: '--bg-code',

  // 文字
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  textMuted: '--text-muted',

  // 边框
  border: '--border',

  // 强调色
  accent: '--accent',
  accentRed: '--accent-red',
  accentGreen: '--accent-green',
  accentAmber: '--accent-amber',

  // 字体
  fontUi: '--font-ui',
  fontBody: '--font-body',
  fontMono: '--font-mono',

  // 字号
  fontSizeUi: '--font-size-ui',
  fontSizeBody: '--font-size-body',
  fontSizeCode: '--font-size-code',

  // 行高
  lineHeightUi: '--line-height-ui',
  lineHeightBody: '--line-height-body',
  lineHeightCode: '--line-height-code',
} as const
```

### 3.2 动态加载字体

```typescript
// lib/fontLoader.ts

const FONT_URLS = {
  'LXGW WenKai': 'https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css',
  'Noto Serif SC': 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&display=swap',
  'JetBrains Mono': 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap',
  'Fira Code': 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&display=swap',
}

export function loadFont(fontName: string): void {
  const url = FONT_URLS[fontName as keyof typeof FONT_URLS]
  if (!url) return

  // 检查是否已加载
  const existing = document.querySelector(`link[href="${url}"]`)
  if (existing) return

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = url
  document.head.appendChild(link)
}
```

---

## 4. 数据结构

### 4.1 完整颜色 Token 定义

```typescript
// types/theme.ts

/** 亮色主题颜色值 */
export const LightThemeColors = {
  bgPrimary: '#FFFFFF',
  bgSecondary: '#F8F9FA',
  bgTertiary: '#F1F3F5',
  bgCode: '#F6F8FA',
  textPrimary: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  accent: '#3B82F6',
  accentRed: '#EF4444',
  accentGreen: '#10B981',
  accentAmber: '#F59E0B',
} as const

/** 暗色主题颜色值 */
export const DarkThemeColors = {
  bgPrimary: '#0D1117',
  bgSecondary: '#161B22',
  bgTertiary: '#21262D',
  bgCode: '#1C2128',
  textPrimary: '#E6EDF3',
  textSecondary: '#8B949E',
  textMuted: '#484F58',
  border: '#30363D',
  accent: '#58A6FF',
  accentRed: '#F85149',
  accentGreen: '#3FB950',
  accentAmber: '#D29922',
} as const
```

### 4.2 字体系统定义

```typescript
// types/theme.ts

export interface FontSystem {
  ui: {
    family: string
    size: string
    lineHeight: string
  }
  body: {
    family: string
    size: string
    lineHeight: string
  }
  code: {
    family: string
    size: string
    lineHeight: string
  }
  heading: {
    family: string
    lineHeight: string
  }
}

export const DefaultFontSystem: FontSystem = {
  ui: {
    family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    size: '13px',
    lineHeight: '1.5',
  },
  body: {
    family: "'LXGW WenKai', 'Noto Serif SC', Georgia, serif",
    size: '16px',
    lineHeight: '1.8',
  },
  code: {
    family: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace",
    size: '14px',
    lineHeight: '1.6',
  },
  heading: {
    family: "'LXGW WenKai', 'Noto Serif SC', Georgia, serif",
    lineHeight: '1.3',
  },
}
```

---

## 5. 依赖关系

| 依赖模块 | 特性 | 说明 |
|---------|------|------|
| M01 | F01-02 前端基础配置 | Tailwind CSS 配置、Vite 构建 |
| 外部 | Google Fonts / CDN | 字体资源加载 |

**被依赖**：
- M03 F03-01 CSS Grid 布局（应用背景色等）
- M06 F06-02 基础元素渲染样式（Markdown 样式依赖 CSS 变量）
- M07 F07-01 CodeMirror 只读查看器（编辑器主题跟随）
- M08 F08-02 主题切换功能（切换 data-theme 属性）
- M08 F08-03 设置面板（字体配置应用）

---

## 6. 测试要点

### 6.1 视觉测试

| 测试项 | 亮色 | 暗色 |
|--------|------|------|
| 应用背景 | `#FFFFFF` | `#0D1117` |
| 文件树背景 | `#F8F9FA` | `#161B22` |
| 工具栏背景 | `#F1F3F5` | `#21262D` |
| 正文颜色 | `#1A1A2E` | `#E6EDF3` |
| H2 左边框 | `#EF4444` | `#F85149` |
| 代码块背景 | `#F6F8FA` | `#1C2128` |

### 6.2 主题切换测试

1. 切换 `data-theme="light"` → 所有颜色变量立即更新
2. 切换 `data-theme="dark"` → 所有颜色变量立即更新
3. 过渡动画：颜色变化有 300ms 渐变效果
4. CodeMirror 编辑器主题同步切换

### 6.3 Markdown 渲染测试

1. 标题样式（H1-H6）在各主题下正确显示
2. 代码块背景色与行内代码颜色正确
3. 表格斑马纹交替行颜色正确
4. 引用块左侧蓝色竖线与背景色正确
5. 链接颜色与悬浮下划线正确

### 6.4 字体加载测试

- 字体文件正确加载（网络可用时）
- 字体加载失败时正确回退到系统字体
- 自定义字体配置后正确应用
