# F06-01 markdown-it 核心配置与工厂函数

## 1. 功能描述与目标

本特性负责创建和配置 markdown-it 解析器实例，作为整个 Markdown 渲染引擎的核心入口。通过工厂函数统一管控 markdown-it 的实例化、插件加载和自定义渲染规则，确保：

- 所有 Markdown 解析行为一致可控
- 插件加载顺序正确（顺序敏感）
- 安全策略严格执行（`html: false` 禁止原始 HTML 注入）
- 支持本地图片路径解析为 Tauri `asset:` 协议
- 外部链接安全跳转（`target="_blank"` + `rel="noopener noreferrer"`）
- Mermaid 代码块拦截（自定义 fence 规则输出 `<div class="mermaid">`）
- 标题锚点自动生成（为 TOC 跳转和同步滚动提供基础）

## 2. 技术实现方案

### 2.1 文件位置

```
src/lib/markdownIt.ts          # markdown-it 工厂函数 + 插件配置
```

### 2.2 工厂函数设计

采用工厂模式创建 markdown-it 实例，便于复用、测试和不同场景（如同步滚动需要记录 token map 信息）的定制。

```typescript
// src/lib/markdownIt.ts

import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import taskLists from 'markdown-it-task-lists';
import type { MarkdownItOptions } from '@/types/markdown';

// Phase 2 导入
// import katex from 'markdown-it-katex';
// import tocDoneRight from 'markdown-it-toc-done-right';

/**
 * markdown-it 实例配置选项
 */
export interface MkMarkdownItOptions {
  /** 是否启用标题锚点生成（默认 true） */
  enableAnchor?: boolean;
  /** 是否启用任务列表（默认 true） */
  enableTaskLists?: boolean;
  /** 是否启用 KaTeX 数学公式（Phase 2，默认 false） */
  enableKatex?: boolean;
  /** 是否启用 TOC 数据生成（Phase 2，默认 false） */
  enableToc?: boolean;
  /** 当前文件所在目录路径（用于图片相对路径解析） */
  baseDir?: string;
  /** 是否为同步滚动模式（需要记录 data-source-line 属性） */
  enableSourceMap?: boolean;
}

/**
 * 创建配置好的 markdown-it 实例
 * @param options 配置选项
 * @returns 配置完成的 MarkdownIt 实例
 */
export function createMarkdownIt(options: MkMarkdownItOptions = {}): MarkdownIt {
  const {
    enableAnchor = true,
    enableTaskLists = true,
    enableKatex = false,
    enableToc = false,
    baseDir = '',
    enableSourceMap = false,
  } = options;

  // === 核心实例配置 ===
  const md = new MarkdownIt({
    html: false,           // 安全：禁止原始 HTML 标签，防止 XSS
    linkify: true,         // 自动将 URL 文本转换为链接
    typographer: true,     // 启用排版增强（引号、破折号等）
    breaks: true,          // 将单行换行转换为 <br>
  });

  // === 插件加载（顺序敏感）===

  // 1. markdown-it-anchor — 为所有 H1-H6 生成 id 锚点
  if (enableAnchor) {
    md.use(anchor, {
      permalink: false,    // 不在标题旁生成链接图标
      slugify: (s: string) => {
        // 自定义 slugify：支持中文，生成可读锚点
        return s
          .toLowerCase()
          .replace(/[^\w\u4e00-\u9fa5]+/g, '-')  // 保留中英文
          .replace(/^-+|-+$/g, '');              // 去除首尾连字符
      },
      uniqueSlugStartIndex: 2,  // 重复标题后缀起始数字
    });
  }

  // 2. markdown-it-toc-done-right — 生成 TOC 数据结构（Phase 2）
  if (enableToc) {
    // md.use(tocDoneRight, {
    //   containerClass: 'mk-toc-data',
    //   level: [1, 2, 3, 4, 5, 6],
    // });
  }

  // 3. markdown-it-katex — 数学公式渲染（Phase 2）
  if (enableKatex) {
    // md.use(katex, {
    //   throwOnError: false,
    //   errorColor: '#F85149',
    // });
  }

  // 4. markdown-it-task-lists — 任务列表（- [x] / - [ ]）
  if (enableTaskLists) {
    md.use(taskLists, {
      enabled: true,       // 允许点击切换（若不需要可设为 false）
      label: true,         // 包裹在 <label> 中
    });
  }

  // === 自定义渲染规则 ===

  // --- 规则 1: 图片路径转换 ---
  // 将相对路径图片转换为 Tauri asset 协议路径
  const defaultImageRender = md.renderer.rules.image ||
    ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const srcIndex = token.attrIndex('src');

    if (srcIndex >= 0 && baseDir) {
      const src = token.attrs![srcIndex][1];
      // 只处理相对路径（不以 http/https/absolute 开头的路径）
      if (!/^https?:\/\//.test(src) && !src.startsWith('/')) {
        // 通过 Tauri asset 协议加载本地文件
        // 注意：实际路径拼接在 Rust 后端或前端服务层处理
        token.attrs![srcIndex][1] = `asset://${baseDir}/${src}`;
      }
    }

    return defaultImageRender(tokens, idx, options, env, self);
  };

  // --- 规则 2: 外部链接安全处理 ---
  const defaultLinkOpen = md.renderer.rules.link_open ||
    ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const hrefIndex = token.attrIndex('href');

    if (hrefIndex >= 0) {
      const href = token.attrs![hrefIndex][1];

      // 外部 URL（http/https）添加安全属性
      if (/^https?:\/\//.test(href)) {
        token.attrSet('target', '_blank');
        token.attrSet('rel', 'noopener noreferrer');
        token.attrSet('class', 'external-link');
      }
      // 内部锚点链接（#xxx）不需要特殊处理
      // 相对路径链接（如 ./other.md）在应用中按内部导航处理
    }

    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  // --- 规则 3: 自定义 fence 规则（Mermaid + 代码块增强）---
  const defaultFence = md.renderer.rules.fence ||
    ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const info = token.info.trim();
    const langName = info.split(/\s+/g)[0];

    // === Mermaid 图表拦截 ===
    if (langName === 'mermaid') {
      // 输出为 mermaid 容器，由 Stage 3b 调用 mermaid.js 渲染
      return `<div class="mermaid" data-source-line="${token.map?.[0] ?? ''}">${
        md.utils.escapeHtml(token.content)
      }</div>`;
    }

    // === 代码块增强渲染 ===
    // 为代码块添加语言标签、data-source-line 属性
    const sourceLine = enableSourceMap && token.map
      ? ` data-source-line="${token.map[0]}"`
      : '';

    // 生成带头部条的代码块 HTML
    const langDisplay = langName || 'text';
    const codeContent = token.content;

    return [
      `<div class="code-block-wrapper"${sourceLine}>`,
      `  <div class="code-header">`,
      `    <span class="code-lang">${langDisplay}</span>`,
      `    <button class="code-copy-btn" data-code="${md.utils.escapeHtml(codeContent)}">`,
      `      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">`,
      `        <rect x="9" y="9" width="13" height="13" rx="2"/>`,
      `        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`,
      `      </svg>`,
      `      <span class="copy-label">复制</span>`,
      `    </button>`,
      `  </div>`,
      `  <pre class="code-body"><code class="hljs language-${langName || 'plaintext'}">${
        md.utils.escapeHtml(codeContent)
      }</code></pre>`,
      `</div>`,
    ].join('\n');
  };

  // --- 规则 4: 标题添加 data-source-line（同步滚动支持）---
  if (enableSourceMap) {
    ['heading_open'].forEach((ruleName) => {
      const originalRule = md.renderer.rules[ruleName as string] ||
        ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

      md.renderer.rules[ruleName as string] = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        if (token.map) {
          token.attrSet('data-source-line', String(token.map[0]));
        }
        return originalRule(tokens, idx, options, env, self);
      };
    });
  }

  // --- 规则 5: 其他块级元素添加 data-source-line ---
  if (enableSourceMap) {
    const blockRules = [
      'paragraph_open',
      'blockquote_open',
      'ordered_list_open',
      'bullet_list_open',
      'table_open',
      'hr',
    ];

    blockRules.forEach((ruleName) => {
      const originalRule = md.renderer.rules[ruleName] ||
        ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

      md.renderer.rules[ruleName] = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        if (token.map) {
          token.attrSet('data-source-line', String(token.map[0]));
        }
        return originalRule(tokens, idx, options, env, self);
      };
    });
  }

  return md;
}

