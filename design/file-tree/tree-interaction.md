# F04-02 树节点交互

## 1. 功能描述与目标

实现文件树节点的完整交互体系，提升导航效率和用户体验：

- **单击**：选中节点 + 打开文件（如果是 .md 文件）
- **双击**：在新标签页打开文件（P2 阶段）
- **右键菜单**：在 Finder/Explorer 中显示、复制绝对路径
- **展开/折叠全部**：一键展开或折叠所有目录层级
- **键盘导航**：上下箭头切换节点、Enter 打开、左右箭头展开/折叠
- **拖拽打开**：拖拽目录到应用窗口打开（MVP）、拖拽 .md 文件到窗口直接打开编辑

**核心目标**：
- 交互响应即时，无延迟感知
- 键盘无障碍访问（WCAG 标准）
- 选中节点高亮样式符合原型设计

## 2. 技术实现方案

### 2.1 交互事件处理

```vue
<!-- TreeNode.vue -->
<template>
  <div class="tree-node-wrapper">
    <div
      class="tree-node"
      :class="{ active: isActive }"
      :style="nodeStyle"
      :tabindex="node.isDir ? -1 : 0"
      @click="handleClick"
      @dblclick="handleDblClick"
      @contextmenu.prevent="handleContextMenu"
      @keydown="handleKeydown"
      ref="nodeRef"
    >
      <!-- ... 节点内容 ... -->
    </div>
    <!-- 子节点 -->
  </div>
</template>
```

```typescript
// TreeNode.vue <script setup>
import { ref, computed } from 'vue'
import { useFileTreeStore } from '@/stores/fileTreeStore'
import { useTabStore } from '@/stores/tabStore'
import { emit as tauriEmit } from '@tauri-apps/api/event'

const props = defineProps<{ node: FileTreeNode; depth: number }>()

const fileTreeStore = useFileTreeStore()
const tabStore = useTabStore()
const nodeRef = ref<HTMLElement>()

const isActive = computed(() => fileTreeStore.selectedPath === props.node.path)
const isExpanded = computed(() => fileTreeStore.isExpanded(props.node.path))

// 单击处理
function handleClick(e: MouseEvent) {
  if (props.node.isDir) {
    fileTreeStore.toggleExpand(props.node.path)
  }
  fileTreeStore.selectNode(props.node.path)

  if (!props.node.isDir) {
    tabStore.openFile(props.node.path, props.node.name)
  }
}

// 双击处理（P2：在新标签页打开）
function handleDblClick(e: MouseEvent) {
  if (!props.node.isDir) {
    tabStore.openFile(props.node.path, props.node.name, { newTab: true })
  }
}

// 右键菜单
function handleContextMenu(e: MouseEvent) {
  fileTreeStore.selectNode(props.node.path)
  showContextMenu(e, props.node)
}

// 键盘导航
function handleKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowRight':
      if (props.node.isDir && !isExpanded.value) {
        fileTreeStore.toggleExpand(props.node.path)
      }
      break
    case 'ArrowLeft':
      if (props.node.isDir && isExpanded.value) {
        fileTreeStore.toggleExpand(props.node.path)
      }
      break
    case 'Enter':
      if (!props.node.isDir) {
        tabStore.openFile(props.node.path, props.node.name)
      } else {
        fileTreeStore.toggleExpand(props.node.path)
      }
      break
  }
}
```

### 2.2 右键上下文菜单

```typescript
// composables/useTreeContextMenu.ts
import { open as openExternal } from '@tauri-apps/plugin-shell'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'

export function useTreeContextMenu() {
  function showContextMenu(event: MouseEvent, node: FileTreeNode) {
    const menuItems = [
      {
        label: '在文件夹中显示',
        action: () => openExternal(`file://${node.path}`)
      },
      {
        label: '复制路径',
        action: () => writeText(node.path)
      }
    ]

    // 使用原生菜单或自定义浮动菜单
    if (node.isDir) {
      menuItems.unshift(
        { label: '展开', action: () => expandDir(node.path) },
        { label: '折叠', action: () => collapseDir(node.path) }
      )
    }

    renderCustomContextMenu(event.clientX, event.clientY, menuItems)
  }

  return { showContextMenu }
}
```

### 2.3 键盘导航系统

```typescript
// composables/useTreeKeyboard.ts
import { onMounted, onUnmounted } from 'vue'
import { useFileTreeStore } from '@/stores/fileTreeStore'

