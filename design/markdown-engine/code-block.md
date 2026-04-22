# F06-03 代码块渲染与 highlight.js 高亮

## 1. 功能描述与目标

本特性实现 Markdown 代码块（fenced code blocks）的精美渲染，包含：

- **语法高亮**：基于 highlight.js，覆盖知识库实际使用的 20+ 种编程语言
- **代码块头部**：显示语言标签（如 `cpp`、`python`）
- **一键复制**：右上角复制按钮，点击后复制原始代码到剪贴板并显示 "已复制" 反馈（2 秒后恢复）
- **行号显示**：可选开关，在代码左侧显示行号
- **主题切换**：亮色主题使用 `github` 高亮主题，暗色主题使用 `github-dark`
- **横向滚动**：超长代码行不自动换行，通过横向滚动查看
- **ASCII 框图特殊处理**：无语言标记代码块使用等宽字体严格渲染，确保 box-drawing 字符不断裂

### 知识库语言覆盖统计

根据 PRD 1.2 节数据画像，知识库代码块涉及 20+ 种语言，必须全部支持高亮。

## 2. 技术实现方案

### 2.1 文件位置

```
src/lib/highlighter.ts                    # highlight.js 配置 + 按需加载
src/assets/styles/markdown/code.css       # 代码块专属样式
src/components/preview/CodeBlock.vue      # 代码块增强 Vue 组件（复制按钮交互）
```

### 2.2 highlight.js 配置

```typescript
// src/lib/highlighter.ts

import hljs from 'highlight.js/lib/core';

// === 按需加载语言模块（仅注册知识库实际使用的语言） ===
// 按字母顺序排列，便于管理

import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cmake from 'highlight.js/lib/languages/cmake';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import glsl from 'highlight.js/lib/languages/glsl';
import go from 'highlight.js/lib/languages/go';
import hlsl from 'highlight.js/lib/languages/hlsl';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import lua from 'highlight.js/lib/languages/lua';
import markdown from 'highlight.js/lib/languages/markdown';
import objectivec from 'highlight.js/lib/languages/objectivec';
import php from 'highlight.js/lib/languages/php';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import scss from 'highlight.js/lib/languages/scss';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

// === 语言注册映射表 ===
const languageMap: Record<string, string> = {
  // 别名 → 标准名
  'sh': 'bash',
  'zsh': 'bash',
  'objc': 'objectivec',
  'objective-c': 'objectivec',
  'ts': 'typescript',
  'js': 'javascript',
  'py': 'python',
  'rs': 'rust',
  'yml': 'yaml',
  'html': 'xml',
  'htm': 'xml',
  'metal': 'cpp',       // Metal Shading Language 语法接近 C++
  'hlsl': 'cpp',        // HLSL 无独立语言定义，用 cpp 兜底
  'glsl': 'cpp',        // GLSL 无独立语言定义，用 cpp 兜底
};

// 注册所有语言
const languages: Array<{ name: string; module: any }> = [
  { name: 'bash', module: bash },
  { name: 'c', module: c },
  { name: 'cmake', module: cmake },
  { name: 'cpp', module: cpp },
  { name: 'csharp', module: csharp },
  { name: 'css', module: css },
  { name: 'diff', module: diff },
  { name: 'glsl', module: glsl },
  { name: 'go', module: go },
  { name: 'hlsl', module: hlsl },
  { name: 'ini', module: ini },
  { name: 'java', module: java },
  { name: 'javascript', module: javascript },
  { name: 'json', module: json },
  { name: 'kotlin', module: kotlin },
  { name: 'lua', module: lua },
  { name: 'markdown', module: markdown },
  { name: 'objectivec', module: objectivec },
  { name: 'php', module: php },
  { name: 'python', module: python },
  { name: 'rust', module: rust },
  { name: 'scss', module: scss },
  { name: 'shell', module: shell },
  { name: 'sql', module: sql },
  { name: 'swift', module: swift },
  { name: 'typescript', module: typescript },
  { name: 'xml', module: xml },
  { name: 'yaml', module: yaml },
];

// 执行注册
languages.forEach(({ name, module }) => {
  hljs.registerLanguage(name, module);
});

/**
 * 规范化语言名称（处理别名）
 * @param lang 原始语言标记
 * @returns 规范化的语言名称，未找到则返回 'plaintext'
 */
export function normalizeLanguage(lang: string): string {
  const normalized = lang.toLowerCase().trim();
  // 先查别名映射
  if (languageMap[normalized]) {
    return languageMap[normalized];
  }
  // 再查是否已注册
  if (hljs.getLanguage(normalized)) {
    return normalized;
  }
  return 'plaintext';
}

/**
 * 获取支持的语言列表
 * @returns 已注册语言名称数组
 */
export function getSupportedLanguages(): string[] {
  return languages.map(l => l.name).sort();
}

/**
 * 对代码字符串进行语法高亮
 * @param code 原始代码
 * @param lang 语言标记
 * @returns 高亮后的 HTML 字符串
 */
export function highlightCode(code: string, lang: string): string {
  const normalized = normalizeLanguage(lang);

  if (normalized === 'plaintext') {
    return hljs.highlightAuto(code).value;
  }

  try {
    return hljs.highlight(code, { language: normalized }).value;
  } catch (err) {
    console.warn(`[highlighter] 高亮失败 (${lang} -> ${normalized}):`, err);
    return hljs.highlightAuto(code).value;
  }
}

/**
 * 对 DOM 中的代码元素进行高亮（用于 Stage 3a 后处理）
 * @param container 渲染容器 DOM 元素
 */
export function highlightAllInContainer(container: HTMLElement): void {
  const codeBlocks = container.querySelectorAll('pre code[class*="language-"]');
  codeBlocks.forEach((el) => {
    const codeEl = el as HTMLElement;
    const langClass = Array.from(codeEl.classList).find(c => c.startsWith('language-'));
    const lang = langClass ? langClass.replace('language-', '') : 'plaintext';

    // 跳过已高亮的元素
    if (codeEl.dataset.highlighted === 'true') return;

    const code = codeEl.textContent || '';
    const highlighted = highlightCode(code, lang);
    codeEl.innerHTML = highlighted;
    codeEl.dataset.highlighted = 'true';
  });
}

/**
 * 判断是否为 ASCII 艺术框图代码块
 * @param code 代码内容
 * @returns 是否为 ASCII 框图
 */
export function isAsciiArt(code: string): boolean {
  // 检测是否包含 box-drawing 字符
  const boxDrawingChars = /[\u2500-\u257F\u2580-\u259F]/;
  return boxDrawingChars.test(code);
}

export default hljs;
```

