# F06-06 预览主组件

## 1. 功能描述与目标

本特性实现 `MarkdownPreview.vue` 主组件，组装完整的 Markdown 渲染管线。这是渲染引擎的**总装集成模块**，负责：

- 接收 Markdown 原始文本，通过四阶段渲染管线输出精美 HTML
- 协调各子模块（高亮、图片、Mermaid、KaTeX）的后处理
- 支持平滑滚动、渲染内容搜索（Ctrl/Cmd+F）
- 提供 TOC 数据生成接口
- 管理渲染生命周期（加载状态、错误处理、清理）
- 支持同步滚动所需的 `data-source-line` 映射

### 渲染管线四阶段（PRD 6.1）

```
Stage 1: markdown-it 核心解析 → HTML 字符串
Stage 2: DOM 注入 → 触发后处理钩子
Stage 3: 并行后处理（highlight.js / mermaid.js / 图片路径 / KaTeX）
Stage 4: CSS 主题 + 交互增强（复制按钮 / Lightbox / 外部链接拦截 / TOC）
```

## 2. 技术实现方案

### 2.1 文件位置

```
src/components/preview/MarkdownPreview.vue    # 预览主组件
src/composables/useMarkdownRenderer.ts        # 渲染管线 composable
```

### 2.2 MarkdownPreview.vue 组件