export function useTreeKeyboard(containerRef: Ref<HTMLElement | null>) {
  const fileTreeStore = useFileTreeStore()

  function getVisibleNodes(): HTMLElement[] {
    if (!containerRef.value) return []
    return Array.from(containerRef.value.querySelectorAll('.tree-node'))
  }

  function focusNode(index: number) {
    const nodes = getVisibleNodes()
    const node = nodes[index]
    if (node) {
      node.focus()
      const path = node.dataset.path
      if (path) fileTreeStore.selectNode(path)
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    const nodes = getVisibleNodes()
    const currentIndex = nodes.findIndex(n => n === document.activeElement)

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        focusNode(Math.min(currentIndex + 1, nodes.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        focusNode(Math.max(currentIndex - 1, 0))
        break
      case 'Home':
        e.preventDefault()
        focusNode(0)
        break
      case 'End':
        e.preventDefault()
        focusNode(nodes.length - 1)
        break
    }
  }

  onMounted(() => {
    containerRef.value?.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    containerRef.value?.removeEventListener('keydown', handleKeydown)
  })
}
```

### 2.4 拖拽打开

支持将目录和 `.md` 文件从系统文件管理器拖拽到应用窗口，实现快速打开。拖拽事件监听注册在 `AppLayout.vue` 根容器上，覆盖整个窗口区域。

#### 2.4.1 拖拽行为规范

| 拖拽目标 | 行为 | PRD 需求 |
|---------|------|----------|
| 目录 | 加载为文件树根目录，调用 `fileTreeStore.loadDirectory(path)` | FR-001.2 |
| `.md` 文件 | 直接打开编辑，调用 `tabStore.openFile(path, name)`，同时加载文件树（取父目录） | FR-001.2 扩展 |
| 非 `.md` 文件 | 忽略，不触发任何操作 | — |
| 多个文件/目录 | 仅处理第一个有效项（目录优先） | — |

#### 2.4.2 拖拽视觉反馈

拖拽过程中在窗口上显示半透明覆盖层，提示用户释放操作：

```vue
<!-- AppLayout.vue -->
<template>
  <div
    class="app-layout"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <!-- 拖拽覆盖层 -->
    <div v-if="isDragOver" class="drag-overlay">
      <div class="drag-overlay-content">
        <FolderOpenIcon class="drag-icon" />
        <span class="drag-text">{{ dragHintText }}</span>
      </div>
    </div>
    <!-- 正常布局内容 -->
  </div>
</template>
```

```css
/* 拖拽覆盖层样式 */
.drag-overlay {
  position: absolute;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  pointer-events: none;
}

.drag-overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 48px;
  background: var(--bg-primary);
  border: 2px dashed var(--accent);
  border-radius: 12px;
  pointer-events: auto;
}

.drag-icon {
  width: 48px;
  height: 48px;
  color: var(--accent);
}

.drag-text {
  font-size: 14px;
  color: var(--text-secondary);
}
```

#### 2.4.3 拖拽实现逻辑

```typescript
// composables/useDragOpen.ts
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useFileTreeStore } from '@/stores/fileTreeStore'
import { useTabStore } from '@/stores/tabStore'

