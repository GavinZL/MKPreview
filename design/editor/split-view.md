# F07-05 分屏模式与同步滚动 [Phase 2]

## 1. 功能描述与目标

**功能描述**：Phase 2 阶段实现分屏模式（Split Mode），左侧为 CodeMirror 6 可编辑源码编辑器，右侧为 Markdown 渲染预览，并排展示。支持同步滚动、可拖拽分割比例调节、双击恢复默认比例。

**目标**：
- CSS Grid 实现左右分栏布局（默认 50:50）
- 中间拖拽分割条可调整比例（30%-70% 范围）
- 双击分割条恢复 50:50 默认比例
- **同步滚动**：滚动任一侧，另一侧按比例联动（60fps）
- **光标定位同步**：在源码侧点击某行时，渲染侧滚动到对应位置
- 分屏模式下编辑源码时，预览实时更新（带防抖）
- 快捷键 Cmd/Ctrl+3 切换分屏模式

**PRD 关联**：FR-003.3 分屏模式、PRD 6.4 同步滚动算法

---

## 2. 技术实现方案

### 2.1 分屏布局架构

```
┌──────────────────────────────────────────────────────────────┐
│                     SplitView.vue                             │
│  ┌────────────────────────┬────────┬──────────────────────┐  │
│  │                        │   ▓▓   │                      │  │
│  │   SourceEditor         │resize  │   MarkdownPreview    │  │
│  │   (CodeMirror 6)       │ handle │   (渲染预览)          │  │
│  │                        │   ▓▓   │                      │  │
│  │                        │        │                      │  │
│  └────────────────────────┴────────┴──────────────────────┘  │
│                    CSS Grid: 1fr 6px 1fr                     │
└──────────────────────────────────────────────────────────────┘
```

```vue
<!-- components/split/SplitView.vue -->
<template>
  <div class="split-view" ref="splitRef">
    <!-- 左侧：源码编辑器 -->
    <div class="split-pane split-pane-left" :style="leftStyle">
      <SourceEditor
        ref="sourceRef"
        :content="content"
        :readonly="false"
        @change="onSourceChange"
      />
    </div>

    <!-- 分割条 -->
    <div
      class="split-resizer"
      @mousedown="startResize"
      @dblclick="resetSplit"
    />

    <!-- 右侧：渲染预览 -->
    <div class="split-pane split-pane-right" :style="rightStyle">
      <MarkdownPreview
        ref="previewRef"
        :content="previewContent"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import SourceEditor from '@/components/editor/SourceEditor.vue'
import MarkdownPreview from '@/components/preview/MarkdownPreview.vue'
import { useScrollSync } from '@/composables/useScrollSync'

interface Props {
  content: string
}

const props = defineProps<Props>()

const splitRef = ref<HTMLElement>()
const sourceRef = ref<InstanceType<typeof SourceEditor>>()
const previewRef = ref<InstanceType<typeof MarkdownPreview>>()

// 分割比例 (0.3 ~ 0.7)
const splitRatio = ref(0.5)
const isResizing = ref(false)

const leftStyle = computed(() => ({
  width: `${splitRatio.value * 100}%`,
}))

const rightStyle = computed(() => ({
  width: `${(1 - splitRatio.value) * 100}%`,
}))

// ========== 实时预览（带防抖） ==========
const previewContent = ref(props.content)

const debouncedUpdate = useDebounceFn((content: string) => {
  previewContent.value = content
}, 300) // 300ms 防抖

function onSourceChange(content: string) {
  debouncedUpdate(content)
}

watch(() => props.content, (newContent) => {
  previewContent.value = newContent
})

// ========== 拖拽调整比例 ==========
function startResize(e: MouseEvent) {
  isResizing.value = true
  const container = splitRef.value!
  const rect = container.getBoundingClientRect()
  const minRatio = 0.3
  const maxRatio = 0.7

  function onMouseMove(e: MouseEvent) {
    const x = e.clientX - rect.left
    const ratio = Math.max(minRatio, Math.min(maxRatio, x / rect.width))
    splitRatio.value = ratio
  }

  function onMouseUp() {
    isResizing.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function resetSplit() {
  splitRatio.value = 0.5
}

// ========== 同步滚动 ==========
const { enableSync, disableSync } = useScrollSync(
  computed(() => sourceRef.value?.getEditorView() ?? null),
  computed(() => previewRef.value?.$el.querySelector('.mk-body') ?? null),
  computed(() => previewContent.value)
)

onMounted(() => {
  enableSync()
})

onUnmounted(() => {
  disableSync()
})
</script>

<style scoped>
.split-view {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.split-pane {
  height: 100%;
  overflow: hidden;
  flex-shrink: 0;
}

.split-pane-left {
  border-right: 1px solid var(--border);
}

.split-resizer {
  width: 6px;
  cursor: col-resize;
  background: var(--border);
  flex-shrink: 0;
  transition: background 0.15s;
  position: relative;
  z-index: 10;
}

.split-resizer:hover {
  background: var(--accent);
}

.split-resizer::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 24px;
  background: var(--text-muted);
  border-radius: 1px;
}
</style>
```

