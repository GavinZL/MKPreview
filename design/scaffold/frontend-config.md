# F01-02 前端基础配置

## 1. 功能描述与目标

本特性完成 MKPreview 前端开发环境的全套基础配置，包括构建工具（Vite）、CSS 框架（Tailwind CSS）、类型系统（TypeScript 严格模式）、代码规范（ESLint/Prettier）以及项目公共类型定义。目标是建立一套类型安全、编码规范统一、主题系统可扩展的前端工程基础，为后续所有前端组件和渲染层开发提供标准化开发环境。

**达成目标**：
- `vite.config.ts` 配置完成，支持 `@/` 路径别名指向 `src/`、Vue SFC 编译、开发服务器代理
- Tailwind CSS 正确集成，支持亮/暗主题切换的 `class` 策略
- TypeScript 严格模式启用，所有源码文件类型检查通过
- ESLint + Prettier 配置完成，`npm run lint` / `npm run format` 可正常执行
- `src/types/` 目录下定义所有跨模块共享的基础类型（FileTreeNode、SearchResult、Settings 等）
- `src/assets/styles/global.css` 建立主题 CSS 变量基础设施，支持 `data-theme` 属性切换

## 2. 技术实现方案

### 2.1 需要创建的文件清单

| 文件路径 | 说明 |
|---------|------|
| `vite.config.ts` | Vite 构建配置（路径别名、Vue 插件、开发服务器） |
| `tailwind.config.ts` | Tailwind CSS 配置（暗色模式、自定义颜色映射） |
| `postcss.config.js` | PostCSS 配置（Tailwind + Autoprefixer） |
| `tsconfig.json` | TypeScript 编译器配置（严格模式、路径映射） |
| `.eslintrc.cjs` | ESLint 规则配置（Vue + TypeScript） |
| `.prettierrc` | Prettier 格式化配置 |
| `env.d.ts` | Vite 客户端环境类型声明 |
| `src/assets/styles/global.css` | 全局样式：Tailwind 指令 + CSS 变量主题基础设施 |
| `src/types/fileTree.ts` | 文件树相关类型定义 |
| `src/types/search.ts` | 搜索结果相关类型定义 |
| `src/types/settings.ts` | 用户配置相关类型定义 |
| `src/types/index.ts` | 类型统一导出入口 |

### 2.2 各配置文件详细内容

#### 2.2.1 `vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // Tauri 开发服务器配置：使用固定端口，禁用自动打开浏览器
  server: {
    port: 5173,
    strictPort: true,
    open: false,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  // 生产构建配置
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // 将大型依赖拆分为独立 chunk，优化加载性能
          vendor: ['vue', 'pinia'],
          markdown: ['markdown-it', 'highlight.js'],
          // Phase 2: editor: ['codemirror', '@codemirror/view', '@codemirror/state'],
          // Phase 2: charts: ['mermaid'],
          // Phase 2: math: ['katex'],
        },
      },
    },
  },
})
```

#### 2.2.2 `tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class', // 通过 <html class="dark"> 切换暗色模式
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    extend: {
      // 使用 CSS 变量映射 Tailwind 颜色，实现主题切换
      colors: {
        // 背景色
        'bg-primary': 'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'bg-tertiary': 'var(--bg-tertiary)',
        'bg-code': 'var(--bg-code)',
        // 文字色
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        // 边框色
        'border-color': 'var(--border)',
        // 强调色
        accent: 'var(--accent)',
        'accent-red': 'var(--accent-red)',
        'accent-green': 'var(--accent-green)',
        'accent-amber': 'var(--accent-amber)',
      },
      fontFamily: {
        ui: ['var(--font-ui)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        body: ['var(--font-body)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'Menlo', 'monospace'],
      },
      fontSize: {
        'ui-sm': ['12px', { lineHeight: '1.5' }],
        'ui-base': ['13px', { lineHeight: '1.5' }],
        'body-base': ['16px', { lineHeight: '1.8' }],
        'code-base': ['14px', { lineHeight: '1.6' }],
      },
      spacing: {
        'toolbar': '40px',
        'tabbar': '36px',
        'statusbar': '24px',
      },
      borderRadius: {
        'ui': '6px',
        'code': '8px',
      },
      transitionDuration: {
        'theme': '300ms',
        'panel': '200ms',
        'mode': '150ms',
      },
    },
  },
  plugins: [],
}

