# F03-04 面板拖拽分割条

## 1. 功能描述与目标

实现可拖拽的面板分割条组件（GridResizer），用于调整相邻面板的尺寸比例：

- **文件树面板分割条**：垂直方向，调整 Sidebar 与 ContentArea 之间的宽度
- **分屏模式分割条**：垂直方向，调整 Source / Preview 左右面板比例

**核心目标**：
- 鼠标拖拽调整面板尺寸，实时反馈
- 支持最小/最大约束（Sidebar: 180~400px，Split: 30%~70%）
- 双击恢复默认尺寸
- 悬浮时变色反馈（--accent 强调色）
- 拖拽时显示遮罩层防止 iframe/编辑器拦截鼠标事件

## 2. 技术实现方案

### 2.1 Vue 3 组件设计

```vue
<!-- GridResizer.vue -->
<template>
  <div
    class="grid-resizer"
    :class="[`resizer-${direction}`, { dragging: isDragging }]"
    :style="resizerStyle"
    @mousedown="startDrag"
    @dblclick="resetToDefault"
  />
  <!-- 拖拽遮罩层，防止内容区捕获鼠标事件 -->
  <div
    v-if="isDragging"
    class="drag-overlay"
    @mousemove="onDrag"
    @mouseup="endDrag"
    @mouseleave="endDrag"
  />
</template>
```

### 2.2 CSS 样式

```css
/* GridResizer.vue <style scoped> */
.grid-resizer {
  position: absolute;
  z-index: 200;
  transition: background 0.15s ease;
}

/* 垂直分割条（左右面板） */
.resizer-horizontal {
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
}

/* Sidebar 右侧的分割条 */
.resizer-horizontal.sidebar-resizer {
  right: -3px;
}

/* Split 模式中间的分割条 */
.resizer-horizontal.split-resizer {
  left: 50%;
  transform: translateX(-50%);
}

.grid-resizer:hover,
.grid-resizer.dragging {
  background: var(--accent);
}

/* 拖拽遮罩 */
.drag-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  cursor: col-resize;
}
```

### 2.3 useResizable Composable

```typescript
// composables/useResizable.ts
import { ref, computed } from 'vue'

export interface ResizableOptions {
  direction: 'horizontal' | 'vertical'
  min: number          // 最小尺寸（px 或百分比）
  max: number          // 最大尺寸（px 或百分比）
  default: number      // 默认尺寸
  containerRef?: Ref<HTMLElement | null>
}

export function useResizable(options: ResizableOptions) {
  const size = ref(options.default)
  const isDragging = ref(false)
  const startPos = ref(0)
  const startSize = ref(0)

  const clampedSize = computed(() =>
    Math.max(options.min, Math.min(options.max, size.value))
  )

  function startDrag(e: MouseEvent) {
    isDragging.value = true
    startPos.value = options.direction === 'horizontal' ? e.clientX : e.clientY
    startSize.value = size.value
    document.body.style.cursor = options.direction === 'horizontal' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }

  function onDrag(e: MouseEvent) {
    if (!isDragging.value) return
    const currentPos = options.direction === 'horizontal' ? e.clientX : e.clientY
    const delta = currentPos - startPos.value
    size.value = startSize.value + delta
  }

  function endDrag() {
    isDragging.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    // 最终 clamp
    size.value = clampedSize.value
  }

  function resetToDefault() {
    size.value = options.default
  }

  return {
    size: clampedSize,
    isDragging,
    startDrag,
    onDrag,
    endDrag,
    resetToDefault
  }
}
```

### 2.4 组件实现

```typescript
// GridResizer.vue <script setup>
import { computed } from 'vue'
import { useResizable } from '@/composables/useResizable'

const props = withDefaults(defineProps<{
  direction: 'horizontal' | 'vertical'
  min: number
  max: number
  default: number
  modelValue?: number
}>(), {
  direction: 'horizontal'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
  (e: 'resize', value: number): void
  (e: 'dblclick'): void
}>()

const { size, isDragging, startDrag, onDrag, endDrag, resetToDefault } = useResizable({
  direction: props.direction,
  min: props.min,
  max: props.max,
  default: props.default
})

const resizerStyle = computed(() => ({
  [props.direction === 'horizontal' ? 'left' : 'top']: `${size.value}px`
}))

// 同步到父组件
watch(size, (val) => {
  emit('update:modelValue', val)
  emit('resize', val)
})
```

## 3. 接口定义

### GridResizer.vue Props/Emits

```typescript
interface GridResizerProps {
  direction?: 'horizontal' | 'vertical'   // 默认 horizontal
  min: number                             // 最小尺寸（px）
  max: number                             // 最大尺寸（px）
  default: number                         // 默认尺寸（px）
  modelValue?: number                     // v-model 绑定
}

interface GridResizerEmits {
  (e: 'update:modelValue', value: number): void
  (e: 'resize', value: number): void     // 拖拽中实时触发
  (e: 'dblclick'): void                  // 双击恢复默认
}
```

### useResizable 导出

| 导出 | 类型 | 说明 |
|------|------|------|
| `size` | `Ref<number>` | 当前尺寸（已 clamp） |
| `isDragging` | `Ref<boolean>` | 是否正在拖拽 |
| `startDrag(e)` | `(MouseEvent) => void` | mousedown 事件处理 |
| `onDrag(e)` | `(MouseEvent) => void` | mousemove 事件处理 |
| `endDrag()` | `() => void` | mouseup/leave 事件处理 |
| `resetToDefault()` | `() => void` | 恢复默认尺寸 |

## 4. 数据结构

```typescript
// types/layout.ts
export type ResizeDirection = 'horizontal' | 'vertical'

export interface ResizeConstraints {
  min: number
  max: number
  default: number
}

export interface PanelConfig {
  sidebar: ResizeConstraints & { collapsed: boolean }
  split: ResizeConstraints
}

export const DEFAULT_PANEL_CONFIG: PanelConfig = {
  sidebar: {
    min: 180,
    max: 400,
    default: 260,
    collapsed: false
  },
  split: {
    min: 0.3,      // 30%
    max: 0.7,      // 70%
    default: 0.5   // 50%
  }
}
```

## 5. 依赖关系

| 依赖模块 | 说明 |
|---------|------|
| F03-01 CSS Grid 整体布局 | GridResizer 嵌入 Sidebar 和内容区之间 |
| F07-05 分屏模式与同步滚动 | SplitView 内部使用 GridResizer 调节左右比例 |
| F08-01 CSS 变量主题系统 | --accent 用于悬浮/拖拽时的高亮色 |

## 6. 测试要点

1. **拖拽调整**：按住分割条拖拽，相邻面板尺寸是否实时变化
2. **最小约束**：拖拽到最小值（180px）后是否无法继续缩小
3. **最大约束**：拖拽到最大值（400px）后是否无法继续扩大
4. **双击恢复**：双击分割条是否恢复默认 260px
5. **悬浮反馈**：鼠标悬浮时分割条是否变为 --accent 色
6. **拖拽光标**：拖拽时 body 光标是否变为 col-resize
7. **文本选择禁止**：拖拽时是否禁止页面文本被选中
8. **遮罩层**：拖拽时是否有全屏遮罩防止内容区拦截事件
9. **分屏比例**：Split 模式下比例是否限制在 30%~70%
10. **性能**：拖拽过程中是否使用 requestAnimationFrame 或 CSS transform 避免重排