```vue
<!-- src/components/preview/MarkdownPreview.vue -->
<template>
  <div class="markdown-preview" ref="previewContainer">
    <!-- 加载状态 -->
    <div v-if="isLoading" class="preview-loading">
      <div class="loading-spinner"></div>
      <span>渲染中...</span>
    </div>

    <!-- 渲染内容 -->
    <article
      v-show="!isLoading"
      ref="contentRef"
      class="mk-body"
      v-html="renderedHtml"
    />

    <!-- TOC 浮动面板（由 F06-09 实现） -->
    <TableOfContents
      v-if="tocData.length > 0"
      :headings="tocData"
      @jump="onTocJump"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue';
import { createMarkdownIt } from '@/lib/markdownIt';
import { highlightAllInContainer } from '@/lib/highlighter';
import { initCopyButtons, addLineNumbers, detectAsciiArt, cleanupCopyButtons } from '@/components/preview/CodeBlock.vue';
import { useImageHandler } from '@/composables/useImageHandler';
import { processMermaidBlocks } from '@/lib/mermaidConfig';
import TableOfContents from './TableOfContents.vue';
import type { TocHeading } from '@/types/markdown';

// ==================== Props & Emits ====================

interface Props {
  /** Markdown 原始文本 */
  content: string;
  /** 当前文件路径（用于图片相对路径解析） */
  filePath: string;
  /** 是否启用同步滚动 source-line 映射 */
  enableSourceMap?: boolean;
  /** 是否显示行号 */
  showLineNumbers?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  enableSourceMap: false,
  showLineNumbers: true,
});

const emit = defineEmits<{
  /** 渲染完成事件 */
  (e: 'rendered'): void;
  /** 渲染错误事件 */
  (e: 'error', err: Error): void;
  /** TOC 数据更新 */
  (e: 'toc-update', headings: TocHeading[]): void;
}>();

// ==================== 状态 ====================

const previewContainer = ref<HTMLDivElement | null>(null);
const contentRef = ref<HTMLDivElement | null>(null);
const renderedHtml = ref('');
const isLoading = ref(false);
const tocData = ref<TocHeading[]>([]);

// 图片处理
const { lightboxRef, imageList, initImages, cleanupImages } = useImageHandler(props.filePath);

// 渲染取消标记
let renderCancelToken = 0;

// ==================== 核心渲染管线 ====================

async function renderPipeline(): Promise<void> {
  const token = ++renderCancelToken;
  isLoading.value = true;

  try {
    // ---------- Stage 1: markdown-it 核心解析 ----------
    const md = createMarkdownIt({
      baseDir: props.filePath,
      enableSourceMap: props.enableSourceMap,
      enableKatex: false,     // Phase 2 开启
      enableToc: false,       // Phase 2 开启
    });

    const html = md.render(props.content);

    // 检查取消
    if (token !== renderCancelToken) return;

    // ---------- Stage 2: DOM 注入 ----------
    renderedHtml.value = html;

    // 等待 DOM 更新
    await nextTick();

    // 检查取消
    if (token !== renderCancelToken) return;

    const container = contentRef.value;
    if (!container) return;

    // ---------- Stage 3: 并行后处理 ----------
    await Promise.all([
      // 3a: highlight.js 语法高亮
      processHighlighting(container),

      // 3b: Mermaid 图表渲染（Phase 2）
      // processMermaid(container),

      // 3c: KaTeX 公式渲染（Phase 2，已在 S1 完成）
      // 无需额外处理

      // 3d: 图片路径解析
      processImages(container),
    ]);

    // 检查取消
    if (token !== renderCancelToken) return;

    // ---------- Stage 4: 交互增强 ----------
    await applyEnhancements(container);

    // 检查取消
    if (token !== renderCancelToken) return;

    // 生成 TOC 数据
    tocData.value = extractHeadings(container);
    emit('toc-update', tocData.value);

    isLoading.value = false;
    emit('rendered');

    // 恢复滚动位置（编辑后重新渲染场景）
    restoreScrollState();

  } catch (err) {
    if (token !== renderCancelToken) return;
    isLoading.value = false;
    emit('error', err instanceof Error ? err : new Error(String(err)));
  }
}

// ---------- Stage 3a: 代码高亮 ----------
async function processHighlighting(container: HTMLElement): Promise<void> {
  highlightAllInContainer(container);
}

// ---------- Stage 3b: Mermaid 渲染（Phase 2）----------
async function processMermaid(container: HTMLElement): Promise<void> {
  // 由 F06-07 提供
  await processMermaidBlocks(container);
}

// ---------- Stage 3d: 图片处理 ----------
async function processImages(container: HTMLElement): Promise<void> {
  initImages(container);
}

// ---------- Stage 4: 交互增强 ----------
async function applyEnhancements(container: HTMLElement): Promise<void> {
  // 4.1: 代码块复制按钮
  await initCopyButtons(container);

  // 4.2: ASCII 框图检测
  detectAsciiArt(container);

  // 4.3: 行号显示
  if (props.showLineNumbers) {
    addLineNumbers(container);
  }

  // 4.4: 外部链接拦截
  interceptExternalLinks(container);

  // 4.5: 表格滚动容器包装
  wrapTables(container);

  // 4.6: 图片标题 caption
  addImageCaptions(container);
}

// ==================== 辅助函数 ====================

/**
 * 拦截外部链接，阻止 WebView 内导航，使用系统浏览器打开
 */
function interceptExternalLinks(container: HTMLElement): void {
  container.querySelectorAll<HTMLAnchorElement>('a.external-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const url = link.getAttribute('href');
      if (url) {
        // Phase 2: 通过 Tauri shell:open 在系统浏览器打开
        // open(url);
        window.open(url, '_blank');
      }
    });
  });
}

/**
 * 为 table 添加滚动容器
 */
function wrapTables(container: HTMLElement): void {
  container.querySelectorAll('table').forEach((table) => {
    if (table.parentElement?.classList.contains('table-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    table.parentNode?.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
}

/**
 * 为图片添加 caption（alt 文字）
 */
function addImageCaptions(container: HTMLElement): void {
  container.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    if (!img.alt || img.parentElement?.classList.contains('image-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'image-wrapper';

    const caption = document.createElement('div');
    caption.className = 'image-caption';
    caption.textContent = img.alt;

    img.parentNode?.insertBefore(wrapper, img);
    wrapper.appendChild(img);
    wrapper.appendChild(caption);
  });
}

/**
 * 提取标题生成 TOC 数据
 */
function extractHeadings(container: HTMLElement): TocHeading[] {
  const headings = container.querySelectorAll<HTMLHeadingElement>('h1, h2, h3, h4, h5, h6');
  return Array.from(headings).map((heading) => ({
    level: parseInt(heading.tagName[1]),
    text: heading.textContent?.replace('#', '').trim() || '',
    id: heading.id,
    offsetTop: heading.offsetTop,
  }));
}

/**
 * TOC 跳转处理
 */
function onTocJump(id: string): void {
  const element = contentRef.value?.querySelector(`#${CSS.escape(id)}`);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ==================== 生命周期 ====================

// 监听文件路径变化（图片解析基准目录）
watch(
  () => props.filePath,
  () => {
    if (props.content) renderPipeline();
  }
);

// 组件卸载时清理
onUnmounted(() => {
  renderCancelToken++;  // 取消正在进行的渲染
  if (contentRef.value) {
    cleanupCopyButtons(contentRef.value);
    cleanupImages(contentRef.value);
  }
});

// ==================== 滚动位置保持 ====================

/**
 * 滚动位置保持策略：
 * 1. 文件内容编辑后重新渲染时，保持用户当前阅读位置不变
 * 2. 切换文件时，恢复该文件上次记录的滚动位置（由 tabStore 提供）
 * 3. 使用比例定位作为 fallback（内容长度变化时按比例恢复）
 */

