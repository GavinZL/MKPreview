# F06-10 渲染缓存与性能优化

## 1. 功能描述与目标

本特性实现 Markdown 渲染结果的缓存机制和大文件性能优化，覆盖 PRD NFR-001 性能指标和 6.3 节优化策略：

- **渲染结果缓存**：维护 `Map<filePath, {contentHash, html}>` 缓存，文件内容未变化时直接复用 HTML，跳过解析和后处理
- **大文件分片渲染**：超过 3000 行的文件，先渲染前 100 个 block-level token，再用 `requestIdleCallback` 渐进渲染
- **Mermaid 懒渲染**：使用 `IntersectionObserver` 仅渲染进入视口的图表块
- **Web Worker 解析**（可选）：markdown-it 的 tokenize + render 在 Web Worker 中执行，避免阻塞主线程

### 性能目标

| 指标 | 目标值 | 场景 |
|------|--------|------|
| 普通文件渲染 | < 100ms | 1000 行 Markdown |
| 大文件渲染 | < 500ms | 5000 行 Markdown |
| 缓存命中 | < 10ms | 文件未修改时复用 |
| 模式切换 | < 150ms | 任意模式切换无闪烁 |

## 2. 技术实现方案

### 2.1 文件位置

```
src/lib/renderCache.ts                    # 渲染缓存管理
src/composables/useIncrementalRender.ts   # 增量渲染 composable
```

### 2.2 渲染缓存管理

```typescript
// src/lib/renderCache.ts

import { createHash } from 'crypto';

/**
 * 缓存条目
 */
interface CacheEntry {
  /** 内容哈希 */
  contentHash: string;
  /** 渲染后的 HTML */
  html: string;
  /** TOC 数据 */
  tocData: TocHeading[];
  /** 缓存时间戳 */
  timestamp: number;
}

/**
 * 渲染缓存管理器
 * 单例模式，全局共享
 */
class RenderCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }

  /**
   * 计算内容哈希（简化版，生产环境可用更高效的算法）
   * @param content Markdown 原始文本
   */
  private computeHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;  // 转为 32bit 整数
    }
    return hash.toString(16);
  }

  /**
   * 获取缓存
   * @param filePath 文件路径
   * @param content 当前文件内容
   * @returns 缓存条目或 null
   */
  get(filePath: string, content: string): CacheEntry | null {
    const entry = this.cache.get(filePath);
    if (!entry) return null;

    const contentHash = this.computeHash(content);
    if (entry.contentHash !== contentHash) {
      // 内容已变化，删除旧缓存
      this.cache.delete(filePath);
      return null;
    }

    return entry;
  }

  /**
   * 设置缓存
   * @param filePath 文件路径
   * @param content 文件内容（用于计算哈希）
   * @param html 渲染后的 HTML
   * @param tocData TOC 数据
   */
  set(filePath: string, content: string, html: string, tocData: TocHeading[]): void {
    // LRU：如果达到上限，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.entries().next().value;
      if (oldest) {
        this.cache.delete(oldest[0]);
      }
    }

    const contentHash = this.computeHash(content);
    this.cache.set(filePath, {
      contentHash,
      html,
      tocData,
      timestamp: Date.now(),
    });
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计
   */
  getStats(): { size: number; maxSize: number } {
    return { size: this.cache.size, maxSize: this.maxSize };
  }
}

// 导出单例实例
export const renderCache = new RenderCache(50);

/**
 * 尝试从缓存获取渲染结果
 * @param filePath 文件路径
 * @param content 当前内容
 * @returns 缓存的 HTML 和 TOC 数据，或 null
 */
export function getCachedRender(
  filePath: string,
  content: string
): { html: string; tocData: TocHeading[] } | null {
  const entry = renderCache.get(filePath, content);
  if (!entry) return null;

  return {
    html: entry.html,
    tocData: entry.tocData,
  };
}

/**
   * 将渲染结果存入缓存
   * @param filePath 文件路径
   * @param content 文件内容
   * @param html 渲染后的 HTML
   * @param tocData TOC 数据
   */
export function setCachedRender(
  filePath: string,
  content: string,
  html: string,
  tocData: TocHeading[]
): void {
  renderCache.set(filePath, content, html, tocData);
}
```

