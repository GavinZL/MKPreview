# F06-07 Mermaid 图表渲染

## 1. 功能描述与目标

本特性实现 Mermaid 图表代码块的检测与渲染，覆盖 PRD FR-004.4 的所有要求：

- **代码块检测**：识别 ` ```mermaid ` 标记的代码块
- **图表渲染**：使用 mermaid.js 将文本图表描述渲染为 SVG
- **支持类型**：flowchart、sequence diagram、class diagram、state diagram、Gantt chart、pie chart、ER diagram、mindmap
- **渲染失败降级**：语法错误时 graceful 降级为代码块显示，并提示错误信息
- **图表尺寸自适应**：SVG 宽度自适应容器，max-width 100%
- **主题跟随**：亮色/暗色模式下使用不同的 mermaid 主题配色
- **懒渲染（Phase 3）**：使用 IntersectionObserver 仅渲染进入视口的图表

### 安全要求

- 配置 mermaid `securityLevel: 'strict'`：禁止 mermaid 内嵌 HTML/脚本
- 配置 `maxTextSize` 限制防止 DoS 攻击

## 2. 技术实现方案

### 2.1 文件位置

```
src/lib/mermaidConfig.ts              # mermaid.js 初始化 + 主题配置
src/components/preview/MermaidBlock.vue  # Mermaid 懒渲染组件（Phase 3）
```

### 2.2 mermaidConfig.ts

```typescript
// src/lib/mermaidConfig.ts

import mermaid from 'mermaid';

// 当前主题状态
let currentTheme: 'light' | 'dark' = 'dark';

/**
 * 获取 mermaid 主题配置
 * @param appTheme 应用主题
 * @returns mermaid 主题名称
 */
function getMermaidTheme(appTheme: 'light' | 'dark'): string {
  return appTheme === 'dark' ? 'dark' : 'default';
}

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
    theme: getMermaidTheme(appTheme),

    // === 渲染配置 ===
    startOnLoad: false,           // 禁用自动渲染，由我们手动控制
    suppressErrorRendering: true, // 禁用默认错误渲染，我们自己处理

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
 * 切换 mermaid 主题
 * @param appTheme 应用当前主题
 */