const savedScrollTop = ref(0);
const savedScrollHeight = ref(0);

/** 渲染前保存当前滚动状态 */
function saveScrollState() {
  const container = previewContainer.value;
  if (!container) return;
  savedScrollTop.value = container.scrollTop;
  savedScrollHeight.value = container.scrollHeight;
}

/** 渲染后恢复滚动位置 */
function restoreScrollState() {
  const container = previewContainer.value;
  if (!container) return;

  // 策略 A：如果内容长度未显著变化，直接恢复绝对位置
  const heightRatio = container.scrollHeight / (savedScrollHeight.value || 1);
  if (heightRatio > 0.8 && heightRatio < 1.2) {
    container.scrollTop = savedScrollTop.value;
  } else {
    // 策略 B：内容长度显著变化时，按比例恢复
    container.scrollTop = savedScrollTop.value * heightRatio;
  }
}

// 在渲染前保存滚动位置（当 content 变化但不是文件切换时）
watch(
  () => props.content,
  () => {
    saveScrollState();
    renderPipeline();
  },
  { immediate: true }
);

// 在渲染完成后恢复滚动位置
// 注：此逻辑已整合到 renderPipeline 的 Stage 4 之后
// 见下方 onRendered 事件处理

// ==================== 暴露方法 ====================

defineExpose({
  /** 滚动到指定标题 */
  scrollToHeading: onTocJump,
  /** 获取当前 TOC 数据 */
  getTocData: () => tocData.value,
  /** 重新渲染 */
  reRender: renderPipeline,
});
</script>

<style scoped>
.markdown-preview {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
}

.preview-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: var(--text-muted);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
```

### 2.3 useMarkdownRenderer Composable

```typescript
// src/composables/useMarkdownRenderer.ts

import { ref, computed } from 'vue';
import { createMarkdownIt } from '@/lib/markdownIt';
import type { TocHeading } from '@/types/markdown';

/**
 * Markdown 渲染 Composable
 * 提供渲染管线的核心逻辑，供 MarkdownPreview.vue 和其他组件复用
 */
export function useMarkdownRenderer() {
  const renderedHtml = ref('');
  const isRendering = ref(false);
  const renderError = ref<Error | null>(null);

  /**
   * 渲染 Markdown 文本为 HTML
   * @param content Markdown 原始文本
   * @param options 渲染选项
   */
  async function render(
    content: string,
    options: {
      baseDir?: string;
      enableSourceMap?: boolean;
      enableKatex?: boolean;
    } = {}
  ): Promise<string> {
    isRendering.value = true;
    renderError.value = null;

    try {
      const md = createMarkdownIt({
        baseDir: options.baseDir,
        enableSourceMap: options.enableSourceMap,
        enableKatex: options.enableKatex,
      });

      const html = md.render(content);
      renderedHtml.value = html;
      isRendering.value = false;
      return html;

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      renderError.value = error;
      isRendering.value = false;
      throw error;
    }
  }

  return {
    renderedHtml,
    isRendering,
    renderError,
    render,
  };
}

/**
 * 提取 TOC 标题数据
 * @param container 渲染容器 DOM
 */