### 2.2 同步滚动算法（段落映射法）

参考 PRD 6.4，采用**段落映射法**实现源码与预览的同步滚动：

#### 算法步骤

```
Step 1: markdown-it 解析时记录每个 block token 的源码行号范围（map 属性）
Step 2: 渲染后为每个块级元素添加 data-source-line="N" 属性
Step 3: 构建映射表：sourceLineRanges[] ↔ renderedElementOffsets[]
Step 4: 滚动源码时，根据当前可见行号查映射表找到对应渲染元素，scrollTo 对应偏移
Step 5: 反向同理：滚动预览时，根据可见元素的 data-source-line 回映到源码行
Step 6: 使用 requestAnimationFrame 节流，确保 60fps
```

#### 详细实现

```typescript
// lib/scrollSyncEngine.ts

export interface ScrollMapping {
  /** 源码起始行号 */
  sourceLine: number
  /** 渲染元素在预览中的偏移像素 */
  previewOffset: number
}

export class ScrollSyncEngine {
  private mappings: ScrollMapping[] = []
  private sourceView: EditorView | null = null
  private previewElement: HTMLElement | null = null
  private isSyncing = false
  private rafId: number | null = null

  constructor(
    sourceView: EditorView,
    previewElement: HTMLElement
  ) {
    this.sourceView = sourceView
    this.previewElement = previewElement
  }

  /** 构建源码行号 ↔ 预览元素偏移的映射表 */
  buildMappings() {
    if (!this.previewElement) return

    this.mappings = []
    const elements = this.previewElement.querySelectorAll<HTMLElement>('[data-source-line]')

    elements.forEach((el) => {
      const lineAttr = el.getAttribute('data-source-line')
      if (lineAttr) {
        this.mappings.push({
          sourceLine: parseInt(lineAttr, 10),
          previewOffset: el.offsetTop,
        })
      }
    })

    // 按源码行号排序
    this.mappings.sort((a, b) => a.sourceLine - b.sourceLine)
  }

  /** 源码行号 → 预览偏移 */
  sourceLineToPreviewOffset(sourceLine: number): number {
    if (this.mappings.length === 0) return 0

    // 二分查找最近的映射点
    let left = 0
    let right = this.mappings.length - 1

    while (left < right) {
      const mid = Math.floor((left + right + 1) / 2)
      if (this.mappings[mid].sourceLine <= sourceLine) {
        left = mid
      } else {
        right = mid - 1
      }
    }

    const mapping = this.mappings[left]

    // 如果精确匹配，直接返回
    if (mapping.sourceLine === sourceLine) {
      return mapping.previewOffset
    }

    // 否则线性插值估计
    const nextMapping = this.mappings[left + 1]
    if (!nextMapping) return mapping.previewOffset

    const lineDelta = sourceLine - mapping.sourceLine
    const totalLineDelta = nextMapping.sourceLine - mapping.sourceLine
    const offsetDelta = nextMapping.previewOffset - mapping.previewOffset

    return mapping.previewOffset + (lineDelta / totalLineDelta) * offsetDelta
  }

  /** 预览偏移 → 源码行号 */
  previewOffsetToSourceLine(previewOffset: number): number {
    if (this.mappings.length === 0) return 0

    // 找到预览偏移对应的元素
    let closestMapping = this.mappings[0]
    let minDistance = Infinity

    for (const mapping of this.mappings) {
      const distance = Math.abs(mapping.previewOffset - previewOffset)
      if (distance < minDistance) {
        minDistance = distance
        closestMapping = mapping
      }
    }

    return closestMapping.sourceLine
  }

  /** 同步源码滚动到预览 */
  syncSourceToPreview() {
    if (!this.sourceView || !this.previewElement || this.isSyncing) return

    this.isSyncing = true

    if (this.rafId) cancelAnimationFrame(this.rafId)

    this.rafId = requestAnimationFrame(() => {
      try {
        // 获取源码当前可见区域的中心行号
        const viewport = this.sourceView!.viewport
        const centerLine = this.sourceView!.state.doc.lineAt(
          (viewport.from + viewport.to) / 2
        )
        const centerLineNumber = centerLine.number

        // 查映射表得到预览目标偏移
        const targetOffset = this.sourceLineToPreviewOffset(centerLineNumber)

        // 获取预览容器
        const previewContainer = this.previewElement!.parentElement
        if (!previewContainer) return

        // 计算预览容器的中心位置对应的目标 scrollTop
        const containerHeight = previewContainer.clientHeight
        const previewHeight = this.previewElement!.scrollHeight
        const targetScrollTop = Math.max(
          0,
          Math.min(
            targetOffset - containerHeight / 2,
            previewHeight - containerHeight
          )
        )

        // 平滑滚动到目标位置
        previewContainer.scrollTop = targetScrollTop
      } finally {
        this.isSyncing = false
      }
    })
  }

  /** 同步预览滚动到源码 */
  syncPreviewToSource() {
    if (!this.sourceView || !this.previewElement || this.isSyncing) return

    this.isSyncing = true

    if (this.rafId) cancelAnimationFrame(this.rafId)

    this.rafId = requestAnimationFrame(() => {
      try {
        const previewContainer = this.previewElement!.parentElement
        if (!previewContainer) return

        // 获取预览当前滚动位置对应的中心偏移
        const scrollTop = previewContainer.scrollTop
        const containerHeight = previewContainer.clientHeight
        const centerOffset = scrollTop + containerHeight / 2

        // 查映射表得到源码目标行号
        const targetLine = this.previewOffsetToSourceLine(centerOffset)

        // 滚动源码到对应行
        const doc = this.sourceView!.state.doc
        const line = doc.line(Math.min(targetLine, doc.lines))
        this.sourceView!.dispatch({
          effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
        })
      } finally {
        this.isSyncing = false
      }
    })
  }

  /** 绑定滚动事件监听 */
  bind() {
    if (!this.sourceView || !this.previewElement) return

    const previewContainer = this.previewElement.parentElement
    if (!previewContainer) return

    // 源码滚动监听
    const sourceScroller = this.sourceView.scrollDOM
    const onSourceScroll = () => this.syncSourceToPreview()
    sourceScroller.addEventListener('scroll', onSourceScroll, { passive: true })

    // 预览滚动监听
    const onPreviewScroll = () => this.syncPreviewToSource()
    previewContainer.addEventListener('scroll', onPreviewScroll, { passive: true })

    // 返回解绑函数
    return () => {
      sourceScroller.removeEventListener('scroll', onSourceScroll)
      previewContainer.removeEventListener('scroll', onPreviewScroll)
    }
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId)
  }
}
```

