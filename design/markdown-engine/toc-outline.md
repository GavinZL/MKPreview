# F06-09 TOC 目录大纲

## 1. 功能描述与目标

本特性实现渲染预览区域的目录大纲（Table of Contents）浮动面板，覆盖 PRD FR-003.1 的要求：

- **自动生成**：从渲染后的 H1-H6 标题自动提取生成目录树
- **点击跳转**：点击目录项平滑滚动到对应标题位置
- **当前位置高亮**：根据滚动位置自动高亮当前阅读的章节
- **层级缩进**：按标题级别进行层级缩进展示
- **面板可收起**：支持展开/收起目录面板
- **与同步滚动配合**：为分屏模式的同步滚动提供锚点支持

## 2. 技术实现方案

### 2.1 文件位置

```
src/components/preview/TableOfContents.vue    # TOC 浮动面板组件
src/composables/useToc.ts                     # TOC 逻辑 composable
```

### 2.2 TableOfContents.vue

```vue
<!-- src/components/preview/TableOfContents.vue -->
<template>
  <div
    class="toc-panel"
    :class="{ collapsed: isCollapsed }"
  >
    <!-- 面板头部 -->
    <div class="toc-header" @click="toggleCollapse">
      <span class="toc-title">目录</span>
      <button class="toc-toggle">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          :class="{ rotated: isCollapsed }"
        >
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
    </div>

    <!-- 目录列表 -->
    <Transition name="toc-collapse">
      <ul v-show="!isCollapsed" class="toc-list">
        <li
          v-for="heading in headings"
          :key="heading.id"
          :class="[
            'toc-item',
            `toc-level-${heading.level}`,
            { active: activeId === heading.id }
          ]"
          @click="handleClick(heading)"
        >
          {{ heading.text }}
        </li>
      </ul>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { TocHeading } from '@/types/markdown';

// ==================== Props & Emits ====================

interface Props {
  /** 标题数据列表 */
  headings: TocHeading[];
  /** 内容滚动容器 */
  scrollContainer?: HTMLElement | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'jump', id: string): void;
}>();

// ==================== 状态 ====================

const isCollapsed = ref(false);
const activeId = ref('');

// ==================== 方法 ====================

function toggleCollapse(): void {
  isCollapsed.value = !isCollapsed.value;
}

function handleClick(heading: TocHeading): void {
  emit('jump', heading.id);
  activeId.value = heading.id;
}

// ==================== 滚动监听 ====================

function updateActiveHeading(): void {
  const container = props.scrollContainer;
  if (!container || props.headings.length === 0) return;

  const scrollTop = container.scrollTop + 100;  // 100px 偏移量

  // 从后往前找，找到第一个 offsetTop <= scrollTop 的标题
  let currentId = props.headings[0]?.id || '';
  for (const heading of props.headings) {
    if (heading.offsetTop <= scrollTop) {
      currentId = heading.id;
    } else {
      break;
    }
  }

  if (activeId.value !== currentId) {
    activeId.value = currentId;
  }
}

// 节流滚动监听
let ticking = false;
function onScroll(): void {
  if (!ticking) {
    requestAnimationFrame(() => {
      updateActiveHeading();
      ticking = false;
    });
    ticking = true;
  }
}

onMounted(() => {
  props.scrollContainer?.addEventListener('scroll', onScroll, { passive: true });
  updateActiveHeading();
});

onUnmounted(() => {
  props.scrollContainer?.removeEventListener('scroll', onScroll);
});

// ==================== 暴露 ====================

defineExpose({
  activeId: computed(() => activeId.value),
  setActiveId: (id: string) => { activeId.value = id; },
});
</script>

<style scoped>
.toc-panel {
  position: absolute;
  right: 16px;
  top: 16px;
  width: 220px;
  max-height: calc(100% - 32px);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  z-index: 50;
  overflow-y: auto;
  transition: width 0.2s ease, padding 0.2s ease;
}

.toc-panel.collapsed {
  width: auto;
  padding: 10px;
}

.toc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
  margin-bottom: 4px;
}

.toc-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}

.toc-toggle {
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s;
}

.toc-toggle:hover {
  color: var(--text-primary);
}

.toc-toggle svg {
  transition: transform 0.2s ease;
}

.toc-toggle svg.rotated {
  transform: rotate(-90deg);
}

.toc-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.toc-item {
  padding: 4px 0;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.1s;
  border-radius: 4px;
  padding-left: 4px;
  padding-right: 4px;
}

.toc-item:hover {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 5%, transparent);
}

.toc-item.active {
  color: var(--accent);
  font-weight: 500;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

/* 层级缩进 */
.toc-level-1 { padding-left: 4px; }
.toc-level-2 { padding-left: 12px; }
.toc-level-3 { padding-left: 20px; }
.toc-level-4 { padding-left: 28px; }
.toc-level-5 { padding-left: 36px; }
.toc-level-6 { padding-left: 44px; }

/* 过渡动画 */
.toc-collapse-enter-active,
.toc-collapse-leave-active {
  transition: opacity 0.15s ease, max-height 0.2s ease;
  max-height: 500px;
  overflow: hidden;
}

.toc-collapse-enter-from,
.toc-collapse-leave-to {
  opacity: 0;
  max-height: 0;
}

/* 滚动条 */
.toc-panel::-webkit-scrollbar {
  width: 4px;
}

.toc-panel::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 2px;
}
</style>
```