export default config
```

> **关键设计决策**：
> - `darkMode: 'class'` — 与 F08-01 `theme-system` 配合使用。主题切换通过给 `<html>` 元素添加/移除 `dark` 类实现，而不是依赖 `prefers-color-scheme` 媒体查询。这样可以支持"跟随系统 / 强制亮色 / 强制暗色"三种模式。
> - 颜色系统全部映射到 CSS 自定义属性（CSS Variables）— 保证 `.mk-body` Markdown 渲染区和 Tailwind UI 组件使用同一套语义化颜色 Token。

#### 2.2.3 `postcss.config.js`

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

#### 2.2.4 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "types": ["vite/client", "node"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue", "env.d.ts"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

> **严格模式配置说明**：
> - `strict: true` — 启用所有严格类型检查选项
> - `noUnusedLocals` / `noUnusedParameters` — 禁止未使用的变量和参数，保持代码整洁
> - `noFallthroughCasesInSwitch` — switch case 必须显式 break/return，防范逻辑错误
> - `isolatedModules: true` — 确保每个文件可独立编译（与 Vite 的 esbuild 兼容）

#### 2.2.5 `tsconfig.node.json`

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts", "tailwind.config.ts"]
}
```

#### 2.2.6 `.eslintrc.cjs`

```javascript
/* eslint-env node */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
    '@vue/eslint-config-typescript',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // Vue 模板风格
    'vue/multi-word-component-names': 'off', // 允许单字组件名（如 Toolbar.vue）
    'vue/require-default-prop': 'off',
    'vue/no-v-html': 'off', // Markdown 渲染需要 v-html，由渲染安全策略管控
    
    // TypeScript 风格
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    
    // 通用代码风格
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'eqeqeq': ['error', 'always'],
  },
  ignorePatterns: ['dist/', 'src-tauri/target/'],
}
```

#### 2.2.7 `.prettierrc`

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "avoid",
  "endOfLine": "lf",
  "vueIndentScriptAndStyle": false,
  "htmlWhitespaceSensitivity": "strict"
}
```

> **格式规范说明**：
> - `semi: false` — 省略分号（Vue 3 / Pinia 官方风格）
> - `singleQuote: true` — 使用单引号
> - `printWidth: 100` — 行宽限制 100 字符（比默认 80 更宽松，适合宽屏）
> - `htmlWhitespaceSensitivity: strict` — Vue 模板中保持空格精确控制

#### 2.2.8 `env.d.ts`

```typescript
/// <reference types="vite/client" />

// Tauri 环境变量声明（构建时由 Tauri CLI 注入）
declare const __TAURI_PLATFORM__: string

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
```

#### 2.2.9 `src/assets/styles/global.css`

```css
/* ===== Tailwind 指令 ===== */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ===== 全局 CSS 变量 — 主题系统基础设施 ===== */
/* 
  亮色主题为默认，暗色主题通过 [data-theme="dark"] 覆盖。
  F08-01 theme-system 将在此基础上扩展为完整主题文件。
*/

:root {
  /* Light Theme (默认) */
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

  /* 字体变量 */
  --font-ui: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-body: 'Noto Serif SC', Georgia, serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', Menlo, monospace;

  /* 尺寸变量 */
  --sidebar-width: 260px;
  --toolbar-height: 40px;
  --tabbar-height: 36px;
  --statusbar-height: 24px;
  --radius: 6px;
}

/* Dark Theme */
[data-theme="dark"] {
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
}