### 2.3 代码块样式（code.css）

```css
/* ============================================================
   MKPreview - 代码块渲染样式
   文件: src/assets/styles/markdown/code.css
   范围: .mk-body 下的代码块元素
   规范: PRD 第八节 8.5
   ============================================================ */

/* -------------------- 代码块容器 -------------------- */

.mk-body .code-block-wrapper {
  margin: 1.2em 0;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-code);
  overflow: hidden;
}

/* -------------------- 代码块头部 -------------------- */

.mk-body .code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 14px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
  font-family: var(--font-ui);
  font-size: 11px;
  color: var(--text-secondary);
  user-select: none;
}

.mk-body .code-lang {
  text-transform: lowercase;
  font-weight: 500;
  letter-spacing: 0.3px;
}

/* -------------------- 复制按钮 -------------------- */

.mk-body .code-copy-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-family: var(--font-ui);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
  outline: none;
}

.mk-body .code-copy-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.mk-body .code-copy-btn:active {
  transform: scale(0.96);
}

.mk-body .code-copy-btn.copied {
  border-color: var(--accent-green);
  color: var(--accent-green);
}

.mk-body .code-copy-btn .copy-label {
  min-width: 28px;
  text-align: center;
}

/* 悬浮时才显示复制按钮（可选：默认显示） */
.mk-body .code-block-wrapper:not(:hover) .code-copy-btn {
  opacity: 0.6;
}

.mk-body .code-block-wrapper:hover .code-copy-btn {
  opacity: 1;
}

/* -------------------- 代码主体 -------------------- */

.mk-body .code-body {
  margin: 0;
  padding: 0;
  background: transparent;
  border: none;
  overflow-x: auto;
}

.mk-body .code-body code {
  display: block;
  padding: 14px 18px;
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.6;
  font-family: var(--font-mono);
  white-space: pre;
  word-break: normal;
  overflow-wrap: normal;
  tab-size: 4;
}

/* -------------------- 行号显示 -------------------- */

.mk-body .code-block-wrapper.with-line-numbers {
  display: grid;
  grid-template-columns: auto 1fr;
}

.mk-body .code-block-wrapper.with-line-numbers .code-header {
  grid-column: 1 / -1;
}

.mk-body .line-numbers {
  padding: 14px 0;
  background: color-mix(in srgb, var(--bg-tertiary) 30%, transparent);
  border-right: 1px solid var(--border);
  text-align: right;
  user-select: none;
  overflow: hidden;
}

.mk-body .line-number {
  display: block;
  padding: 0 12px 0 18px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.6;
  min-width: 3ch;
}

.mk-body .code-body.with-line-numbers {
  overflow-x: auto;
}

/* -------------------- highlight.js 主题适配 -------------------- */

/* 亮色主题: github */
html[data-theme="light"] .mk-body .code-body code .hljs-comment,
html[data-theme="light"] .mk-body .code-body code .hljs-quote {
  color: #6a737d;
  font-style: italic;
}

html[data-theme="light"] .mk-body .code-body code .hljs-keyword,
html[data-theme="light"] .mk-body .code-body code .hljs-selector-tag,
html[data-theme="light"] .mk-body .code-body code .hljs-subst {
  color: #d73a49;
}

html[data-theme="light"] .mk-body .code-body code .hljs-number,
html[data-theme="light"] .mk-body .code-body code .hljs-literal,
html[data-theme="light"] .mk-body .code-body code .hljs-variable,
html[data-theme="light"] .mk-body .code-body code .hljs-template-variable,
html[data-theme="light"] .mk-body .code-body code .hljs-tag .hljs-attr {
  color: #005cc5;
}

html[data-theme="light"] .mk-body .code-body code .hljs-string,
html[data-theme="light"] .mk-body .code-body code .hljs-doctag {
  color: #032f62;
}

html[data-theme="light"] .mk-body .code-body code .hljs-title,
html[data-theme="light"] .mk-body .code-body code .hljs-section,
html[data-theme="light"] .mk-body .code-body code .hljs-selector-id {
  color: #6f42c1;
}

html[data-theme="light"] .mk-body .code-body code .hljs-type,
html[data-theme="light"] .mk-body .code-body code .hljs-class .hljs-title {
  color: #6f42c1;
}

html[data-theme="light"] .mk-body .code-body code .hljs-tag,
html[data-theme="light"] .mk-body .code-body code .hljs-name,
html[data-theme="light"] .mk-body .code-body code .hljs-attribute {
  color: #22863a;
}

html[data-theme="light"] .mk-body .code-body code .hljs-regexp,
html[data-theme="light"] .mk-body .code-body code .hljs-link {
  color: #032f62;
}

html[data-theme="light"] .mk-body .code-body code .hljs-symbol,
html[data-theme="light"] .mk-body .code-body code .hljs-bullet {
  color: #e36209;
}

html[data-theme="light"] .mk-body .code-body code .hljs-built_in,
html[data-theme="light"] .mk-body .code-body code .hljs-builtin-name {
  color: #005cc5;
}

html[data-theme="light"] .mk-body .code-body code .hljs-meta {
  color: #b31d28;
}

html[data-theme="light"] .mk-body .code-body code .hljs-deletion {
  background: #ffeef0;
  color: #b31d28;
}

html[data-theme="light"] .mk-body .code-body code .hljs-addition {
  background: #f0fff4;
  color: #22863a;
}

html[data-theme="light"] .mk-body .code-body code .hljs-emphasis {
  font-style: italic;
}

html[data-theme="light"] .mk-body .code-body code .hljs-strong {
  font-weight: 600;
}

/* 暗色主题: github-dark */
html[data-theme="dark"] .mk-body .code-body code .hljs-comment,
html[data-theme="dark"] .mk-body .code-body code .hljs-quote {
  color: #8b949e;
  font-style: italic;
}

html[data-theme="dark"] .mk-body .code-body code .hljs-keyword,
html[data-theme="dark"] .mk-body .code-body code .hljs-selector-tag,
html[data-theme="dark"] .mk-body .code-body code .hljs-subst {
  color: #ff7b72;
}

html[data-theme="dark"] .mk-body .code-body code .hljs-number,
html[data-theme="dark"] .mk-body .code-body code .hljs-literal,
html[data-theme="dark"] .mk-body .code-body code .hljs-variable,
html[data-theme="dark"] .mk-body .code-body code .hljs-template-variable,
html[data-theme="dark"] .mk-body .code-body code .hljs-tag .hljs-attr {
  color: #79c0ff;
}

html[data-theme="dark"] .mk-body .code-body code .hljs-string,
html[data-theme="dark"] .mk-body .code-body code .hljs-doctag {
  color: #a5d6ff;
}

html[data-theme="dark"] .mk-body .code-body code .hljs-title,
html[data-theme="dark"] .mk-body .code-body code .hljs-section,
html[data-theme="dark"] .mk-body .code-body code .hljs-selector-id {
  color: #d2a8ff;
}

html[data-theme="dark"] .mk-body .code-body code .hljs-type,
html[data-theme="dark"] .mk-body .code-body code .hljs-class .hljs-title {
  color: #d2a8ff;
}

html[data-theme="dark"] .mk-body .code-body code .hljs-tag,
html[data-theme="dark"] .mk-body .code-body code .hljs-name,
html[data-theme="dark"] .mk-body .code-body code .hljs-attribute {
  color: #7ee787;
}

html[data-theme="dark"] .mk-body .code-body code .hljs-regexp,
html[data-theme="dark"] .mk-body .code-body code .hljs-link {
  color: #a5d6ff;
}

html[data-theme="dark"] .mk-body .code-body code .hljs-symbol,
html[data-theme="dark"] .mk-body .code-body code .hljs-bullet {
  color: #ffa657;
}

html[data-theme="dark"] .mk-body .code-body code .hljs-built_in,
html[data-theme="dark"] .mk-body .code-body code .hljs-builtin-name {
  color: #79c0ff;
}

html[data-theme="dark"] .mk-body .code-body code .hljs-meta {
  color: #f85149;
}

html[data-theme="dark"] .mk-body .code-body code .hljs-deletion {
  background: rgba(248, 81, 73, 0.15);
  color: #f85149;
}

html[data-theme="dark"] .mk-body .code-body code .hljs-addition {
  background: rgba(63, 185, 80, 0.15);
  color: #3fb950;
}

html[data-theme="dark"] .mk-body .code-body code .hljs-emphasis {
  font-style: italic;
}

html[data-theme="dark"] .mk-body .code-body code .hljs-strong {
  font-weight: 600;
}

/* -------------------- 8.12 ASCII 框图特殊处理 -------------------- */

/* 无语言标记的代码块（可能为 ASCII 框图） */
.mk-body .code-block-wrapper[data-is-ascii="true"] .code-body code,
.mk-body pre:has(> code.language-plaintext) .code-body code,
.mk-body pre:has(> code:not([class*="language-"])) .code-body code {
  line-height: 1.2 !important;
  letter-spacing: 0 !important;
  font-variant-ligatures: none !important;
  white-space: pre !important;
}

/* 为 ASCII 框图添加显式标记 */
.mk-body .code-block-wrapper.ascii-art {
  background: var(--bg-primary);
}

.mk-body .code-block-wrapper.ascii-art .code-body code {
  line-height: 1.2;
  letter-spacing: 0;
  font-variant-ligatures: none;
  font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
}

/* -------------------- 行内代码（在 base.css 中定义，此处补充） -------------------- */

.mk-body :not(pre) > code {
  /* base.css 已定义基础样式，此处仅补充 */
  word-break: break-word;
}

/* 代码块中的行内代码（不应有特殊样式） */
.mk-body .code-body code code {
  background: transparent;
  padding: 0;
  border-radius: 0;
  color: inherit;
  font-size: inherit;
}

/* -------------------- diff 代码块特殊样式 -------------------- */

.mk-body .code-body code .hljs-addition {
  display: inline-block;
  width: 100%;
}

.mk-body .code-body code .hljs-deletion {
  display: inline-block;
  width: 100%;
}
```