### 2.3 markdown-it data-source-line 属性注入

```typescript
// lib/markdownIt.ts (扩展)
import MarkdownIt from 'markdown-it'

export function createMarkdownIt(): MarkdownIt {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: true,
  })

  // 为每个渲染的块级元素添加 data-source-line 属性
  // 利用 markdown-it token 的 map 属性（[startLine, endLine]）
  const defaultRender = md.renderer.renderToken.bind(md.renderer)

  md.renderer.renderToken = function(tokens, idx, options) {
    const token = tokens[idx]
    // 只为块级 token 添加 data-source-line
    if (token.map && token.block) {
      token.attrSet('data-source-line', String(token.map[0]))
    }
    return defaultRender(tokens, idx, options)
  }

  // 对 fence（代码块）特殊处理
  const defaultFence = md.renderer.rules.fence || function(tokens, idx, options, env, slf) {
    return slf.renderToken(tokens, idx, options)
  }

  md.renderer.rules.fence = function(tokens, idx, options, env, slf) {
    const token = tokens[idx]
    // 为代码块容器添加 data-source-line
    const lineNum = token.map ? token.map[0] : 0
    const rendered = defaultFence(tokens, idx, options, env, slf)
    // 在 <pre> 标签上添加 data-source-line
    return rendered.replace(
      '<pre',
      `<pre data-source-line="${lineNum}"`
    )
  }

  return md
}
```