/**
 * 快速渲染函数：使用默认配置渲染 Markdown 文本为 HTML
 * @param content Markdown 原始文本
 * @param baseDir 当前文件目录（用于图片路径解析）
 * @returns 渲染后的 HTML 字符串
 */
export function renderMarkdown(content: string, baseDir?: string): string {
  const md = createMarkdownIt({ baseDir });
  return md.render(content);
}
```

### 2.3 核心配置详解

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `html` | `false` | **安全关键**：禁止原始 HTML 标签，防止用户 Markdown 中嵌入 `<script>` 等恶意标签 |
| `linkify` | `true` | 自动识别文本中的 URL 并转为链接 |
| `typographer` | `true` | 启用智能排版：将 `"` 转为弯引号、`--` 转为破折号等 |
| `breaks` | `true` | 单换行转为 `<br>`，更符合中文写作习惯 |

### 2.4 插件加载顺序说明

```
anchor -> toc-done-right -> katex -> task-lists -> 自定义 fence 规则
```

顺序敏感原因：
- `anchor` 必须在其他修改标题的插件之前执行
- `katex` 修改 token 流中的 `$...$` / `$$...$$`，应在 fence 规则之前
- `task-lists` 修改列表项 token，在 fence 之后无冲突
- 自定义 `fence` 规则最后覆盖默认代码块行为

