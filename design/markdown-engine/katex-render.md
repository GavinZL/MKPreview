# F06-08 KaTeX 数学公式渲染

## 1. 功能描述与目标

本特性实现 Markdown 中数学公式的渲染，覆盖 PRD FR-004.5 的所有要求：

- **行内公式**：`$...$` 语法，与正文基线对齐
- **块级公式**：`$$...$$` 语法，居中显示
- **公式渲染失败降级**：显示原始 LaTeX 源码 + 红色错误提示
- **常用数学符号支持**：矩阵、分数、积分、上下标等
- **主题适配**：公式颜色跟随正文颜色，无需额外主题切换

## 2. 技术实现方案

### 2.1 文件位置

```
src/lib/katexConfig.ts            # KaTeX 配置 + 渲染辅助函数
```

### 2.2 实现方案选择

有两种集成方式：

**方案 A（推荐）**：通过 `markdown-it-katex` 插件在 Stage 1 直接处理
- 优点：与 markdown-it 解析流程集成，公式渲染在 HTML 生成阶段完成
- 缺点：需要额外插件依赖

**方案 B**：Stage 3 后处理，扫描 `$...$` / `$$...$$` 文本后渲染
- 优点：不依赖 markdown-it 插件
- 缺点：需要手动处理文本扫描和替换，易出错

本设计采用**方案 A**，在 F06-01 的 markdown-it 工厂函数中通过 `enableKatex` 选项启用。

### 2.3 markdown-it-katex 集成

```typescript
// src/lib/markdownIt.ts 中启用 KaTeX 的部分（Phase 2）

import katex from 'markdown-it-katex';

// 在 createMarkdownIt 函数中
if (enableKatex) {
  md.use(katex, {
    throwOnError: false,        // 不抛出异常，失败时显示原始源码
    errorColor: '#F85149',      // 错误文字颜色（暗色主题红色）
    strict: false,              // 宽松模式，容忍不标准语法
  });
}
```

### 2.4 katexConfig.ts

```typescript
// src/lib/katexConfig.ts

import katex from 'katex';

/**
 * KaTeX 渲染配置
 */
export const katexConfig = {
  throwOnError: false,
  errorColor: '#F85149',
  strict: false,
  trust: false,           // 禁止信任模式，防止 XSS
  maxSize: 500,           // 限制公式最大尺寸
  maxExpand: 1000,        // 限制宏展开次数
};

/**
 * 手动渲染 KaTeX 公式（用于后处理模式）
 * @param tex LaTeX 公式文本
 * @param displayMode 是否为块级公式
 * @returns 渲染后的 HTML 字符串
 */
export function renderKatex(tex: string, displayMode: boolean = false): string {
  try {
    return katex.renderToString(tex, {
      ...katexConfig,
      displayMode,
    });
  } catch (err) {
    console.error('[KaTeX] 渲染失败:', err);
    const errorClass = displayMode ? 'katex-display-error' : 'katex-inline-error';
    return `<span class="katex-error ${errorClass}">${escapeHtml(tex)}</span>`;
  }
}

/**
 * 后处理渲染容器内的 KaTeX 公式
 * 用于未使用 markdown-it-katex 插件的场景
 * @param container 渲染容器 DOM
 */
export function processKatexInContainer(container: HTMLElement): void {
  // 查找所有未渲染的 .katex-error 元素并尝试重新渲染
  const errorElements = container.querySelectorAll<HTMLElement>('.katex-error');

  errorElements.forEach((el) => {
    const tex = el.textContent || '';
    const isDisplay = el.classList.contains('katex-display-error');

    try {
      const html = renderKatex(tex, isDisplay);
      el.outerHTML = html;
    } catch {
      // 保持错误显示
    }
  });
}

/**
 * HTML 转义
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 加载 KaTeX CSS
 * 在 main.ts 或组件中动态加载
 */
export function loadKatexCSS(): void {
  if (document.getElementById('katex-css')) return;

  const link = document.createElement('link');
  link.id = 'katex-css';
  link.rel = 'stylesheet';
  link.href = '/katex/katex.min.css';  // 需将 CSS 文件放入 public 目录
  document.head.appendChild(link);
}
```

### 2.5 CSS 样式补充

```css
/* 已包含在 base.css 中，此处为引用说明 */

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

.mk-body .katex-display-error {
  display: block;
  text-align: center;
  margin: 1em 0;
}
```

### 2.6 Vite 配置（静态资源）

KaTeX 的字体文件需要作为静态资源提供。在 `vite.config.ts` 中配置：

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  publicDir: 'public',
  // 将 KaTeX 字体文件复制到 public/katex/ 目录
});
```

项目结构：
```
public/
└── katex/
    ├── katex.min.css
    ├── fonts/
    │   ├── KaTeX_AMS-Regular.woff2
    │   ├── KaTeX_Caligraphic-Bold.woff2
    │   └── ... (所有字体文件)