### 2.4 CodeBlock.vue 组件

```vue
<!-- src/components/preview/CodeBlock.vue -->
<template>
  <!-- 本组件不独立渲染，由 MarkdownPreview.vue 在 DOM 注入后调用 initCopyButtons -->
</template>

<script setup lang="ts">
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

/**
 * 初始化渲染容器内所有代码块的复制按钮事件
 * @param container 渲染容器 DOM 元素
 */
export async function initCopyButtons(container: HTMLElement): Promise<void> {
  const buttons = container.querySelectorAll<HTMLButtonElement>('.code-copy-btn');

  buttons.forEach((btn) => {
    // 避免重复绑定
    if (btn.dataset.copyBound === 'true') return;
    btn.dataset.copyBound = 'true';

    btn.addEventListener('click', async () => {
      const code = btn.getAttribute('data-code');
      if (!code) return;

      try {
        await writeText(code);
        showCopiedFeedback(btn);
      } catch (err) {
        console.error('[CodeBlock] 复制失败:', err);
        // 降级方案：使用原生 clipboard API
        try {
          await navigator.clipboard.writeText(code);
          showCopiedFeedback(btn);
        } catch {
          btn.querySelector('.copy-label')!.textContent = '失败';
          setTimeout(() => {
            btn.querySelector('.copy-label')!.textContent = '复制';
          }, 2000);
        }
      }
    });
  });
}

/**
 * 显示"已复制"反馈
 * @param btn 复制按钮元素
 */
function showCopiedFeedback(btn: HTMLButtonElement): void {
  const label = btn.querySelector('.copy-label');
  const originalText = label?.textContent || '复制';

  btn.classList.add('copied');
  if (label) label.textContent = '已复制';

  setTimeout(() => {
    btn.classList.remove('copied');
    if (label) label.textContent = originalText;
  }, 2000);
}

/**
 * 为代码块添加行号（若设置开启）
 * @param container 渲染容器 DOM 元素
 */
export function addLineNumbers(container: HTMLElement): void {
  const wrappers = container.querySelectorAll<HTMLElement>('.code-block-wrapper:not(.with-line-numbers)');

  wrappers.forEach((wrapper) => {
    const codeEl = wrapper.querySelector('code');
    if (!codeEl) return;

    const lines = (codeEl.textContent || '').split('\n');
    // 去除末尾空行
    if (lines[lines.length - 1] === '') lines.pop();

    const lineCount = lines.length;
    if (lineCount <= 1) return; // 单行不显示行号

    // 生成行号 HTML
    const numbersHtml = lines
      .map((_, i) => `<span class="line-number">${i + 1}</span>`)
      .join('');

    const numbersDiv = document.createElement('div');
    numbersDiv.className = 'line-numbers';
    numbersDiv.innerHTML = numbersHtml;

    wrapper.classList.add('with-line-numbers');
    wrapper.insertBefore(numbersDiv, wrapper.querySelector('.code-body'));
  });
}

/**
 * 检测并标记 ASCII 艺术框图代码块
 * @param container 渲染容器 DOM 元素
 */
export function detectAsciiArt(container: HTMLElement): void {
  const boxDrawingChars = /[\u2500-\u257F\u2580-\u259F]/;

  container.querySelectorAll<HTMLElement>('.code-block-wrapper').forEach((wrapper) => {
    const codeEl = wrapper.querySelector('code');
    if (!codeEl) return;

    const code = codeEl.textContent || '';
    const lang = wrapper.querySelector('.code-lang')?.textContent || '';

    // 无语言标记且包含 box-drawing 字符
    if ((!lang || lang === 'text' || lang === 'plaintext') && boxDrawingChars.test(code)) {
      wrapper.dataset.isAscii = 'true';
      wrapper.classList.add('ascii-art');
    }
  });
}

/**
 * 完全清理代码块事件监听器（组件卸载时调用）
 * @param container 渲染容器 DOM 元素
 */
export function cleanupCopyButtons(container: HTMLElement): void {
  const buttons = container.querySelectorAll<HTMLButtonElement>('.code-copy-btn');
  buttons.forEach((btn) => {
    btn.dataset.copyBound = '';
    // 克隆节点以移除所有事件监听器
    const newBtn = btn.cloneNode(true) as HTMLButtonElement;
    btn.parentNode?.replaceChild(newBtn, btn);
  });
}
</script>
```