### 2.3 增量渲染（大文件优化）

```typescript
// src/composables/useIncrementalRender.ts

import { ref, nextTick } from 'vue';
import MarkdownIt from 'markdown-it';

/**
 * 增量渲染状态
 */
interface IncrementalRenderState {
  isComplete: boolean;
  renderedCount: number;
  totalCount: number;
}

/**
 * 大文件增量渲染 Composable
 * @param threshold 启用增量渲染的行数阈值（默认 3000）
 * @param initialTokens 首次渲染的 token 数量（默认 100）
 */
export function useIncrementalRender(threshold: number = 3000, initialTokens: number = 100) {
  const state = ref<IncrementalRenderState>({
    isComplete: true,
    renderedCount: 0,
    totalCount: 0,
  });

  /**
   * 检查是否需要增量渲染
   * @param content Markdown 内容
   */
  function needsIncremental(content: string): boolean {
    const lineCount = content.split('\n').length;
    return lineCount > threshold;
  }

  /**
   * 执行增量渲染
   * @param content Markdown 内容
   * @param md markdown-it 实例
   * @param container 渲染容器
   */
  async function renderIncremental(
    content: string,
    md: MarkdownIt,
    container: HTMLElement
  ): Promise<string> {
    if (!needsIncremental(content)) {
      // 小文件直接渲染
      state.value.isComplete = true;
      return md.render(content);
    }

    state.value.isComplete = false;

    // 解析 token（不渲染全部）
    const tokens = md.parse(content, {});
    state.value.totalCount = tokens.length;

    // 第一阶段：渲染前 initialTokens 个 token
    const initialBatch = tokens.slice(0, initialTokens);
    const initialHtml = md.renderer.render(initialBatch, md.options, {});
    state.value.renderedCount = initialBatch.length;

    // 注入第一阶段 HTML
    container.innerHTML = `<article class="mk-body">${initialHtml}</article>`;

    // 第二阶段：使用 requestIdleCallback 渐进渲染剩余 token
    const remainingTokens = tokens.slice(initialTokens);
    await renderRemainingTokens(md, remainingTokens, container);

    state.value.isComplete = true;
    return container.innerHTML;
  }

  /**
   * 渐进渲染剩余 token
   */
  function renderRemainingTokens(
    md: MarkdownIt,
    tokens: MarkdownIt.Token[],
    container: HTMLElement
  ): Promise<void> {
    return new Promise((resolve) => {
      const batchSize = 50;  // 每批渲染 50 个 token
      let index = 0;

      function renderBatch(deadline?: IdleDeadline): void {
        const hasTime = deadline ? deadline.timeRemaining() > 5 : true;

        while (index < tokens.length && (hasTime || index === 0)) {
          const batch = tokens.slice(index, index + batchSize);
          const batchHtml = md.renderer.render(batch, md.options, {});

          // 追加到现有内容
          const mkBody = container.querySelector('.mk-body');
          if (mkBody) {
            mkBody.insertAdjacentHTML('beforeend', batchHtml);
          }

          index += batch.length;
          state.value.renderedCount += batch.length;

          // 每批次后让出主线程
          if (index < tokens.length && !hasTime) break;
        }

        if (index < tokens.length) {
          // 还有剩余，继续调度
          if ('requestIdleCallback' in window) {
            requestIdleCallback(renderBatch, { timeout: 100 });
          } else {
            setTimeout(() => renderBatch(), 16);
          }
        } else {
          resolve();
        }
      }

      if ('requestIdleCallback' in window) {
        requestIdleCallback(renderBatch, { timeout: 100 });
      } else {
        setTimeout(() => renderBatch(), 0);
      }
    });
  }

  return {
    state,
    needsIncremental,
    renderIncremental,
  };
}
```