/* ===== 基础样式重置 ===== */
@layer base {
  html {
    height: 100%;
    font-family: var(--font-ui);
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-primary);
    background: var(--bg-primary);
    /* 主题切换过渡 */
    transition: color 300ms ease, background-color 300ms ease;
  }

  body {
    height: 100%;
    margin: 0;
    overflow: hidden;
  }

  #app {
    height: 100%;
  }

  /* 全局滚动条样式 */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: var(--text-muted);
    border-radius: 4px;
    opacity: 0.3;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--text-secondary);
  }
}

/* ===== 工具类 ===== */
@layer utilities {
  .transition-theme {
    transition: color 300ms ease, background-color 300ms ease, border-color 300ms ease;
  }

  .fade-in {
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
}
```

> **与 F08-01 theme-system 的分工**：
> - F01-02 建立全局 CSS 变量基础设施（`:root` 和 `[data-theme="dark"]` 的变量定义）
> - F08-01 将拆分为独立文件 `themes/light.css` 和 `themes/dark.css`，并增加字体配置等高级主题功能
> - F01-02 阶段的 `global.css` 保证所有组件在主题系统完成前即可使用变量渲染

### 2.3 公共类型定义

#### 2.3.1 `src/types/fileTree.ts`

```typescript
/**
 * 文件树节点 — Rust 后端 scan_directory 返回的数据结构前端镜像
 * 对应 Rust 结构: src-tauri/src/models/file_tree.rs#FileTreeNode
 */
export interface FileTreeNode {
  /** 文件或目录名 */
  name: string
  /** 绝对路径 */
  path: string
  /** 是否为目录 */
  isDir: boolean
  /** 子节点（仅目录） */
  children?: FileTreeNode[]
  /** 目录下递归 .md 文件总数（仅目录） */
  fileCount?: number
}

/**
 * 文件元信息 — 对应 Rust 结构: FileMeta
 */
export interface FileMeta {
  path: string
  /** 文件大小（字节） */
  size: number
  /** 最后修改时间戳（毫秒） */
  modified: number
  /** 创建时间戳（毫秒） */
  created: number
}

/**
 * 文件树展开状态映射
 * key: 目录绝对路径
 * value: 是否展开
 */
export type TreeExpandedState = Record<string, boolean>

/**
 * 文件系统变更事件 — 对应 Rust 事件: fs:change
 */
export type FsChangeType = 'create' | 'delete' | 'modify' | 'rename'

export interface FsChangeEvent {
  type: FsChangeType
  path: string
  /** rename 事件的新路径 */
  newPath?: string
}
```

#### 2.3.2 `src/types/search.ts`

```typescript
/**
 * 搜索结果项 — 对应 Rust 结构: src-tauri/src/models/search_result.rs#SearchResult
 */
export interface SearchResult {
  /** 文件绝对路径 */
  path: string
  /** 匹配行号 */
  lineNumber: number
  /** 匹配上下文摘要（包含高亮标记） */
  context: string
}

/**
 * 搜索过滤模式
 */
export type SearchFilter = 'all' | 'filename' | 'content'

/**
 * 搜索请求参数
 */
export interface SearchQuery {
  /** 搜索目录根路径 */
  dir: string
  /** 搜索关键词 */
  query: string
  /** 过滤模式 */
  filter: SearchFilter
}
```

#### 2.3.3 `src/types/settings.ts`

```typescript
/**
 * 应用主题模式
 */
export type ThemeMode = 'system' | 'light' | 'dark'

/**
 * 显示模式
 */
export type ViewMode = 'preview' | 'source' | 'split'

/**
 * 用户设置 — 对应 Rust 结构: src-tauri/src/models/settings.rs#Settings
 */
export interface Settings {
  /** 主题偏好 */
  theme: ThemeMode
  /** Markdown 正文字体 */
  fontBody: string
  /** 代码字体 */
  fontCode: string
  /** 正文字号（px） */
  fontSize: number
  /** 是否启用自动保存 */
  autoSave: boolean
  /** 自动保存间隔（秒） */
  autoSaveInterval: number
  /** 编辑器是否显示行号 */
  showLineNumbers: boolean
  /** 最近打开的目录列表 */
  recentDirs: string[]
}

/**
 * 默认设置
 */
export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontBody: 'Noto Serif SC',
  fontCode: 'JetBrains Mono',
  fontSize: 16,
  autoSave: true,
  autoSaveInterval: 3,
  showLineNumbers: true,
  recentDirs: [],
}
```

#### 2.3.4 `src/types/index.ts`

```typescript
// 统一导出所有类型，便于跨模块引用
export * from './fileTree'
export * from './search'
export * from './settings'
```

## 3. 接口定义

### 3.1 类型导出规范

所有类型定义通过 `src/types/index.ts` 统一导出，业务模块引用时使用：

```typescript
import { FileTreeNode, Settings, SearchResult } from '@/types'
```

### 3.2 CSS 变量接口（设计与组件间约定）

全局 CSS 变量作为前端组件与主题系统之间的"隐式接口"，所有组件应使用这些变量而非硬编码颜色值：

| CSS 变量 | 语义 | 使用场景 |
|---------|------|---------|
| `--bg-primary` | 主背景色 | 内容区、弹窗背景 |
| `--bg-secondary` | 次级背景色 | 文件树、侧边栏 |
| `--bg-tertiary` | 三级背景色 | 工具栏、状态栏、代码块头部 |
| `--bg-code` | 代码块背景 | `pre/code` 元素 |
| `--text-primary` | 主要文字 | 正文、标题 |
| `--text-secondary` | 次要文字 | 描述、辅助信息 |
| `--text-muted` | 弱化文字 | 占位符、行号、禁用态 |
| `--border` | 边框/分割线 | 面板边界、表格边框 |
| `--accent` | 强调色 | 链接、选中态、主按钮 |
| `--accent-red` | 红色强调 | H2 左边框、警告、行内代码 |
| `--accent-green` | 绿色强调 | 成功、代码新增 |
| `--accent-amber` | 琥珀色强调 | 提醒、文件夹图标 |

### 3.3 Tailwind 自定义类映射

Tailwind 配置将上述 CSS 变量映射为工具类：

```html
<!-- 使用 Tailwind 工具类引用 CSS 变量 -->
<div class="bg-bg-primary text-text-primary border-border-color">
  <span class="text-accent">链接文字</span>