## 3. 接口定义

### 3.1 highlighter.ts 导出

```typescript
// 语法高亮
export function highlightCode(code: string, lang: string): string;

// 容器内批量高亮
export function highlightAllInContainer(container: HTMLElement): void;

// 语言名称规范化
export function normalizeLanguage(lang: string): string;

// 获取支持语言列表
export function getSupportedLanguages(): string[];

// ASCII 框图检测
export function isAsciiArt(code: string): boolean;

// hljs 实例（高级用途）
export default hljs;
```

### 3.2 CodeBlock.vue 导出

```typescript
// 初始化复制按钮
export function initCopyButtons(container: HTMLElement): Promise<void>;

// 添加行号
export function addLineNumbers(container: HTMLElement): void;

// 检测 ASCII 框图
export function detectAsciiArt(container: HTMLElement): void;

// 清理事件监听
export function cleanupCopyButtons(container: HTMLElement): void;
```

## 4. 数据结构

### 4.1 支持语言列表（28 种）

| 标准名 | 别名 | 说明 |
|--------|------|------|
| bash | sh, zsh | Shell 脚本 |
| c | — | C 语言 |
| cmake | — | CMake 构建脚本 |
| cpp | c++, cxx | C++ 语言 |
| csharp | cs, c# | C# 语言 |
| css | — | CSS 样式表 |
| diff | patch | Diff/Patch 文件 |
| glsl | — | OpenGL Shading Language（cpp 兜底） |
| go | golang | Go 语言 |
| hlsl | — | HLSL 着色器（cpp 兜底） |
| ini | toml | INI/TOML 配置 |
| java | — | Java 语言 |
| javascript | js | JavaScript |
| json | — | JSON 数据 |
| kotlin | kt | Kotlin 语言 |
| lua | — | Lua 脚本 |
| markdown | md | Markdown 文本 |
| objectivec | objc, objective-c | Objective-C |
| php | — | PHP 语言 |
| python | py | Python 语言 |
| rust | rs | Rust 语言 |
| scss | sass | SCSS/Sass 样式 |
| shell | — | Shell 会话 |
| sql | — | SQL 查询 |
| swift | — | Swift 语言 |
| typescript | ts | TypeScript |
| xml | html, htm | XML/HTML |
| yaml | yml | YAML 配置 |