export function useDragOpen() {
  const fileTreeStore = useFileTreeStore()
  const tabStore = useTabStore()

  const isDragOver = ref(false)
  const dragCounter = ref(0) // 解决嵌套元素 dragleave 误触发问题
  const dragType = ref<'directory' | 'markdown' | 'unsupported' | null>(null)

  const dragHintText = computed(() => {
    switch (dragType.value) {
      case 'directory': return '释放以打开目录'
      case 'markdown': return '释放以打开文件'
      default: return '不支持此文件类型'
    }
  })

  function detectDragType(e: DragEvent): 'directory' | 'markdown' | 'unsupported' | null {
    const items = e.dataTransfer?.items
    if (!items || items.length === 0) return null

    for (const item of items) {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry()
        if (entry?.isDirectory) return 'directory'
        // 检查是否为 .md 文件
        const file = item.getAsFile()
        if (file?.name.endsWith('.md')) return 'markdown'
      }
    }
    return 'unsupported'
  }

  function onDragEnter(e: DragEvent) {
    e.preventDefault()
    dragCounter.value++
    if (dragCounter.value === 1) {
      dragType.value = detectDragType(e)
      isDragOver.value = true
    }
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault()
    // 更新拖拽类型（dragover 时 dataTransfer 可能更完整）
    if (dragType.value === null) {
      dragType.value = detectDragType(e)
    }
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = dragType.value === 'unsupported' ? 'none' : 'copy'
    }
  }

  function onDragLeave(e: DragEvent) {
    dragCounter.value--
    if (dragCounter.value === 0) {
      isDragOver.value = false
      dragType.value = null
    }
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault()
    isDragOver.value = false
    dragCounter.value = 0
    dragType.value = null

    const items = e.dataTransfer?.items
    if (!items) return

    for (const item of items) {
      if (item.kind !== 'file') continue

      const entry = item.webkitGetAsEntry()

      // 优先处理目录
      if (entry?.isDirectory) {
        const path = (item.getAsFile() as any)?.path
        if (path) {
          await fileTreeStore.loadDirectory(path)
          return
        }
      }

      // 处理 .md 文件
      const file = item.getAsFile()
      if (file?.name.endsWith('.md')) {
        const path = (file as any)?.path
        if (path) {
          // 加载父目录作为文件树根目录
          const parentDir = path.substring(0, path.lastIndexOf('/'))
          await fileTreeStore.loadDirectory(parentDir)
          // 打开该文件
          tabStore.openFile(path, file.name)
          return
        }
      }
    }

    // 非 .md 文件：忽略，不显示错误提示（静默忽略）
  }

  return {
    isDragOver,
    dragHintText,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
  }
}
```

#### 2.4.4 兼容性说明

| API | 兼容性 | 说明 |
|-----|--------|------|
| `webkitGetAsEntry()` | Chrome / Safari / Edge / Tauri WebView | 用于判断拖入的是文件还是目录，Tauri WebView 基于 Chromium/WebKit 均支持 |
| `item.getAsFile()?.path` | 仅 Tauri 环境 | 在浏览器中出于安全限制返回空字符串，Tauri WebView 中返回完整文件系统路径 |
| `DragEvent.dataTransfer` | 全平台 | 标准 Web API |

**降级策略**：如果 `webkitGetAsEntry()` 不可用（理论上在 Tauri 中不会出现），则回退到仅处理 `.md` 文件拖拽（通过 `getAsFile()` 的 `name` 属性判断扩展名），跳过目录拖拽功能。

#### 2.4.5 dragleave 嵌套元素问题

当拖拽经过含有子元素的容器时，进入/离开子元素会触发额外的 `dragenter`/`dragleave` 事件。使用计数器 `dragCounter` 解决：

- `dragenter`：`dragCounter++`，当从 0→1 时显示覆盖层
- `dragleave`：`dragCounter--`，当变为 0 时隐藏覆盖层
- `drop`：重置 `dragCounter = 0`，隐藏覆盖层

## 3. 接口定义

### TreeNode.vue Props/Emits

```typescript
interface TreeNodeProps {
  node: FileTreeNode
  depth: number
}