</div>
```

## 4. 数据结构

本特性定义的所有数据结构已在第 2.3 节完整展示，此处汇总核心类型的关系图：

```
FileTreeNode
├── name: string
├── path: string
├── isDir: boolean
├── children?: FileTreeNode[]
└── fileCount?: number

SearchResult
├── path: string
├── lineNumber: number
└── context: string

Settings
├── theme: 'system' | 'light' | 'dark'
├── fontBody: string
├── fontCode: string
├── fontSize: number
├── autoSave: boolean
├── autoSaveInterval: number
├── showLineNumbers: boolean
└── recentDirs: string[]
```

### 4.1 类型与 Rust 后端的对齐

| TypeScript 类型 | Rust 结构 | 序列化方式 |
|----------------|-----------|-----------|
| `FileTreeNode` | `models::file_tree::FileTreeNode` | serde_json (snake_case ↔ camelCase) |
| `FileMeta` | `models::file_tree::FileMeta` | serde_json |
| `SearchResult` | `models::search_result::SearchResult` | serde_json |
| `Settings` | `models::settings::Settings` | serde_json |

> **命名转换约定**：Rust 使用 `snake_case`，TypeScript 使用 `camelCase`。Tauri 的 serde 序列化自动处理字段名映射，但需确保两边字段语义一致。

## 5. 依赖关系

### 5.1 前置依赖

| 特性编号 | 特性名 | 说明 |
|---------|--------|------|
| F01-01 | Tauri + Vue 项目初始化 | 本特性依赖项目目录结构和基础 npm 依赖已就绪 |

### 5.2 被哪些特性依赖

| 特性编号 | 特性名 | 说明 |
|---------|--------|------|
| F03-01 | CSS Grid 整体布局 | 依赖 Tailwind CSS 工具类和 CSS 变量 |
| F03-02 | 工具栏组件 | 依赖主题 CSS 变量和 Tailwind 颜色工具类 |
| F04-01 | 文件树核心组件 | 依赖 `FileTreeNode` 类型定义 |
| F06-01 | markdown-it 核心配置 | 依赖 `global.css` 中的变量基础设施 |
| F06-02 | 基础元素渲染样式 | 依赖 CSS 变量定义和 Tailwind 自定义配置 |
| F07-01 | CodeMirror 只读查看器 | 依赖主题 CSS 变量 |
| F08-01 | CSS 变量主题系统 | 在 `global.css` 基础上扩展为完整主题系统 |
| F08-02 | 主题切换功能 | 依赖 `[data-theme]` 属性切换机制 |

### 5.3 第三方库

| Package | 版本 | 用途 |
|---------|------|------|
| `vite` | 5.0.x | 构建工具、开发服务器 |
| `@vitejs/plugin-vue` | 5.0.x | Vue SFC 编译支持 |
| `tailwindcss` | 3.4.x | CSS 工具类框架 |
| `postcss` | 8.4.x | CSS 后处理 |
| `autoprefixer` | 10.4.x | 自动浏览器前缀 |
| `typescript` | 5.3.x | 类型系统 |
| `vue-tsc` | 1.8.x | Vue TypeScript 类型检查 |
| `eslint` | 8.57.x | 代码规范检查 |
| `prettier` | 3.2.x | 代码格式化 |
| `eslint-plugin-vue` | 9.20.x | Vue ESLint 规则 |
| `@vue/eslint-config-typescript` | 12.0.x | Vue + TS ESLint 配置 |

## 6. 测试要点

### 6.1 配置验证

- [ ] `vite.config.ts` 配置正确：`npm run dev` 启动开发服务器，端口 5173，自动打开关闭
- [ ] 路径别名 `@/` 工作正常：在任意 `.ts` / `.vue` 文件中 `import { ... } from '@/types'` 编译通过
- [ ] Vite 生产构建成功：`npm run build` 生成 `dist/` 目录，无编译错误
- [ ] 代码分割生效：`dist/assets/` 下存在 `vendor-*.js`、`markdown-*.js` 等分块文件

### 6.2 TypeScript 严格模式

- [ ] `npx vue-tsc --noEmit` 执行通过，零类型错误
- [ ] 尝试声明 `let x: any` 触发 `@typescript-eslint/no-explicit-any` warning
- [ ] 未使用变量触发 `noUnusedLocals` 编译错误

### 6.3 Tailwind CSS

- [ ] 开发模式下，任意组件中使用 `class="bg-bg-primary text-accent"` 正确应用 CSS 变量颜色
- [ ] 暗色模式切换：在 `<html>` 上切换 `dark` 类，`bg-bg-primary` 从 `#FFFFFF` 变为 `#0D1117`
- [ ] Tailwind 自定义字体类 `font-ui` / `font-body` / `font-mono` 正确应用
- [ ] 全局滚动条样式在所有面板中一致生效

### 6.4 ESLint / Prettier

- [ ] `npm run lint` 扫描整个 `src/` 目录，无未处理的错误
- [ ] `npm run format` 格式化所有 `src/**/*.{ts,vue,css}` 文件
- [ ] Prettier 配置生效：保存时自动移除分号、转换为单引号

### 6.5 类型定义完整性

- [ ] `FileTreeNode`、`FileMeta`、`SearchResult`、`Settings` 类型定义与 Rust 后端结构语义一致
- [ ] `import { ... } from '@/types'` 可从任意模块正确导入
- [ ] `DEFAULT_SETTINGS` 对象可作为 Pinia Store 的初始状态使用

### 6.6 主题基础设施

- [ ] `global.css` 中的 CSS 变量在 `:root`（亮色）和 `[data-theme="dark"]`（暗色）下取值正确
- [ ] `html` 元素上 `data-theme` 属性切换时，所有使用 CSS 变量的元素颜色平滑过渡 300ms
- [ ] Tailwind `darkMode: 'class'` 配置与 `[data-theme="dark"]` 配合使用有效
