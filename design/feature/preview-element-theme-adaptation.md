# F09-03 预览区元素主题完整适配方案

## 1. 功能描述与目标

**功能描述**：完善预览区主题系统，确保所有 Markdown 元素（表格、代码块、Mermaid 图表、KaTeX 公式等）在切换亮色/暗色主题时都能正确适配，实现完整的三层主题叠加模型。

**目标**：
- 验证并修复表格、代码块、引用块等基础元素的主题适配（通过 CSS 变量自动实现）
- 修复 Mermaid 图表主题切换功能，实现动态重渲染机制
- 可选增强：KaTeX 公式和图片的暗色模式适配
- 确保主题切换流畅，无闪烁或延迟

**PRD 关联**：FR-007.1 ~ FR-007.3（主题与外观）、F06-07 Mermaid 图表渲染、F08-01 CSS 变量主题系统

---

## 2. 技术实现方案

### 2.1 现状分析

#### 2.1.1 已自动适配的元素（✅ 无需修改）

以下元素已通过 CSS 变量实现主题适配，切换 `data-theme` 属性时自动生效：

| 元素 | CSS 文件 | 适配方式 |
|------|---------|---------|
| 表格（Table） | `table.css` | 使用 `var(--bg-primary)`、`var(--bg-secondary)`、`var(--border)` |
| 代码块（Code Blocks） | `code.css` | 背景使用 `var(--bg-code)`，高亮定义亮/暗两套 |
| 引用块（Blockquote） | `base.css` | 使用 `var(--accent)`、`var(--bg-secondary)` |
| 标题（Headings） | `base.css` | 使用 `var(--text-primary)`、`var(--border)`、`var(--accent-red)` |
| 段落与列表 | `base.css` | 使用 `var(--text-primary)`、`var(--text-secondary)` |
| 链接（Links） | `base.css` | 使用 `var(--text-link)` |
| 行内代码 | `base.css` | 使用 `var(--bg-code)`、`var(--accent-red)` |

#### 2.1.2 需要修复的元素（⚠️ 需要修改）

| 元素 | 问题 | 解决方案 |
|------|------|---------|
| Mermaid 图表 | 配置项 `suppressErrorRendering` 已废弃，主题切换后未重渲染 | 移除废弃配置，添加容器跟踪和重渲染逻辑 |
| KaTeX 公式 | 默认使用黑色文字，暗色模式下对比度低 | 添加 `filter: invert()` 或配置暗色主题 |
| 图片 | 暗色模式下可能过亮刺眼 | 可选：添加 `brightness()` 滤镜 |

### 2.2 Mermaid 主题适配修复

#### 问题根因

`mermaid-render.md` 第 66 行使用了已废弃的配置项：
```typescript
suppressErrorRendering: true, // Mermaid v10.x 已移除此配置
```

这导致：
1. Mermaid 初始化时可能忽略此配置或报错
2. 主题切换时调用 `initMermaid()` 重新初始化，但已渲染的图表不会自动更新
3. DOM 中已有的 SVG 仍然使用旧主题的颜色

#### 解决方案：动态重渲染机制

**核心思路**：
1. 跟踪所有已渲染的 Mermaid 容器及其原始定义
2. 主题切换时，重新初始化 Mermaid 配置
3. 批量重新渲染所有已存在的图表

**实现细节**：