### 2.4 MarkdownPreview.vue 中集成缓存

```typescript
// 修改后的渲染管线，加入缓存检查

import { getCachedRender, setCachedRender } from '@/lib/renderCache';
import { useIncrementalRender } from '@/composables/useIncrementalRender';

const { state: incrementalState, needsIncremental, renderIncremental } = useIncrementalRender();

async function renderPipeline(): Promise<void> {
  const token = ++renderCancelToken;
  isLoading.value = true;

  try {
    // ---------- 缓存检查 ----------
    const cached = getCachedRender(props.filePath, props.content);
    if (cached) {
      // 缓存命中，直接使用
      renderedHtml.value = cached.html;
      tocData.value = cached.tocData;
      await nextTick();

      // 仍需执行交互增强（复制按钮等）
      const container = contentRef.value;
      if (container) {
        await applyEnhancements(container);
      }

      isLoading.value = false;
      emit('rendered');
      return;
    }

    // ---------- Stage 1: markdown-it 解析 ----------
    const md = createMarkdownIt({
      baseDir: props.filePath,
      enableSourceMap: props.enableSourceMap,
    });

    // ---------- 增量渲染或普通渲染 ----------
    let html: string;
    const container = contentRef.value;

    if (needsIncremental(props.content) && container) {
      html = await renderIncremental(props.content, md, container);
    } else {
      html = md.render(props.content);
      renderedHtml.value = html;
      await nextTick();
    }

    if (token !== renderCancelToken) return;

    // ---------- Stage 3 & 4: 后处理和增强 ----------
    const finalContainer = contentRef.value;
    if (finalContainer) {
      await Promise.all([
        processHighlighting(finalContainer),
        processImages(finalContainer),
      ]);
      await applyEnhancements(finalContainer);
    }

    if (token !== renderCancelToken) return;

    // ---------- 缓存结果 ----------
    tocData.value = extractHeadings(finalContainer!);
    setCachedRender(props.filePath, props.content, renderedHtml.value, tocData.value);

    isLoading.value = false;
    emit('rendered');

  } catch (err) {
    if (token !== renderCancelToken) return;
    isLoading.value = false;
    emit('error', err instanceof Error ? err : new Error(String(err)));
  }
}
```

### 2.5 Web Worker 解析（可选优化）

```typescript
// src/workers/markdown.worker.ts

import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import taskLists from 'markdown-it-task-lists';

// Worker 内创建 markdown-it 实例
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
});

md.use(anchor, { permalink: false });
md.use(taskLists);

self.onmessage = (event) => {
  const { content, id } = event.data;
  const html = md.render(content);
  self.postMessage({ html, id });
};

// src/lib/markdownWorker.ts

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/markdown.worker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return worker;
}

export function renderInWorker(content: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = Date.now();
    const w = getWorker();

    function onMessage(e: MessageEvent) {
      if (e.data.id === id) {
        w.removeEventListener('message', onMessage);
        resolve(e.data.html);
      }
    }

    w.addEventListener('message', onMessage);
    w.postMessage({ content, id });

    // 超时处理
    setTimeout(() => {
      w.removeEventListener('message', onMessage);
      reject(new Error('Worker 渲染超时'));
    }, 5000);
  });
}
```

## 3. 接口定义

### 3.1 缓存管理

```typescript
// 尝试从缓存获取
export function getCachedRender(
  filePath: string,
  content: string
): { html: string; tocData: TocHeading[] } | null;

// 存入缓存
export function setCachedRender(
  filePath: string,
  content: string,
  html: string,
  tocData: TocHeading[]
): void;

// 清空缓存
export function clearRenderCache(): void;
```

### 3.2 增量渲染