### 2.4 useScrollSync Composable

```typescript
// composables/useScrollSync.ts
import { ref, watch, type Ref, type ComputedRef } from 'vue'
import { ScrollSyncEngine } from '@/lib/scrollSyncEngine'
import type { EditorView } from '@codemirror/view'

export function useScrollSync(
  sourceViewRef: ComputedRef<EditorView | null>,
  previewElementRef: ComputedRef<HTMLElement | null>,
  contentRef: ComputedRef<string>
) {
  const engine = ref<ScrollSyncEngine | null>(null)
  let unbind: (() => void) | null = null

  function enableSync() {
    const sourceView = sourceViewRef.value
    const previewElement = previewElementRef.value
    if (!sourceView || !previewElement) return

    // 等待预览渲染完成
    setTimeout(() => {
      engine.value = new ScrollSyncEngine(sourceView, previewElement)
      engine.value.buildMappings()
      unbind = engine.value.bind()
    }, 100)
  }

  function disableSync() {
    unbind?.()
    engine.value?.destroy()
    engine.value = null
  }

  // 内容变化时重建映射表
  watch(contentRef, () => {
    if (engine.value) {
      setTimeout(() => {
        engine.value?.buildMappings()
      }, 50)
    }
  })

  return {
    enableSync,
    disableSync,
  }
}
```

### 2.5 光标定位同步

当用户在源码编辑器中点击某行时，预览区域应滚动到对应位置：

```typescript
// 在 SourceEditor.vue 中扩展
function onCursorChange() {
  if (!view.value || !engine.value) return

  const pos = view.value.state.selection.main.head
  const line = view.value.state.doc.lineAt(pos)
  const lineNumber = line.number

  // 同步滚动预览到对应位置
  const targetOffset = engine.value.sourceLineToPreviewOffset(lineNumber)
  const previewContainer = previewElement.parentElement
  if (previewContainer) {
    previewContainer.scrollTo({
      top: targetOffset - previewContainer.clientHeight / 3,
      behavior: 'smooth',
    })
  }
}
```

---

## 3. 接口定义

### 3.1 SplitView.vue Props / Emits

```typescript
interface SplitViewProps {
  content: string
}

interface SplitViewEmits {
  (e: 'contentChange', content: string): void
}
```

### 3.2 ScrollSyncEngine 类