```typescript
// src/lib/mermaidConfig.ts 增强

import mermaid from 'mermaid';

// 当前主题状态
let currentTheme: 'light' | 'dark' = 'dark';

// 跟踪所有已渲染的 Mermaid 容器
const renderedContainers = new Map<string, { 
  container: HTMLElement; 
  definition: string;
}>();

/**
 * 初始化 mermaid.js
 * @param appTheme 应用当前主题
 */
export function initMermaid(appTheme: 'light' | 'dark'): void {
  currentTheme = appTheme;

  mermaid.initialize({
    // === 安全配置 ===
    securityLevel: 'strict',      // 禁止 HTML/脚本，防止 XSS
    maxTextSize: 50000,           // 限制文本大小，防止 DoS
    maxEdges: 500,                // 限制边数

    // === 主题配置 ===
    theme: appTheme === 'dark' ? 'dark' : 'default',

    // === 渲染配置 ===
    startOnLoad: false,           // 禁用自动渲染，由我们手动控制
    // 注意：suppressErrorRendering 已在 Mermaid v10.x 移除

    // === 字体配置 ===
    fontFamily: 'var(--font-mono)',

    // === 流程图配置 ===
    flowchart: {
      useMaxWidth: true,
      htmlLabels: false,          // strict 模式下必须为 false
      curve: 'basis',
    },

    // === 序列图配置 ===
    sequence: {
      useMaxWidth: true,
      diagramMarginX: 50,
      diagramMarginY: 10,
    },

    // === 类图配置 ===
    class: {
      useMaxWidth: true,
    },

    // === 甘特图配置 ===
    gantt: {
      useMaxWidth: true,
    },
  });
}

/**
 * 切换 mermaid 主题并重新渲染所有图表
 * @param appTheme 应用当前主题
 */
export async function setMermaidTheme(appTheme: 'light' | 'dark'): Promise<void> {
  if (appTheme === currentTheme) return;
  currentTheme = appTheme;

  // 重新初始化 mermaid 配置
  initMermaid(appTheme);

  // 重新渲染所有已存在的图表
  await rerenderAllDiagrams();
}

/**
 * 重新渲染所有已跟踪的图表
 */
async function rerenderAllDiagrams(): Promise<void> {
  if (renderedContainers.size === 0) return;

  console.log(`[mermaid] 开始重渲染 ${renderedContainers.size} 个图表`);

  const promises = Array.from(renderedContainers.entries()).map(
    async ([id, { container, definition }]) => {
      try {
        const svg = await renderMermaidDiagram(id, definition);
        container.innerHTML = svg;
        container.dataset.rendered = 'true';
      } catch (err) {
        console.error(`[mermaid] 重渲染失败 (${id}):`, err);
        // 保留错误状态标记
        container.dataset.rendered = 'error';
      }
    }
  );

  // 使用 Promise.all 并行渲染，提升性能
  await Promise.all(promises);
  
  console.log('[mermaid] 所有图表重渲染完成');
}

/**
 * 渲染单个 mermaid 图表
 * @param id 唯一标识符（用于 SVG ID）
 * @param definition Mermaid 图表定义文本
 * @returns 渲染后的 SVG 字符串
 */
export async function renderMermaidDiagram(
  id: string,
  definition: string
): Promise<string> {
  try {
    const result = await mermaid.render(id, definition.trim());
    return result.svg;
  } catch (err) {
    console.error(`[mermaid] 渲染失败 (${id}):`, err);
    throw err;
  }
}

/**
 * 处理渲染容器内所有 mermaid 代码块
 * @param container 渲染容器 DOM
 */
export async function processMermaidBlocks(container: HTMLElement): Promise<void> {
  const mermaidDivs = container.querySelectorAll<HTMLDivElement>('.mermaid');

  if (mermaidDivs.length === 0) return;

  // 确保 mermaid 已初始化
  initMermaid(currentTheme);

  const renderPromises = Array.from(mermaidDivs).map(async (div, index) => {
    // 跳过已渲染的元素
    if (div.dataset.rendered === 'true') return;

    const definition = div.textContent || '';
    if (!definition.trim()) return;

    const id = `mermaid-${Date.now()}-${index}`;

    try {
      const svg = await renderMermaidDiagram(id, definition);
      div.innerHTML = svg;
      div.dataset.rendered = 'true';
      
      // 注册到跟踪列表，供主题切换时重渲染
      renderedContainers.set(id, { container: div, definition });
    } catch (err) {
      // 降级为代码块 + 错误提示
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      div.innerHTML = `
        <div class="mermaid-error">
          <div class="error-title">⚠️ Mermaid 渲染失败</div>
          <pre>${escapeHtml(errorMessage)}</pre>
        </div>
      `;
      div.dataset.rendered = 'error';
    }
  });

  await Promise.all(renderPromises);
}

/**
 * 清理指定容器内的图表跟踪记录（防止内存泄漏）
 * @param container 渲染容器 DOM
 */
export function cleanupMermaidObservers(container: HTMLElement): void {
  const mermaidDivs = container.querySelectorAll<HTMLDivElement>('.mermaid');
  
  mermaidDivs.forEach((div) => {
    // 查找并删除对应的跟踪记录
    for (const [id, { container: trackedContainer }] of renderedContainers.entries()) {
      if (trackedContainer === div) {
        renderedContainers.delete(id);
        break;
      }
    }
  });
}

/**
 * 清理所有图表跟踪记录（用于组件卸载时）
 */
export function clearAllRenderedContainers(): void {
  renderedContainers.clear();
}

/**
 * HTML 转义辅助函数
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Phase 3: 使用 IntersectionObserver 懒渲染 mermaid 图表
 * @param container 渲染容器 DOM
 */
export function setupLazyMermaidRendering(container: HTMLElement): void {
  if (!('IntersectionObserver' in window)) {
    // 浏览器不支持则直接渲染
    processMermaidBlocks(container);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const div = entry.target as HTMLDivElement;
          if (div.dataset.rendered === 'true') return;

          const definition = div.textContent || '';
          const id = `mermaid-lazy-${Date.now()}`;

          renderMermaidDiagram(id, definition)
            .then((svg) => {
              div.innerHTML = svg;
              div.dataset.rendered = 'true';
              
              // 注册到跟踪列表
              renderedContainers.set(id, { container: div, definition });
            })
            .catch((err) => {
              div.innerHTML = `
                <div class="mermaid-error">
                  <div class="error-title">⚠️ Mermaid 渲染失败</div>
                  <pre>${escapeHtml(err.message)}</pre>
                </div>
              `;
              div.dataset.rendered = 'error';
            });

          observer.unobserve(div);
        }
      });
    },
    {
      root: container,
      rootMargin: '100px',  // 提前 100px 开始渲染
      threshold: 0.1,
    }
  );

  container.querySelectorAll('.mermaid').forEach((div) => {
    observer.observe(div);
  });
}
```