### 4.2 代码块 DOM 结构

```html
<div class="code-block-wrapper" data-source-line="10" data-is-ascii="false">
  <div class="code-header">
    <span class="code-lang">cpp</span>
    <button class="code-copy-btn" data-code="原始代码...">
      <svg>...</svg>
      <span class="copy-label">复制</span>
    </button>
  </div>
  <pre class="code-body"><code class="hljs language-cpp">高亮后的代码...</code></pre>
</div>
```

## 5. 依赖关系

### 5.1 依赖的上游模块

| 模块 | 特性 | 说明 |
|------|------|------|
| F01-02 | 前端基础配置 | Vite / TypeScript 基础设施 |
| F06-01 | markdown-it 核心配置 | fence 自定义规则输出代码块 HTML 结构 |
| F08-01 | CSS 变量主题系统 | --bg-code / --border / --accent 等变量 |

### 5.2 下游依赖本模块

| 模块 | 特性 | 说明 |
|------|------|------|
| F06-06 | 预览主组件 | 调用 highlightAllInContainer + initCopyButtons |
| F08-03 | 设置面板 | 行号显示开关配置 |

### 5.3 npm 依赖

```json
{
  "dependencies": {
    "highlight.js": "^11.9.0"
  },
  "devDependencies": {
    "@types/highlight.js": "^10.1.0"
  }
}
```