interface TreeNodeEmits {
  (e: 'select', node: FileTreeNode): void
  (e: 'toggle', node: FileTreeNode): void
  (e: 'open', node: FileTreeNode): void
  (e: 'contextmenu', event: MouseEvent, node: FileTreeNode): void
}
```

### useTreeContextMenu 导出

| 导出 | 类型 | 说明 |
|------|------|------|
| `showContextMenu(event, node)` | `(MouseEvent, FileTreeNode) => void` | 显示右键菜单 |

### useTreeKeyboard 导出

| 导出 | 类型 | 说明 |
|------|------|------|
| `useTreeKeyboard(containerRef)` | `(Ref<HTMLElement>) => void` | 为容器绑定键盘导航 |

### useDragOpen 导出

| 导出 | 类型 | 说明 |
|------|------|------|
| `isDragOver` | `Ref<boolean>` | 是否正在拖拽悬停 |
| `dragHintText` | `ComputedRef<string>` | 覆盖层提示文字 |
| `onDragEnter` | `(e: DragEvent) => void` | 拖拽进入事件处理 |
| `onDragOver` | `(e: DragEvent) => void` | 拖拽悬停事件处理 |
| `onDragLeave` | `(e: DragEvent) => void` | 拖拽离开事件处理 |
| `onDrop` | `(e: DragEvent) => Promise<void>` | 拖拽释放事件处理 |

## 4. 数据结构

```typescript
// types/tree.ts
export interface ContextMenuItem {
  label: string
  icon?: Component
  shortcut?: string
  action: () => void
  separator?: boolean
  disabled?: boolean
}

export interface TreeInteractionState {
  contextMenuVisible: boolean
  contextMenuX: number
  contextMenuY: number
  contextMenuItems: ContextMenuItem[]
}
```

## 5. 依赖关系

| 依赖模块 | 说明 |
|---------|------|
| F04-01 文件树核心组件 | TreeNode 组件继承自 tree-core 的基础渲染 |
| F05-01 单文件展示 / F05-02 多标签页 | 点击文件节点调用 tabStore.openFile() |
| F02-01 目录扫描服务 | 拖拽目录后调用 loadDirectory() |
| @tauri-apps/plugin-shell | `open` 命令在系统文件管理器中显示 |
| @tauri-apps/plugin-clipboard-manager | `writeText` 复制路径到剪贴板 |
| F05-01 单文件展示 / F05-02 多标签页 | 拖拽 .md 文件后调用 tabStore.openFile() |

## 6. PRD 需求追溯

- **FR-001.2**：支持拖拽目录到应用窗口打开 → 拖拽目录到窗口加载为文件树根目录
- **FR-001.2 扩展**：拖拽 .md 文件到窗口直接打开编辑 → 加载父目录为文件树 + 打开文件标签页
- **FR-001.3**：仅展示 `.md` 文件和包含 `.md` 文件的目录 → 非 .md 文件拖拽静默忽略

## 7. 测试要点

1. **单击打开**：单击 .md 文件节点是否正确打开文件内容
2. **单击展开**：单击目录节点是否正确展开/折叠
3. **双击新标签**（P2）：双击文件是否在新标签页打开
4. **右键菜单**：右键点击是否显示菜单（在文件夹中显示、复制路径）
5. **复制路径**：点击复制路径后剪贴板内容是否正确
6. **键盘上下**：按上下箭头是否在可见节点间移动焦点
7. **键盘左右**：按左右箭头是否展开/折叠目录
8. **键盘 Enter**：按 Enter 是否打开文件或展开目录
9. **键盘 Home/End**：是否跳转到第一个/最后一个节点
10. **拖拽打开目录**：拖拽目录到窗口是否触发加载文件树
11. **拖拽打开文件**：拖拽 .md 文件到窗口是否加载父目录并打开文件
12. **拖拽视觉反馈**：拖拽悬停时是否显示覆盖层和提示文字
13. **拖拽非 .md 文件**：拖拽非 .md 文件到窗口是否静默忽略
14. **选中同步**：文件树选中状态是否与 tabStore 活动标签同步
15. **焦点可见性**：键盘导航时焦点环是否清晰可见
16. **拖拽离开**：拖拽离开窗口后覆盖层是否正确消失
17. **多个文件拖拽**：拖拽多个项时是否仅处理第一个有效项