### 2.3 KaTeX 暗色模式适配

KaTeX 默认使用黑色文字渲染公式，在暗色模式下对比度不足。采用 CSS `filter` 方案：

```css
/* src/assets/styles/markdown/base.css 增强 */

/* KaTeX 暗色模式适配 */
[data-theme="dark"] .mk-body .katex {
  /* 反转颜色并调整色相，使黑色文字变为浅色 */
  filter: invert(0.85) hue-rotate(180deg);
}

[data-theme="dark"] .mk-body .katex-display {
  /* 块级公式添加背景色块 */
  background: var(--bg-secondary);
  border-radius: 4px;
  padding: 1em;
}
```

**注意事项**：
- `filter: invert(0.85)` 不会完全反转，保留部分原始颜色
- `hue-rotate(180deg)` 补偿色相偏移，使彩色公式保持正确色调
- 如果公式包含特殊颜色，可能需要手动调整参数

### 2.4 图片暗色模式优化（可选）

暗色模式下，明亮的图片可能显得刺眼。添加柔和的亮度调整：

```css
/* src/assets/styles/markdown/base.css 增强 */

/* 图片暗色模式优化 */
[data-theme="dark"] .mk-body img {
  /* 降低亮度，提升对比度 */
  filter: brightness(0.85) contrast(1.1);
  transition: filter 0.3s ease;
}

[data-theme="dark"] .mk-body img:hover {
  /* 悬浮时恢复正常 */
  filter: brightness(1) contrast(1);
}
```

---

## 3. 接口定义

### 3.1 mermaidConfig.ts 新增/修改的接口