### 2.5 安全设计

| 安全层面 | 策略 | 实现位置 |
|---------|------|---------|
| HTML 注入防护 | `html: false` 禁止原始 HTML | 工厂函数核心配置 |
| 外部链接安全 | `target="_blank"` + `rel="noopener noreferrer"` | `link_open` 自定义规则 |
| XSS 防护 | `v-html` 仅接受 markdown-it 受控输出 | 预览组件层 |
| 图片路径安全 | 仅处理相对路径，外部 http URL 原样保留 | `image` 自定义规则 |
| Mermaid 安全 | `securityLevel: 'strict'`（在 F06-07 中配置） | mermaidConfig.ts |

## 3. 接口定义

### 3.1 导出函数

```typescript
// 工厂函数
export function createMarkdownIt(options?: MkMarkdownItOptions): MarkdownIt;

// 快速渲染
export function renderMarkdown(content: string, baseDir?: string): string;
```

### 3.2 MkMarkdownItOptions 接口

```typescript
interface MkMarkdownItOptions {
  enableAnchor?: boolean;       // 标题锚点（默认 true）
  enableTaskLists?: boolean;    // 任务列表（默认 true）
  enableKatex?: boolean;        // KaTeX（默认 false）
  enableToc?: boolean;          // TOC 数据（默认 false）
  baseDir?: string;             // 图片基准目录
  enableSourceMap?: boolean;    // 同步滚动 source-line（默认 false）
}
```

### 3.3 类型扩展（env.d.ts）

```typescript
// 扩展 markdown-it 类型以支持 token.map
declare module 'markdown-it' {
  interface Token {
    map: [number, number] | null;
  }
}
```

## 4. 数据结构

### 4.1 markdown-it Token 关键属性

```typescript
interface Token {
  type: string;        // token 类型，如 'heading_open', 'fence', 'inline'
  tag: string;         // HTML 标签名，如 'h1', 'pre', 'p'
  attrs: [string, string][] | null;  // HTML 属性列表
  map: [number, number] | null;      // 源码行号范围 [start, end)
  nesting: number;     // 1=开标签, 0=自闭合, -1=闭标签
  content: string;     // token 内容（如 fence 中的代码）
  markup: string;      // Markdown 标记（如 `#`, ````）
  info: string;        // fence 信息字符串（如 `cpp`）
  block: boolean;      // 是否为块级 token
  children: Token[] | null;  // 内联 token 子树
}
```

### 4.2 渲染输出结构

markdown-it `render()` 输出标准 HTML 字符串，各自定义规则生成的结构：

**Mermaid 容器：**
```html
<div class="mermaid" data-source-line="42">
  graph TD; A-->B;
</div>
```

**增强代码块：**
```html
<div class="code-block-wrapper" data-source-line="10">
  <div class="code-header">
    <span class="code-lang">cpp</span>
    <button class="code-copy-btn" data-code="...">复制</button>
  </div>
  <pre class="code-body"><code class="hljs language-cpp">...</code></pre>
</div>
```

**外部链接：**
```html
<a href="https://example.com" target="_blank" rel="noopener noreferrer" class="external-link">
```

## 5. 依赖关系

### 5.1 依赖的上游模块

| 模块 | 特性 | 说明 |
|------|------|------|
| F01-02 | 前端基础配置 | TypeScript / Vite / 路径别名基础设施 |
| F08-01 | CSS 变量主题系统 | 无需直接依赖，但渲染输出类名需与主题 CSS 配合 |

### 5.2 下游依赖本模块

| 模块 | 特性 | 说明 |
|------|------|------|
| F06-02 | 基础元素渲染样式 | 渲染输出的 HTML 结构依赖 base.css 样式 |
| F06-03 | 代码块渲染与高亮 | fence 自定义规则输出的代码块结构由 CodeBlock.vue 增强 |
| F06-04 | 表格渲染 | table_open 规则输出的 table 由 table.css 样式化 |
| F06-05 | 图片处理 | image 规则输出的 img 由 ImageLightbox.vue 处理 |
| F06-06 | 预览主组件 | 直接调用 createMarkdownIt / renderMarkdown |
| F06-07 | Mermaid 图表 | fence 规则拦截 mermaid 语言输出容器 |
| F06-08 | KaTeX 数学公式 | 通过 enableKatex 选项启用插件 |
| F06-09 | TOC 目录大纲 | 通过 enableToc 选项启用锚点和目录数据 |
| F06-10 | 渲染缓存 | 缓存的 key 为文件内容 hash，值为 md.render() 输出 |
| F07-05 | 分屏同步滚动 | 通过 enableSourceMap 添加 data-source-line |

### 5.3 npm 依赖

```json
{
  "dependencies": {
    "markdown-it": "^14.0.0",
    "markdown-it-anchor": "^9.0.0",
    "markdown-it-task-lists": "^2.1.1"
  },
  "devDependencies": {
    "@types/markdown-it": "^14.0.0"
  }
}
```

Phase 2 追加：
```json
{
  "dependencies": {
    "markdown-it-katex": "^2.0.3",
    "markdown-it-toc-done-right": "^4.2.0"
  }
}
```

## 6. 测试要点

### 6.1 单元测试

```typescript
// tests/lib/markdownIt.spec.ts
import { describe, it, expect } from 'vitest';
import { createMarkdownIt, renderMarkdown } from '@/lib/markdownIt';

