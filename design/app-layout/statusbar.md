# F03-03 状态栏组件

## 1. 功能描述与目标

实现 MKPreview 底部状态栏（StatusBar），常驻显示当前文件及编辑器状态信息：

- **左侧信息区**：文件编码（UTF-8）、文件类型（Markdown）、总行数、文件大小
- **右侧状态区**：保存状态（已保存/未保存）、光标位置（行:列，P2 编辑模式）

**核心目标**：
- 高度 24px，背景 `--bg-tertiary`，字体 11px，颜色 `--text-muted`
- 信息实时跟随当前活动文件变化
- MVP 阶段以只读状态为主，P2 编辑模式时显示光标位置

## 2. 技术实现方案

### 2.1 Vue 3 组件设计

```vue
<!-- StatusBar.vue -->
<template>
  <footer class="statusbar">
    <div class="status-left">
      <template v-if="currentFile">
        <span class="status-item">UTF-8</span>
        <span class="status-sep">|</span>
        <span class="status-item">Markdown</span>
        <span class="status-sep">|</span>
        <span class="status-item">{{ lineCount }} 行</span>
        <span class="status-sep">|</span>
        <span class="status-item">{{ formattedFileSize }}</span>
      </template>
      <template v-else>
        <span class="status-item">就绪</span>
      </template>
    </div>
    <div class="status-right">
      <span v-if="isDirty" class="status-dirty">未保存</span>
      <span v-else-if="currentFile" class="status-saved">已保存</span>
      <template v-if="isEditing && cursorPosition">
        <span class="status-sep">|</span>
        <span class="status-item">
          Ln {{ cursorPosition.line }}, Col {{ cursorPosition.column }}
        </span>
      </template>
    </div>
  </footer>
</template>
```

### 2.2 CSS 布局方案

```css
/* StatusBar.vue <style scoped> */
.statusbar {
  grid-area: status;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-muted);
  height: 24px;
  flex-shrink: 0;
  user-select: none;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-item {
  white-space: nowrap;
}

.status-sep {
  color: var(--border);
  user-select: none;
}

.status-saved {
  color: var(--accent-green);
}

.status-dirty {
  color: var(--accent-amber);
}
```

### 2.3 计算属性实现

```typescript
// StatusBar.vue <script setup>
import { computed } from 'vue'
import { useTabStore } from '@/stores/tabStore'
import { useEditorStore } from '@/stores/editorStore'
import { formatFileSize } from '@/lib/utils'

const tabStore = useTabStore()
const editorStore = useEditorStore()

const currentFile = computed(() => tabStore.activeTab)
const lineCount = computed(() => {
  if (!currentFile.value?.content) return 0
  return currentFile.value.content.split('\n').length
})
const formattedFileSize = computed(() => {
  if (!currentFile.value?.size) return ''
  return formatFileSize(currentFile.value.size)
})
const isDirty = computed(() => editorStore.isDirty)
const isEditing = computed(() => editorStore.isEditing)
const cursorPosition = computed(() => editorStore.cursorPosition)
```

### 2.4 工具函数

```typescript
// lib/utils.ts
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
```

## 3. 接口定义

### StatusBar.vue Props/Emits

```typescript
// 无 Props，全部状态从 Pinia Store 读取
// 无 Emits
```

### 依赖 Store

| Store | 字段 | 说明 |
|-------|------|------|
| `tabStore` | `activeTab` | 当前活动标签/文件 |
| `tabStore` | `activeTab.content` | 文件内容，用于计算行数 |
| `tabStore` | `activeTab.size` | 文件大小（字节） |
| `editorStore` | `isDirty` | 是否有未保存修改 |
| `editorStore` | `isEditing` | 是否处于编辑模式 |
| `editorStore` | `cursorPosition` | 光标位置 `{ line, column }` |

## 4. 数据结构

```typescript
// types/editor.ts
export interface CursorPosition {
  line: number
  column: number
}

// stores/editorStore.ts
export const useEditorStore = defineStore('editor', () => {
  const isDirty = ref(false)
  const isEditing = ref(false)
  const cursorPosition = ref<CursorPosition>({ line: 1, column: 1 })

  function setCursorPosition(pos: CursorPosition) {
    cursorPosition.value = pos
  }

  function markDirty(dirty: boolean) {
    isDirty.value = dirty
  }

  return { isDirty, isEditing, cursorPosition, setCursorPosition, markDirty }
})
```

## 5. 依赖关系

| 依赖模块 | 说明 |
|---------|------|
| F03-01 CSS Grid 整体布局 | StatusBar 作为 AppLayout 的子组件嵌入 grid-area: status |
| F05-01 单文件展示 / F05-02 多标签页 | tabStore 提供当前活动文件信息 |
| F07-03 CodeMirror 可编辑模式 | editorStore 提供光标位置和修改状态 |
| F08-01 CSS 变量主题系统 | --bg-tertiary、--text-muted、--accent-green 等变量 |

## 6. 测试要点

1. **空状态**：未打开任何文件时，状态栏显示"就绪"
2. **文件信息**：打开文件后是否正确显示 UTF-8、Markdown、行数、文件大小
3. **行数计算**：内容为空时显示 1 行，多行内容时行数是否正确
4. **文件大小格式化**：B/KB/MB 单位转换是否正确
5. **保存状态**：未保存时显示"未保存"（琥珀色），已保存时显示"已保存"（绿色）
6. **光标位置**（P2）：编辑模式下是否实时显示 Ln/Col
7. **主题切换**：文字颜色和边框色是否跟随暗色/亮色主题正确变化
8. **信息刷新**：切换标签页时状态栏信息是否即时更新