```typescript
export function useIncrementalRender(
  threshold?: number,
  initialTokens?: number
): {
  state: Ref<IncrementalRenderState>;
  needsIncremental: (content: string) => boolean;
  renderIncremental: (content: string, md: MarkdownIt, container: HTMLElement) => Promise<string>;
};
```

### 3.3 Web Worker

```typescript
export function renderInWorker(content: string): Promise<string>;
```

## 4. 数据结构

### 4.1 CacheEntry

```typescript
interface CacheEntry {
  contentHash: string;    // 内容哈希值
  html: string;           // 渲染后的 HTML
  tocData: TocHeading[];  // TOC 数据
  timestamp: number;      // 缓存时间戳
}
```

### 4.2 IncrementalRenderState

```typescript
interface IncrementalRenderState {
  isComplete: boolean;     // 是否完成全部渲染
  renderedCount: number;   // 已渲染 token 数
  totalCount: number;      // 总 token 数
}
```

## 5. 依赖关系

### 5.1 依赖的上游模块

| 模块 | 特性 | 说明 |
|------|------|------|
| F01-02 | 前端基础配置 | TypeScript / Vite（Vite 原生支持 Web Worker）|
| F06-01 | markdown-it 核心配置 | tokenize / render API |
| F06-06 | 预览主组件 | 集成缓存检查和增量渲染 |

### 5.2 下游依赖本模块

| 模块 | 特性 | 说明 |
|------|------|------|
| F06-06 | 预览主组件 | 调用缓存和增量渲染 |
| F02-03 | 文件系统监控 | 文件修改时清空对应文件缓存 |

### 5.3 npm 依赖

无额外依赖。Web Worker 使用 Vite 原生支持。

## 6. 测试要点

### 6.1 缓存测试

```typescript
// tests/lib/renderCache.spec.ts
import { describe, it, expect } from 'vitest';
import { getCachedRender, setCachedRender, clearRenderCache } from '@/lib/renderCache';

describe('renderCache', () => {
  beforeEach(() => {
    clearRenderCache();
  });

  it('未缓存时应返回 null', () => {
    const result = getCachedRender('/test.md', '# Hello');
    expect(result).toBeNull();
  });

  it('缓存后应返回缓存内容', () => {
    setCachedRender('/test.md', '# Hello', '<h1>Hello</h1>', []);
    const result = getCachedRender('/test.md', '# Hello');
    expect(result).not.toBeNull();
    expect(result!.html).toBe('<h1>Hello</h1>');
  });

  it('内容变化后缓存应失效', () => {
    setCachedRender('/test.md', '# Hello', '<h1>Hello</h1>', []);
    const result = getCachedRender('/test.md', '# World');
    expect(result).toBeNull();
  });

  it('应限制缓存大小', () => {
    // 测试 LRU 淘汰
    for (let i = 0; i < 60; i++) {
      setCachedRender(`/file${i}.md`, `content${i}`, `<h1>${i}</h1>`, []);
    }
    const stats = renderCache.getStats();
    expect(stats.size).toBeLessThanOrEqual(stats.maxSize);
  });
});
```

### 6.2 增量渲染测试

| 测试项 | 输入 | 期望结果 |
|--------|------|---------|
| 小文件 | 500 行 Markdown | 直接渲染，不使用增量 |
| 大文件 | 5000 行 Markdown | 先渲染前 100 token，再渐进完成 |
| 渐进完成 | 大文件 | 最终 HTML 与直接渲染一致 |
| 取消 | 切换文件 | 增量渲染正确终止 |

### 6.3 性能测试

| 指标 | 目标 | 测试方法 |
|------|------|---------|
| 缓存命中 | < 10ms | 相同文件重复渲染 |
| 缓存未命中 | 正常渲染时间 | 修改后首次渲染 |
| 增量首屏 | < 100ms | 大文件首次可见内容 |
| 增量完成 | < 500ms | 大文件全部渲染完成 |
| 内存占用 | 缓存 < 50MB | 50 个文件缓存 |