### 2.3 useToc Composable

```typescript
// src/composables/useToc.ts

import { ref, computed } from 'vue';
import type { TocHeading } from '@/types/markdown';

/**
 * TOC 逻辑 Composable
 * @param scrollContainer 滚动容器 Ref
 */
export function useToc(scrollContainer: Ref<HTMLElement | null>) {
  const headings = ref<TocHeading[]>([]);
  const activeId = ref('');

  /**
   * 从渲染容器提取标题数据
   * @param container 渲染内容 DOM
   */
  function extractHeadings(container: HTMLElement): void {
    const elements = container.querySelectorAll<HTMLHeadingElement>('h1, h2, h3, h4, h5, h6');

    headings.value = Array.from(elements).map((heading) => ({
      level: parseInt(heading.tagName[1]),
      text: heading.textContent?.replace('#', '').trim() || '',
      id: heading.id,
      offsetTop: heading.offsetTop,
    }));
  }

  /**
   * 滚动到指定标题
   * @param id 标题锚点 id
   */
  function scrollToHeading(id: string): void {
    const container = scrollContainer.value;
    if (!container) return;

    const element = container.querySelector(`#${CSS.escape(id)}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      activeId.value = id;
    }
  }

  /**
   * 更新当前活跃标题（基于滚动位置）
   */
  function updateActiveHeading(): void {
    const container = scrollContainer.value;
    if (!container || headings.value.length === 0) return;

    const scrollTop = container.scrollTop + 100;

    let currentId = headings.value[0].id;
    for (const heading of headings.value) {
      if (heading.offsetTop <= scrollTop) {
        currentId = heading.id;
      } else {
        break;
      }
    }

    activeId.value = currentId;
  }

  const hasHeadings = computed(() => headings.value.length > 0);

  return {
    headings,
    activeId,
    hasHeadings,
    extractHeadings,
    scrollToHeading,
    updateActiveHeading,
  };
}
```

### 2.4 MarkdownPreview.vue 中集成

```typescript
// 在 MarkdownPreview.vue 中使用

import { useToc } from '@/composables/useToc';

const { headings, activeId, scrollToHeading, extractHeadings } = useToc(contentRef);

// Stage 4 中提取标题
function applyEnhancements(container: HTMLElement): void {
  // ... 其他增强 ...
  extractHeadings(container);
}