```

## 3. 接口定义

### 3.1 katexConfig.ts 导出

```typescript
// KaTeX 配置对象
export const katexConfig: KaTeXOptions;

// 手动渲染公式
export function renderKatex(tex: string, displayMode?: boolean): string;

// 后处理容器内公式
export function processKatexInContainer(container: HTMLElement): void;

// 加载 KaTeX CSS
export function loadKatexCSS(): void;
```

### 3.2 markdown-it 集成接口

```typescript
// 在 createMarkdownIt 中启用
interface MkMarkdownItOptions {
  enableKatex?: boolean;   // 默认 false，Phase 2 开启
}
```

## 4. 数据结构

### 4.1 KaTeX 渲染选项

```typescript
interface KaTeXOptions {
  throwOnError: boolean;      // 错误时是否抛出异常
  errorColor: string;         // 错误文字颜色
  strict: boolean | string;   // 严格模式
  trust: boolean;             // 信任模式（安全）
  maxSize: number;            // 最大尺寸限制
  maxExpand: number;          // 宏展开次数限制
  displayMode: boolean;       // 是否为块级公式
}
```

### 4.2 公式类型

| 语法 | 类型 | 渲染方式 | CSS 类 |
|------|------|---------|--------|
| `$...$` | 行内公式 | inline span | `.katex` |
| `$$...$$` | 块级公式 | display block | `.katex-display` |
| 渲染失败 | 错误 | 原始代码 + 红色 | `.katex-error` |

## 5. 依赖关系

### 5.1 依赖的上游模块

| 模块 | 特性 | 说明 |
|------|------|------|
| F01-02 | 前端基础配置 | Vite 静态资源配置 |
| F06-01 | markdown-it 核心配置 | markdown-it-katex 插件加载 |
| F06-02 | 基础元素渲染样式 | `.katex` / `.katex-display` 样式 |

### 5.2 下游依赖本模块

| 模块 | 特性 | 说明 |
|------|------|------|
| F06-06 | 预览主组件 | enableKatex 选项控制 |
| F08-03 | 设置面板 | KaTeX 渲染开关 |

### 5.3 npm 依赖

```json
{
  "dependencies": {
    "katex": "^0.16.9",
    "markdown-it-katex": "^2.0.3"
  },
  "devDependencies": {
    "@types/katex": "^0.16.7"
  }
}
```

**注意**：`markdown-it-katex` 插件可能不是最新维护版本。若存在兼容性问题，可改用 `markdown-it-texmath` 或直接在后处理阶段使用 KaTeX API 渲染。

## 6. 测试要点

### 6.1 公式渲染测试

```typescript
// tests/lib/katexConfig.spec.ts
import { describe, it, expect } from 'vitest';
import { renderKatex } from '@/lib/katexConfig';

describe('renderKatex', () => {
  it('应渲染行内公式', () => {
    const html = renderKatex('E = mc^2', false);
    expect(html).toContain('<span');
    expect(html).not.toContain('katex-error');
  });

  it('应渲染块级公式', () => {
    const html = renderKatex('\\sum_{i=1}^{n} x_i', true);
    expect(html).toContain('katex-display');
  });

  it('应渲染矩阵', () => {
    const html = renderKatex('\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', false);
    expect(html).not.toContain('katex-error');
  });

  it('错误公式应显示错误样式', () => {
    const html = renderKatex('\\invalidCommand', false);
    expect(html).toContain('katex-error');
  });
});
```

### 6.2 markdown-it 集成测试

```typescript
describe('markdown-it-katex 集成', () => {
  it('应渲染行内公式 $...$', () => {
    const md = createMarkdownIt({ enableKatex: true });
    const html = md.render('能量公式 $E = mc^2$ 很重要');
    expect(html).toContain('katex');
    expect(html).not.toContain('$E');
  });

  it('应渲染块级公式 $$...$$', () => {
    const md = createMarkdownIt({ enableKatex: true });
    const html = md.render('$$\\int_0^1 x^2 dx = \\frac{1}{3}$$');
    expect(html).toContain('katex-display');
  });
});
```

### 6.3 安全测试

| 测试项 | 输入 | 期望结果 |
|--------|------|---------|
| HTML 注入 | `$\\htmlStyle{color:red}{x}$` | trust:false 下不执行 HTML |
| 超大公式 | 10KB LaTeX | maxSize 限制下截断或报错 |
| 宏炸弹 | `$\\def\\x{\\x\\x}\\x$` | maxExpand 限制下终止 |

### 6.4 性能测试

| 指标 | 目标 | 测试方法 |
|------|------|---------|
| 行内公式 | < 10ms | 单个简单公式 |
| 块级公式 | < 30ms | 矩阵/积分复杂公式 |
| 100 个公式 | < 500ms | 批量渲染 |
| CSS 加载 | < 100ms | KaTeX CSS 首次加载 |