export function extractTocHeadings(container: HTMLElement): TocHeading[] {
  const headings = container.querySelectorAll<HTMLHeadingElement>('h1, h2, h3, h4, h5, h6');
  return Array.from(headings).map((heading) => ({
    level: parseInt(heading.tagName[1]),
    text: heading.textContent?.replace('#', '').trim() || '',
    id: heading.id,
    offsetTop: heading.offsetTop,
  }));
}
```

### 2.4 渲染管线详细说明

#### Stage 1: markdown-it 核心解析

```
输入: 原始 Markdown 字符串
处理: tokenize → parse → render
插件链:
  ├── markdown-it-anchor      (标题锚点 id)
  ├── markdown-it-task-lists  (任务列表)
  └── 自定义渲染规则:
      ├── image    (相对路径 → asset://)
      ├── link_open (外部链接 target="_blank")
      └── fence    (mermaid 拦截 / 代码块增强)
输出: HTML 字符串
```

**性能要点**：markdown-it 的 `render()` 为同步操作，1000 行 Markdown 应在 50ms 内完成。

#### Stage 2: DOM 注入

```
输入: HTML 字符串
处理: v-html 注入渲染容器 → nextTick 等待 DOM 更新
输出: 已挂载的 DOM 树
```

**注意**：`v-html` 输出的 HTML 仅来自 markdown-it 的受控输出（`html: false` 已禁止原始 HTML），不存在 XSS 风险。

#### Stage 3: 并行后处理

```
输入: 已挂载的 DOM 树
并行处理:
  ├── Stage 3a: highlight.js
  │   查找所有 pre>code.hljs 元素
  │   调用 hljs.highlight() 注入高亮标签
  │
  ├── Stage 3b: mermaid.js (Phase 2)
  │   查找所有 .mermaid 容器
  │   调用 mermaid.render() 生成 SVG
  │   渲染失败 → 降级为代码块 + 错误提示
  │
  ├── Stage 3c: KaTeX (Phase 2)
  │   若 S1 未处理（如后处理模式）
  │   查找 $...$ / $$...$$ 文本，调用 katex.render()
  │
  └── Stage 3d: 图片路径
      解析相对路径为 asset://
      绑定加载错误处理
输出: 高亮/渲染后的 DOM 树
```

**性能要点**：使用 `Promise.all()` 并行执行各后处理任务，总时间取决于最慢的任务（通常是 Mermaid 图表渲染）。

#### Stage 4: CSS 主题 + 交互增强

```
输入: 后处理完成的 DOM 树
处理:
  ├── 4.1 代码块复制按钮事件绑定
  ├── 4.2 ASCII 框图检测与样式标记
  ├── 4.3 行号显示（可选）
  ├── 4.4 外部链接点击拦截 → 系统浏览器
  ├── 4.5 表格包裹滚动容器
  ├── 4.6 图片标题 caption 生成
  ├── 4.7 TOC 目录数据提取
  └── 4.8 同步滚动映射表构建 (F07-05)
输出: 完整可交互的渲染 DOM
```

### 2.5 渲染取消机制

为避免快速切换文件时渲染任务冲突，使用**取消令牌模式**：

```typescript
let renderCancelToken = 0;

async function renderPipeline(): Promise<void> {
  const token = ++renderCancelToken;
  // ... 渲染过程 ...
  // 每个异步点后检查
  if (token !== renderCancelToken) return;
}
```

当组件卸载或新渲染开始时，增加 `renderCancelToken`，使旧的渲染任务自动终止。

## 3. 接口定义

### 3.1 MarkdownPreview Props

```typescript
interface MarkdownPreviewProps {
  content: string;              // Markdown 原始文本（必填）
  filePath: string;             // 当前文件路径（必填）
  enableSourceMap?: boolean;    // 同步滚动 source-line（默认 false）
  showLineNumbers?: boolean;    // 显示行号（默认 true）
}
```

### 3.2 MarkdownPreview Emits

```typescript
interface MarkdownPreviewEmits {
  rendered(): void;                                    // 渲染完成
  error(err: Error): void;                             // 渲染错误
  tocUpdate(headings: TocHeading[]): void;             // TOC 数据更新
}
```

### 3.3 MarkdownPreview Expose

```typescript
interface MarkdownPreviewExpose {
  scrollToHeading(id: string): void;   // 滚动到指定标题
  getTocData(): TocHeading[];          // 获取 TOC 数据
  reRender(): Promise<void>;           // 重新渲染
}
```

### 3.4 TocHeading 类型

```typescript
interface TocHeading {
  level: number;       // 1-6
  text: string;        // 标题文本
  id: string;          // 锚点 id
  offsetTop: number;   // 相对于容器顶部的偏移（像素）
}
```

## 4. 数据结构

### 4.1 渲染管线状态机

```
[空闲] --content变化--> [Stage1解析] --同步完成--> [Stage2注入]
                                              --nextTick-->
[Stage3后处理] --Promise.all完成--> [Stage4增强] --完成--> [空闲]
                                              |
                                              --错误--> [错误]
```

### 4.2 渲染上下文

```typescript
interface RenderContext {
  content: string;           // 原始 Markdown
  filePath: string;          // 文件路径
  html: string;              // Stage 1 输出
  container: HTMLElement;    // Stage 2 输出
  cancelToken: number;       // 取消令牌
  tocHeadings: TocHeading[]; // Stage 4 输出
}
```

## 5. 依赖关系

### 5.1 依赖的上游模块

| 模块 | 特性 | 说明 |
|------|------|------|
| F01-02 | 前端基础配置 | Vue 3 / TypeScript / Vite |
| F06-01 | markdown-it 核心配置 | createMarkdownIt / renderMarkdown |
| F06-02 | 基础元素渲染样式 | .mk-body 容器样式 |
| F06-03 | 代码块渲染 | highlightAllInContainer / initCopyButtons |
| F06-04 | 表格渲染 | wrapTables 函数 |
| F06-05 | 图片处理 | useImageHandler |
| F06-07 | Mermaid 图表 | processMermaidBlocks（Phase 2）|
| F06-08 | KaTeX 公式 | markdown-it-katex 插件（Phase 2）|
| F06-09 | TOC 目录大纲 | TableOfContents 组件 |
| F08-01 | CSS 变量主题系统 | 主题样式 |

### 5.2 下游依赖本模块

| 模块 | 特性 | 说明 |
|------|------|------|
| F05-01 | 单文件展示 | 在内容区挂载 MarkdownPreview |
| F05-02 | 多标签页 | 每个标签页独立渲染实例 |
| F07-02 | 模式切换 | Preview 模式下使用本组件 |
| F07-05 | 分屏同步滚动 | enableSourceMap 添加 data-source-line |
| F06-10 | 渲染缓存 | 缓存 render() 输出结果 |

### 5.3 npm 依赖

```json
{
  "dependencies": {
    "vue": "^3.4.0",
    "markdown-it": "^14.0.0"
  }
}
```

## 6. 测试要点

### 6.1 渲染管线集成测试

```typescript
// tests/components/MarkdownPreview.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import MarkdownPreview from '@/components/preview/MarkdownPreview.vue';

describe('MarkdownPreview', () => {
  it('应正确渲染标题', async () => {
    const wrapper = mount(MarkdownPreview, {
      props: { content: '# 标题\n\n正文', filePath: '/test.md' },
    });
    await vi.waitFor(() => wrapper.find('h1').exists());
    expect(wrapper.find('h1').text()).toContain('标题');
  });

  it('应触发 rendered 事件', async () => {
    const onRendered = vi.fn();
    const wrapper = mount(MarkdownPreview, {
      props: { content: '# 测试', filePath: '/test.md' },
      attrs: { onRendered },
    });
    await vi.waitFor(() => onRendered.mock.calls.length > 0);
    expect(onRendered).toHaveBeenCalled();
  });

  it('应为标题生成锚点 id', async () => {
    const wrapper = mount(MarkdownPreview, {
      props: { content: '# 锚点测试', filePath: '/test.md' },
    });
    await vi.waitFor(() => wrapper.find('h1').exists());
    expect(wrapper.find('h1').attributes('id')).toBeTruthy();
  });

  it('应正确处理代码块', async () => {
    const wrapper = mount(MarkdownPreview, {
      props: { content: '```cpp\nint x;\n```', filePath: '/test.md' },
    });
    await vi.waitFor(() => wrapper.find('.code-block-wrapper').exists());
    expect(wrapper.find('.code-lang').text()).toBe('cpp');
  });

  it('应生成 TOC 数据', async () => {
    const wrapper = mount(MarkdownPreview, {
      props: { content: '# H1\n## H2\n### H3', filePath: '/test.md' },
    });
    await vi.waitFor(() => wrapper.emitted('toc-update'));
    const tocData = wrapper.emitted('toc-update')![0][0] as any[];
    expect(tocData).toHaveLength(3);
    expect(tocData[0].level).toBe(1);
    expect(tocData[1].level).toBe(2);
  });

  it('应取消过期的渲染', async () => {
    const wrapper = mount(MarkdownPreview, {
      props: { content: '# 初始', filePath: '/test.md' },
    });
    // 快速切换内容
    await wrapper.setProps({ content: '# 新内容' });
    // 旧渲染应被取消，不应产生冲突
    expect(wrapper.find('h1').text()).toContain('新内容');
  });
});
```

### 6.2 性能测试

| 指标 | 目标 | 测试方法 |
|------|------|---------|
| 完整渲染 1000 行 | < 150ms（含后处理）| performance.now() 测量 renderPipeline |
| 完整渲染 5000 行 | < 600ms | 大文件测试 |
| DOM 更新后响应 | < 16ms | nextTick 到交互可用 |
| 内存泄漏 | 无 | 多次切换文件后 Memory 面板检查 |
| 取消机制 | 正确终止 | 快速切换 10 次，无错误 |

### 6.3 安全测试

| 测试项 | 输入 | 期望结果 |
|--------|------|---------|
| XSS 注入 | `<script>alert(1)</script>` | 转义显示，不执行 |
| 外部链接拦截 | `[链接](https://evil.com)` | 点击后通过系统浏览器打开 |
| 图片路径安全 | `../../../etc/passwd` | Tauri Scope 限制访问 |

### 6.4 兼容性测试

| 测试项 | 验证 |
|--------|------|
| 空内容 | 不报错，显示空白 |
| 纯文本 | 正确包裹为段落 |
| 特殊字符 | 中文、emoji、数学符号正确渲染 |
| 嵌套元素 | 列表内代码块、引用内表格等 |