// TOC 跳转
function onTocJump(id: string): void {
  scrollToHeading(id);
}
```

## 3. 接口定义

### 3.1 TableOfContents Props

```typescript
interface TableOfContentsProps {
  headings: TocHeading[];              // 标题数据列表
  scrollContainer?: HTMLElement | null; // 滚动容器引用
}
```

### 3.2 TableOfContents Emits

```typescript
interface TableOfContentsEmits {
  (e: 'jump', id: string): void;       // 点击目录项跳转
}
```

### 3.3 TableOfContents Expose

```typescript
interface TableOfContentsExpose {
  activeId: ComputedRef<string>;       // 当前活跃标题 id
  setActiveId(id: string): void;       // 手动设置活跃标题
}
```

### 3.4 useToc Composable

```typescript
export function useToc(scrollContainer: Ref<HTMLElement | null>): {
  headings: Ref<TocHeading[]>;
  activeId: Ref<string>;
  hasHeadings: ComputedRef<boolean>;
  extractHeadings(container: HTMLElement): void;
  scrollToHeading(id: string): void;
  updateActiveHeading(): void;
};
```

## 4. 数据结构

### 4.1 TocHeading

```typescript
interface TocHeading {
  level: number;       // 标题级别 1-6
  text: string;        // 标题文本（已去除锚点符号）
  id: string;          // 锚点 id（用于跳转）
  offsetTop: number;   // 相对于容器的垂直偏移（像素）
}
```

### 4.2 TOC 层级结构示例

```typescript
[
  { level: 1, text: '指针基础', id: '指针基础', offsetTop: 0 },
  { level: 2, text: '注意事项', id: '注意事项', offsetTop: 300 },
  { level: 2, text: '指针运算', id: '指针运算', offsetTop: 600 },
  { level: 3, text: '常见错误', id: '常见错误', offsetTop: 800 },
  { level: 2, text: 'Mermaid 图表示例', id: 'mermaid-图表示例', offsetTop: 1200 },
]
```

## 5. 依赖关系

### 5.1 依赖的上游模块

| 模块 | 特性 | 说明 |
|------|------|------|
| F01-02 | 前端基础配置 | Vue 3 组件基础设施 |
| F06-01 | markdown-it 核心配置 | anchor 插件生成标题 id |
| F06-06 | 预览主组件 | 提供渲染容器和滚动容器 |

### 5.2 下游依赖本模块

| 模块 | 特性 | 说明 |
|------|------|------|
| F06-06 | 预览主组件 | 挂载 TableOfContents 组件 |
| F07-05 | 分屏同步滚动 | TOC 跳转触发预览区滚动 |

### 5.3 无额外 npm 依赖

纯 Vue 3 组件实现，无额外依赖。

## 6. 测试要点

### 6.1 功能测试

```typescript
// tests/components/TableOfContents.spec.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TableOfContents from '@/components/preview/TableOfContents.vue';

describe('TableOfContents', () => {
  const headings = [
    { level: 1, text: 'H1', id: 'h1', offsetTop: 0 },
    { level: 2, text: 'H2', id: 'h2', offsetTop: 100 },
    { level: 3, text: 'H3', id: 'h3', offsetTop: 200 },
  ];

  it('应渲染所有标题', () => {
    const wrapper = mount(TableOfContents, {
      props: { headings },
    });
    expect(wrapper.findAll('.toc-item')).toHaveLength(3);
  });

  it('应根据层级缩进', () => {
    const wrapper = mount(TableOfContents, {
      props: { headings },
    });
    const items = wrapper.findAll('.toc-item');
    expect(items[0].classes()).toContain('toc-level-1');
    expect(items[1].classes()).toContain('toc-level-2');
    expect(items[2].classes()).toContain('toc-level-3');
  });

  it('点击应触发 jump 事件', async () => {
    const wrapper = mount(TableOfContents, {
      props: { headings },
    });
    await wrapper.find('.toc-item').trigger('click');
    expect(wrapper.emitted('jump')).toBeTruthy();
    expect(wrapper.emitted('jump')![0]).toEqual(['h1']);
  });

  it('应支持收起/展开', async () => {
    const wrapper = mount(TableOfContents, {
      props: { headings },
    });
    await wrapper.find('.toc-header').trigger('click');
    expect(wrapper.find('.toc-panel').classes()).toContain('collapsed');
  });
});
```

### 6.2 滚动监听测试

| 测试项 | 操作 | 期望结果 |
|--------|------|---------|
| 滚动高亮 | 滚动到 H2 位置 | H2 目录项添加 active 类 |
| 平滑跳转 | 点击 H3 目录项 | 预览区平滑滚动到 H3 |
| 空目录 | 无标题文档 | 目录面板不显示 |
| 快速滚动 | 连续滚动 | active 更新节流，不卡顿 |

### 6.3 性能测试

| 指标 | 目标 | 测试方法 |
|------|------|---------|
| 目录提取 | < 5ms（100 个标题）| extractHeadings |
| 滚动监听 | < 1ms / 帧 | requestAnimationFrame 节流 |
| 跳转响应 | < 300ms | 点击到目标位置可见 |