describe('createMarkdownIt', () => {
  it('应禁止原始 HTML 渲染', () => {
    const md = createMarkdownIt();
    const html = md.render('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('应自动转换 URL 为链接', () => {
    const md = createMarkdownIt();
    const html = md.render('访问 https://example.com 查看');
    expect(html).toContain('<a href="https://example.com"');
  });

  it('应为标题生成锚点 id', () => {
    const md = createMarkdownIt();
    const html = md.render('# 指针基础');
    expect(html).toContain('<h1 id="指针基础">');
  });

  it('应正确处理英文标题 slugify', () => {
    const md = createMarkdownIt();
    const html = md.render('# Hello World');
    expect(html).toContain('<h1 id="hello-world">');
  });

  it('应渲染任务列表', () => {
    const md = createMarkdownIt();
    const html = md.render('- [x] 已完成\n- [ ] 未完成');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked');
  });

  it('应将外部链接添加 target="_blank"', () => {
    const md = createMarkdownIt();
    const html = md.render('[链接](https://example.com)');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('class="external-link"');
  });

  it('不应修改内部锚点链接', () => {
    const md = createMarkdownIt();
    const html = md.render('[跳转](#section-1)');
    expect(html).not.toContain('target="_blank"');
  });

  it('应拦截 mermaid 代码块输出容器', () => {
    const md = createMarkdownIt();
    const html = md.render('```mermaid\ngraph TD;\n```');
    expect(html).toContain('<div class="mermaid">');
    expect(html).not.toContain('<pre><code>');
  });

  it('应转换相对图片路径为 asset 协议', () => {
    const md = createMarkdownIt({ baseDir: '/Users/learn/Cpp' });
    const html = md.render('![图](./diagram.png)');
    expect(html).toContain('src="asset:///Users/learn/Cpp/./diagram.png"');
  });

  it('应保留外部图片 URL 不变', () => {
    const md = createMarkdownIt({ baseDir: '/Users/learn' });
    const html = md.render('![图](https://example.com/img.png)');
    expect(html).toContain('src="https://example.com/img.png"');
  });

  it('应在同步滚动模式下添加 data-source-line', () => {
    const md = createMarkdownIt({ enableSourceMap: true });
    const html = md.render('# 标题\n\n段落');
    expect(html).toContain('data-source-line=');
  });
});

describe('renderMarkdown', () => {
  it('应正确渲染完整 Markdown 文档', () => {
    const md = '# 测试\n\n正文内容';
    const html = renderMarkdown(md);
    expect(html).toContain('<h1');
    expect(html).toContain('<p>');
  });
});
```

### 6.2 安全测试

| 测试用例 | 输入 | 期望输出 |
|---------|------|---------|
| XSS 脚本注入 | `<script>alert(1)</script>` | `&lt;script&gt;` 转义 |
| 事件处理器注入 | `<img onerror="alert(1)">` | `&lt;img onerror=` 转义 |
| 外部链接安全 | `[链接](https://evil.com)` | 含 `target="_blank"` + `rel="noopener noreferrer"` |
| Mermaid 代码隔离 | ```` ```mermaid ```` | 输出为 `<div class="mermaid">` 而非直接执行 |

### 6.3 性能测试

| 指标 | 目标 | 测试方法 |
|------|------|---------|
| 实例创建 | < 5ms | `performance.now()` 测量 `createMarkdownIt()` |
| 1000 行渲染 | < 50ms | 1000 行 Markdown 文本 `md.render()` |
| 5000 行渲染 | < 300ms | 5000 行 Markdown 文本 `md.render()` |
| 内存占用 | 实例 < 2MB | DevTools Memory 面板 |