**注意**：highlight.js 11.x 采用模块化设计，支持按需加载子语言模块，打包时仅包含已注册的语言，大幅减小 bundle 体积。

## 6. 测试要点

### 6.1 高亮功能测试

```typescript
// tests/lib/highlighter.spec.ts
import { describe, it, expect } from 'vitest';
import { highlightCode, normalizeLanguage, isAsciiArt, getSupportedLanguages } from '@/lib/highlighter';

describe('normalizeLanguage', () => {
  it('应支持标准语言名', () => {
    expect(normalizeLanguage('cpp')).toBe('cpp');
    expect(normalizeLanguage('python')).toBe('python');
  });

  it('应处理别名映射', () => {
    expect(normalizeLanguage('py')).toBe('python');
    expect(normalizeLanguage('ts')).toBe('typescript');
    expect(normalizeLanguage('sh')).toBe('bash');
    expect(normalizeLanguage('objc')).toBe('objectivec');
  });

  it('未知语言应返回 plaintext', () => {
    expect(normalizeLanguage('unknown-lang')).toBe('plaintext');
  });
});

describe('highlightCode', () => {
  it('应高亮 C++ 代码', () => {
    const code = 'int main() { return 0; }';
    const result = highlightCode(code, 'cpp');
    expect(result).toContain('<span');  // 应包含高亮标签
    expect(result).not.toBe(code);       // 应被修改
  });

  it('未知语言应自动检测', () => {
    const code = 'function hello() {}';
    const result = highlightCode(code, 'unknown');
    expect(result).toContain('<span');
  });

  it('空字符串不应报错', () => {
    const result = highlightCode('', 'cpp');
    expect(result).toBe('');
  });
});

describe('isAsciiArt', () => {
  it('应识别 box-drawing 字符', () => {
    const code = '┌───┐\n│ A │\n└───┘';
    expect(isAsciiArt(code)).toBe(true);
  });

  it('不应误判普通代码', () => {
    const code = 'int x = 10;';
    expect(isAsciiArt(code)).toBe(false);
  });
});

describe('getSupportedLanguages', () => {
  it('应返回 28 种语言', () => {
    const langs = getSupportedLanguages();
    expect(langs.length).toBe(28);
    expect(langs).toContain('cpp');
    expect(langs).toContain('swift');
    expect(langs).toContain('python');
  });
});
```