```typescript
// src/lib/mermaidConfig.ts

/**
 * 切换 mermaid 主题并重新渲染所有图表
 * @param appTheme 应用当前主题
 */
export async function setMermaidTheme(appTheme: 'light' | 'dark'): Promise<void>;

/**
 * 清理指定容器内的图表跟踪记录（防止内存泄漏）
 * @param container 渲染容器 DOM
 */
export function cleanupMermaidObservers(container: HTMLElement): void;

/**
 * 清理所有图表跟踪记录（用于组件卸载时）
 */
export function clearAllRenderedContainers(): void;
```

### 3.2 useTheme.ts 扩展

```typescript
// src/composables/useTheme.ts

import { setMermaidTheme } from '@/lib/mermaidConfig';

function applyTheme(theme: ResolvedTheme) {
  document.documentElement.setAttribute('data-theme', theme)
  resolvedTheme.value = theme
  
  // 同步 Mermaid 主题
  setMermaidTheme(theme)
}
```

---

## 4. 数据结构

### 4.1 Mermaid 容器跟踪表

```typescript
interface RenderedContainerMap {
  [containerId: string]: {
    container: HTMLElement;    // DOM 元素引用
    definition: string;        // 原始 Mermaid 定义文本
  }
}
```

### 4.2 主题切换状态机

```
当前主题: light
    │
    ├──► 用户切换为 dark
    │    ├──► 更新 data-theme="dark"
    │    ├──► 调用 setMermaidTheme('dark')
    │    │    ├──► 重新初始化 mermaid 配置（theme: 'dark'）
    │    │    └──► 批量重渲染所有已跟踪的图表
    │    └──► CSS 变量自动更新（表格、代码块等）
    │
    └──► 系统主题变化（prefers-color-scheme: dark）
         └──► 同上流程
```

---

## 5. 依赖关系

| 依赖模块 | 特性 | 说明 |
|---------|------|------|
| F08-01 | CSS 变量主题系统 | 表格、代码块等元素依赖全局 CSS 变量 |
| F06-07 | Mermaid 图表渲染 | Mermaid 主题切换依赖此模块 |
| F06-06 | 预览主组件 | 调用 `processMermaidBlocks()` 和 `cleanupMermaidObservers()` |
| F08-02 | 主题切换 | 触发 `setMermaidTheme()` |

**被依赖**：
- F09-01 预览区颜色主题系统（Mermaid 图表作为预览区元素）
- F09-02 预览风格模板系统（主题适配与模板正交）

---

## 6. 测试要点

### 6.1 Mermaid 主题切换测试

| 测试项 | 操作步骤 | 期望结果 |
|--------|---------|---------|
| 单次图表渲染 | 加载含 Mermaid 图表的 Markdown | 图表正确渲染，颜色符合当前主题 |
| 主题切换 | 从 light 切换到 dark | Mermaid 图表节点背景变深色，文字变浅色，连线变浅色 |
| 多图表切换 | 含 5+ 个 Mermaid 图表的文档 | 所有图表同时更新，无遗漏 |
| 错误降级 | 加载语法错误的 Mermaid | 显示错误提示框，不影响其他图表 |
| 内存泄漏 | 打开/关闭多个含 Mermaid 的文档 | `renderedContainers` 大小正确清理 |

### 6.2 其他元素主题适配验证

| 元素 | 亮色模式验证 | 暗色模式验证 |
|------|------------|------------|
| 表格表头 | 浅灰背景 `#F1F3F5` | 深灰背景 `#21262D` |
| 表格边框 | `#E5E7EB` | `#30363D` |
| 表格斑马纹 | `#F8F9FA` | `#161B22` |
| 代码块背景 | `#F6F8FA` | `#1C2128` |
| 代码注释 | `#6a737d`（灰色） | `#8b949e`（浅灰） |
| 代码关键字 | `#d73a49`（红色） | `#ff7b72`（亮红） |
| 引用块背景 | 半透明 `#F8F9FA` | 半透明 `#161B22` |
| 引用块竖线 | `#3B82F6`（蓝色） | `#58A6FF`（亮蓝） |
| KaTeX 公式 | 黑色文字 | 浅色文字（通过 filter） |
| 图片 | 正常亮度 | 亮度降低 15% |