```typescript
// lib/scrollSyncEngine.ts
export class ScrollSyncEngine {
  constructor(sourceView: EditorView, previewElement: HTMLElement)

  buildMappings(): void
  sourceLineToPreviewOffset(sourceLine: number): number
  previewOffsetToSourceLine(previewOffset: number): number
  syncSourceToPreview(): void
  syncPreviewToSource(): void
  bind(): () => void  // 返回解绑函数
  destroy(): void
}
```

### 3.3 useScrollSync Composable

```typescript
// composables/useScrollSync.ts
export interface UseScrollSyncReturn {
  enableSync: () => void
  disableSync: () => void
}

export function useScrollSync(
  sourceViewRef: ComputedRef<EditorView | null>,
  previewElementRef: ComputedRef<HTMLElement | null>,
  contentRef: ComputedRef<string>
): UseScrollSyncReturn
```

---

## 4. 数据结构

### 4.1 ScrollMapping

```typescript
// types/scrollSync.ts
export interface ScrollMapping {
  /** 源码行号（从 1 开始） */
  sourceLine: number
  /** 预览元素在容器中的 offsetTop */
  previewOffset: number
}

export interface SplitViewState {
  splitRatio: number  // 0.3 ~ 0.7
  isResizing: boolean
  lastSyncDirection: 'source' | 'preview' | null
}
```

### 4.2 分屏 CSS

```css
.split-view {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.split-pane {
  height: 100%;
  overflow: hidden;
  flex-shrink: 0;
}

.split-pane-left {
  border-right: 1px solid var(--border);
}

.split-resizer {
  width: 6px;
  cursor: col-resize;
  background: var(--border);
  flex-shrink: 0;
  transition: background 0.15s;
  position: relative;
  z-index: 10;
}

.split-resizer:hover,
.split-resizer.is-resizing {
  background: var(--accent);
}
```

---

## 5. 依赖关系

| 依赖模块 | 特性 | 说明 |
|---------|------|------|
| M07 | F07-03 CodeMirror 可编辑模式 | 左侧源码编辑器 |
| M06 | F06-06 预览主组件 | 右侧 MarkdownPreview |
| M06 | F06-01 markdown-it 核心配置 | 需要 token.map 注入 data-source-line |
| M07 | F07-02 模式切换 | Split 作为第三种模式注册 |
| M03 | F03-04 面板拖拽分割条 | 复用拖拽逻辑 |

**被依赖**：
- M07 F07-02 模式切换（Split 模式通过 Cmd+3 激活）

---

## 6. 测试要点

### 6.1 单元测试

| 测试项 | 输入 | 预期结果 |
|--------|------|---------|
| 映射表构建 | 渲染含 H1/H2/代码块/表格的文章 | mappings 数组非空，按 sourceLine 排序 |
| 行号转偏移 | sourceLine = 10 | 返回对应预览元素的 offsetTop |
| 偏移转行号 | previewOffset = 500 | 返回最接近的源码行号 |
| 同步滚动 | 源码滚动到第 50 行 | 预览滚动到对应位置（误差 < 50px） |
| 反向同步 | 预览滚动到 500px | 源码滚动到对应行 |

### 6.2 组件测试

1. **拖拽调整**：拖拽分割条 → 左右比例实时变化 → 释放后比例固定
2. **双击恢复**：双击分割条 → 比例恢复 50:50
3. **比例限制**：拖拽到 < 30% 或 > 70% → 比例停在边界
4. **实时预览**：编辑源码 → 300ms 后预览更新
5. **光标同步**：点击源码某行 → 预览滚动到对应位置

### 6.3 性能测试

| 指标 | 目标 |
|------|------|
| 同步滚动延迟 | < 16ms（requestAnimationFrame 节流） |
| 大文件映射表构建 | 5000 行 < 50ms |
| 实时预览更新 | 300ms 防抖，不阻塞输入 |
| 分屏模式切换 | < 200ms |

### 6.4 E2E 测试

- 打开复杂文章（含标题/代码/表格/图片），验证同步滚动精度
- 快速滚动源码，验证预览跟随无延迟、无跳变
- 编辑大文件时分屏模式下打字流畅度