### 6.2 复制按钮测试

| 测试项 | 操作 | 期望结果 |
|--------|------|---------|
| 点击复制 | 点击代码块复制按钮 | 剪贴板内容等于代码原始文本 |
| 复制反馈 | 点击后 | 按钮文字变为"已复制"，边框变绿 |
| 恢复状态 | 点击 2 秒后 | 按钮文字恢复为"复制"，样式还原 |
| 重复绑定 | 同一按钮多次 init | 仅绑定一次事件（data-copyBound 标记） |
| Tauri 失败降级 | Tauri clipboard 失败 | 回退到 navigator.clipboard |

### 6.3 行号测试

| 测试项 | 输入 | 期望结果 |
|--------|------|---------|
| 多行代码 | 10 行代码 | 左侧显示 1-10 行号 |
| 单行代码 | 1 行代码 | 不显示行号（避免浪费空间） |
| 主题切换 | 亮色→暗色 | 行号颜色跟随 text-muted 变量变化 |

### 6.4 ASCII 框图测试

| 测试项 | 输入 | 期望结果 |
|--------|------|---------|
| 框图检测 | 含 `┌─┐│` 的无语言代码块 | 添加 `.ascii-art` 类，line-height:1.2 |
| 普通代码 | 无 box-drawing 字符的代码 | 不添加特殊类，line-height:1.6 |
| 框线连续 | ASCII 框图渲染后 | box-drawing 字符连续无断裂 |

### 6.5 性能测试

| 指标 | 目标 | 测试方法 |
|------|------|---------|
| 代码块高亮 | < 10ms / 块 | 100 行代码块 `highlightCode()` |
| 批量高亮 | < 100ms（10 个块） | `highlightAllInContainer()` |
| 复制操作 | < 50ms | 点击到反馈 |
| bundle 体积 | highlight.js < 150KB（gzip） | 仅注册 28 种语言 |