### 6.3 性能测试

| 指标 | 目标 | 测试方法 |
|------|------|---------|
| 单图表渲染 | < 200ms | `performance.now()` 计时 |
| 10 个图表重渲染 | < 1s | `Promise.all` 批量渲染 |
| 主题切换延迟 | < 100ms | 切换到主题切换完成的时间 |
| 内存占用 | 关闭文档后释放 | DevTools Memory 面板检查 |

### 6.4 视觉回归测试

使用截图对比工具（如 Playwright Screenshot）验证：

1. **亮色模式基准**：拍摄所有元素在 light 主题下的截图
2. **暗色模式对比**：切换到 dark 主题，验证颜色变化符合预期
3. **Mermaid 图表**：分别验证 flowchart、sequence diagram、gantt 等类型的主题适配
4. **过渡动画**：验证 300ms 渐变效果（通过 CSS `transition` 实现）

---

## 7. 风险与缓解措施

### 7.1 Mermaid 重渲染性能

**风险**：大量图表（20+ 个）同时重渲染可能导致卡顿。

**缓解措施**：
```typescript
// 分批渲染策略
async function rerenderAllDiagrams(): Promise<void> {
  const BATCH_SIZE = 5;
  const entries = Array.from(renderedContainers.entries());
  
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async ([id, { container, definition }]) => {
      // ... 渲染逻辑
    }));
    
    // 让出主线程，避免阻塞 UI
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
```

### 7.2 Mermaid v10.x API 兼容性

**风险**：部分配置项可能已废弃或行为改变。

**缓解措施**：
- 查阅 Mermaid 10.x 官方文档确认配置项
- 使用 `try-catch` 包裹初始化逻辑
- 在 `package.json` 中锁定 mermaid 版本：`"mermaid": "^10.9.0"`

### 7.3 KaTeX 滤镜副作用

**风险**：`filter: invert()` 可能影响彩色公式（如化学方程式）。

**缓解措施**：
- 仅在暗色模式下应用滤镜
- 提供设置选项，允许用户关闭此功能
- 测试常见公式类型（数学、化学、物理）

### 7.4 内存泄漏

**风险**：频繁打开/关闭文档时，`renderedContainers` 可能积累大量无效引用。

**缓解措施**：
- 在 `MarkdownPreview.vue` 卸载时调用 `clearAllRenderedContainers()`
- 在每次重新渲染前调用 `cleanupMermaidObservers(oldArticle)`
- 定期（如每分钟）清理无效引用

---

## 8. 实现优先级

| 优先级 | 任务 | 预计工作量 |
|--------|------|----------|
| P0（核心） | 修复 Mermaid 主题切换（`mermaidConfig.ts` + `useTheme.ts`） | 2-3 小时 |
| P1（重要） | KaTeX 暗色模式适配 | 0.5 小时 |
| P2（可选） | 图片暗色模式优化 | 0.5 小时 |
| P3（优化） | Mermaid 分批渲染性能优化 | 1 小时 |
| P3（测试） | 完整测试用例编写 | 2 小时 |

---

## 9. 总结

本方案通过以下措施实现预览区元素的完整主题适配：

1. **修复 Mermaid 主题切换**：添加容器跟踪和动态重渲染机制，解决配置项废弃和主题不生效问题
2. **验证 CSS 变量适配**：确认表格、代码块、引用块等元素已通过 CSS 变量自动适配主题
3. **增强 KaTeX 和图片**：可选的暗色模式滤镜优化
4. **性能与内存管理**：分批渲染策略和内存清理机制

实施后，用户切换主题时，所有预览区元素将流畅、一致地跟随主题变化，提升整体阅读体验。