export function setMermaidTheme(appTheme: 'light' | 'dark'): void {
  if (appTheme === currentTheme) return;
  currentTheme = appTheme;

  // 重新初始化以应用新主题
  initMermaid(appTheme);
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

### 2.3 MermaidBlock.vue（Phase 3 懒渲染组件）

```vue
<!-- src/components/preview/MermaidBlock.vue -->
<template>
  <div
    ref="mermaidContainer"
    class="mermaid"
    :data-rendered="rendered"
  >
    <!-- 初始状态显示原始定义文本（由 fence 规则输出） -->
    <!-- 渲染后替换为 SVG -->
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { renderMermaidDiagram } from '@/lib/mermaidConfig';

interface Props {
  definition: string;
  id: string;
}

const props = defineProps<Props>();

const mermaidContainer = ref<HTMLDivElement | null>(null);
const rendered = ref<'false' | 'true' | 'error'>('false');

onMounted(async () => {
  try {
    const svg = await renderMermaidDiagram(props.id, props.definition);
    if (mermaidContainer.value) {
      mermaidContainer.value.innerHTML = svg;
      rendered.value = 'true';
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '渲染失败';
    if (mermaidContainer.value) {
      mermaidContainer.value.innerHTML = `
        <div class="mermaid-error">
          <div class="error-title">⚠️ Mermaid 渲染失败</div>
          <pre>${message}</pre>
        </div>
      `;
      rendered.value = 'error';
    }
  }
});
</script>
```

### 2.4 补充 CSS

```css
/* 已包含在 base.css 中，此处为引用说明 */

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

.mk-body .mermaid-error {
  border: 1px solid var(--accent-red);
  background: color-mix(in srgb, var(--accent-red) 8%, var(--bg-secondary));
  padding: 1em 1.2em;
  border-radius: 8px;
  font-family: var(--font-mono);
  font-size: 13px;
  width: 100%;
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
  white-space: pre-wrap;
}
```

## 3. 接口定义

### 3.1 mermaidConfig.ts 导出

```typescript
// 初始化 mermaid
export function initMermaid(appTheme: 'light' | 'dark'): void;

// 切换主题
export function setMermaidTheme(appTheme: 'light' | 'dark'): void;

// 渲染单个图表
export async function renderMermaidDiagram(id: string, definition: string): Promise<string>;

// 批量处理容器内图表
export async function processMermaidBlocks(container: HTMLElement): Promise<void>;

// Phase 3: 懒渲染
export function setupLazyMermaidRendering(container: HTMLElement): void;
```

### 3.2 MermaidBlock Props

```typescript
interface MermaidBlockProps {
  definition: string;   // Mermaid 图表定义文本
  id: string;           // 唯一标识符
}
```

## 4. 数据结构

### 4.1 Mermaid 配置对象

```typescript
interface MermaidConfig {
  securityLevel: 'strict' | 'loose' | 'antiscript';
  maxTextSize: number;
  maxEdges: number;
  theme: 'default' | 'dark' | 'forest' | 'neutral';
  startOnLoad: boolean;
  suppressErrorRendering: boolean;
  fontFamily: string;
  flowchart: {
    useMaxWidth: boolean;
    htmlLabels: boolean;
    curve: string;
  };
  sequence: {
    useMaxWidth: boolean;
    diagramMarginX: number;
    diagramMarginY: number;
  };
  class: {
    useMaxWidth: boolean;
  };
  gantt: {
    useMaxWidth: boolean;
  };
}
```

### 4.2 渲染结果

```typescript
interface MermaidRenderResult {
  svg: string;           // 渲染后的 SVG HTML
  bindFunctions?: (element: Element) => void;  // 交互函数绑定
}
```

## 5. 依赖关系

### 5.1 依赖的上游模块

| 模块 | 特性 | 说明 |
|------|------|------|
| F01-02 | 前端基础配置 | TypeScript / Vue 3 基础设施 |
| F06-01 | markdown-it 核心配置 | fence 规则拦截 mermaid 输出 `<div class="mermaid">` |
| F06-02 | 基础元素渲染样式 | `.mermaid` 容器样式 |
| F08-01 | CSS 变量主题系统 | 应用主题变化时同步更新 mermaid 主题 |

### 5.2 下游依赖本模块

| 模块 | 特性 | 说明 |
|------|------|------|
| F06-06 | 预览主组件 | Stage 3b 调用 processMermaidBlocks |
| F08-02 | 主题切换 | 切换主题时调用 setMermaidTheme |

### 5.3 npm 依赖

```json
{
  "dependencies": {
    "mermaid": "^10.9.0"
  }
}
```

**注意**：mermaid 10.x 使用模块化架构，支持 tree-shaking，但实际使用中仍可能带来较大体积（~500KB+）。需在打包时评估是否需要按需加载。

## 6. 测试要点

### 6.1 图表渲染测试

```typescript
// tests/lib/mermaidConfig.spec.ts
import { describe, it, expect } from 'vitest';
import { renderMermaidDiagram, initMermaid } from '@/lib/mermaidConfig';

describe('renderMermaidDiagram', () => {
  beforeAll(() => {
    initMermaid('dark');
  });

  it('应渲染流程图', async () => {
    const svg = await renderMermaidDiagram('test-1', `
      graph TD;
        A[开始] --> B[结束];
    `);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('应渲染序列图', async () => {
    const svg = await renderMermaidDiagram('test-2', `
      sequenceDiagram
        Alice->>Bob: Hello
    `);
    expect(svg).toContain('<svg');
  });

  it('语法错误时应抛出异常', async () => {
    await expect(
      renderMermaidDiagram('test-3', 'invalid syntax!!!')
    ).rejects.toThrow();
  });
});
```

### 6.2 安全测试

| 测试项 | 输入 | 期望结果 |
|--------|------|---------|
| HTML 注入 | `graph TD; A --> B; click A "javascript:alert(1)"` | strict 模式下不执行 JS |
| 超大文本 | 100KB 图表定义 | maxTextSize 限制下优雅失败 |
| 超复杂图 | 1000 个节点的图 | maxEdges 限制下优雅失败 |

### 6.3 主题测试

| 测试项 | 验证 |
|--------|------|
| 亮色主题 | mermaid 使用 `default` 主题 |
| 暗色主题 | mermaid 使用 `dark` 主题 |
| 主题切换 | 切换后重新渲染的图表使用新主题 |

### 6.4 性能测试

| 指标 | 目标 | 测试方法 |
|------|------|---------|
| 单图表渲染 | < 200ms | 标准流程图 renderMermaidDiagram |
| 10 个图表并行 | < 1s | Promise.all 批量渲染 |
| 懒渲染触发 | 进入视口前 100px | IntersectionObserver rootMargin |
| 内存占用 | 关闭标签后释放 | DevTools Memory 面板 |
