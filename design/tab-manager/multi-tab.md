# F05-02 多标签页管理

## 1. 功能描述与目标

**功能描述**：Phase 2 阶段，在单文件展示模式基础上升级为完整的多标签页（Multi-Tab）管理系统。用户可以同时打开多个 Markdown 文件，通过标签栏进行切换、关闭、排序等操作。

**目标**：
- 支持同时打开多个文件，每个文件对应一个标签页
- 标签页展示文件名，支持关闭、关闭其他、关闭全部、关闭右侧
- 已修改未保存的标签显示修改指示器（橙色圆点）
- 鼠标悬停标签显示完整文件路径 Tooltip
- 支持中键关闭、Cmd/Ctrl+W 关闭当前标签
- 标签拖拽排序（Phase 2 可选增强）
- 标签栏超出宽度时支持横向滚动

**PRD 关联**：FR-002.3 ~ FR-002.6（多标签页、标签展示、修改指示器、大文件加载）

---

## 2. 技术实现方案

### 2.1 整体架构

```
┌──────────────────────────────────────────────────────┐
│ 📄 tab1.md  │ 📄 tab2.md  │ 📄 tab3.md (●)          │ ← TabBar.vue
├──────────────────────────────────────────────────────┤
│                                                      │
│                   ContentArea                        │ ← 显示 activeTab 对应内容
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 2.2 标签页数据结构扩展

将 MVP 阶段的单文件状态扩展为标签列表：

```typescript
// MVP 阶段 (F05-01) 与 Phase 2 (F05-02) 使用统一的 Store 结构：
// { tabs: TabItem[], activeTabId: string | null }
// 区别仅在于 MVP 限制 tabs.length ≤ 1，Phase 2 放开限制
```

每个 Tab 继承 MVP `TabItem` 的基础字段（`id`, `path`, `name`, `content`, `scrollPosition`），Phase 2 扩展以下字段：
- 光标位置（编辑模式下）
- 修改标记（是否已编辑未保存）

> **一致性说明**：Phase 2 的 `Tab` 接口是 MVP `TabItem` 的超集，新增字段不影响已有组件。`id` 使用文件路径（同一文件不重复打开）。

### 2.3 TabBar.vue 组件实现

```vue
<!-- components/tabs/TabBar.vue -->
<template>
  <div class="tab-bar" ref="tabBarRef">
    <div
      v-for="tab in tabs"
      :key="tab.id"
      class="tab"
      :class="{ active: tab.id === activeTabId, modified: tab.isModified }"
      @click="activateTab(tab.id)"
      @mousedown.middle="closeTab(tab.id)"
      @contextmenu.prevent="showContextMenu($event, tab.id)"
      :title="tab.path"
    >
      <FileIcon class="tab-icon" />
      <span class="tab-name">{{ tab.name }}</span>
      <span v-if="tab.isModified" class="tab-dot" />
      <span
        class="tab-close"
        @click.stop="closeTab(tab.id)"
      >
        <CloseIcon />
      </span>
    </div>

    <!-- 右键上下文菜单 -->
    <ContextMenu
      v-if="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenuItems"
      @select="handleMenuSelect"
      @close="contextMenu.visible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTabStore } from '@/stores/tabStore'
import FileIcon from '@/components/icons/FileIcon.vue'
import CloseIcon from '@/components/icons/CloseIcon.vue'
import ContextMenu from '@/components/common/ContextMenu.vue'

const tabStore = useTabStore()
const tabs = computed(() => tabStore.tabs)
const activeTabId = computed(() => tabStore.activeTabId)

const tabBarRef = ref<HTMLElement>()
const contextMenu = ref({ visible: false, x: 0, y: 0, tabId: '' })

function activateTab(id: string) {
  tabStore.activateTab(id)
}

function closeTab(id: string) {
  tabStore.closeTab(id)
}

function showContextMenu(event: MouseEvent, tabId: string) {
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    tabId,
  }
}

const contextMenuItems = computed(() => [
  { label: '关闭', action: 'close', id: contextMenu.value.tabId },
  { label: '关闭其他', action: 'closeOthers', id: contextMenu.value.tabId },
  { label: '关闭右侧', action: 'closeRight', id: contextMenu.value.tabId },
  { label: '关闭全部', action: 'closeAll', id: contextMenu.value.tabId },
])

function handleMenuSelect(item: MenuItem) {
  switch (item.action) {
    case 'close':
      tabStore.closeTab(item.id)
      break
    case 'closeOthers':
      tabStore.closeOthers(item.id)
      break
    case 'closeRight':
      tabStore.closeRight(item.id)
      break
    case 'closeAll':
      tabStore.closeAll()
      break
  }
  contextMenu.value.visible = false
}
</script>
```

### 2.4 TabItem.vue 单个标签组件

```vue
<!-- components/tabs/TabItem.vue -->
<template>
  <div
    class="tab-item"
    :class="{ active: isActive, modified: tab.isModified }"
    draggable="true"
    @dragstart="onDragStart"
    @dragover.prevent
    @drop="onDrop"
    @click="$emit('activate', tab.id)"
    @mousedown.middle="$emit('close', tab.id)"
  >
    <span class="tab-indicator" v-if="tab.isModified" />
    <FileIcon />
    <span class="tab-label">{{ tab.name }}</span>
    <button class="tab-close-btn" @click.stop="$emit('close', tab.id)">
      <CloseIcon />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Tab } from '@/types/tab'

interface Props {
  tab: Tab
  isActive: boolean
  index: number
}

defineProps<Props>()
defineEmits<{
  activate: [id: string]
  close: [id: string]
  reorder: [fromIndex: number, toIndex: number]
}>()

function onDragStart(e: DragEvent) {
  e.dataTransfer?.setData('text/tab-index', String(props.index))
}

function onDrop(e: DragEvent) {
  const fromIndex = Number(e.dataTransfer?.getData('text/tab-index'))
  emit('reorder', fromIndex, props.index)
}
</script>
```

### 2.5 标签页 Store 完整实现

```typescript
// stores/tabStore.ts (Phase 2 完整版)
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import type { Tab } from '@/types/tab'

export const useTabStore = defineStore('tab', () => {
  // ========== State ==========
  const tabs = ref<Tab[]>([])
  const activeTabId = ref<string | null>(null)

  // ========== Getters ==========
  const activeTab = computed(() =>
    tabs.value.find(t => t.id === activeTabId.value) ?? null
  )

  const activeContent = computed(() => activeTab.value?.content ?? '')
  const hasModifiedTabs = computed(() => tabs.value.some(t => t.isModified))

  const tabCount = computed(() => tabs.value.length)

  // ========== Actions ==========

  /** 打开或切换到标签 */
  async function openFile(path: string, name: string) {
    const existingTab = tabs.value.find(t => t.path === path)

    if (existingTab) {
      // 文件已在标签中，直接切换
      activeTabId.value = existingTab.id
      return
    }

    // 新标签：读取文件内容
    const content = await invoke<string>('read_file', { path })
    const newTab: Tab = {
      id: path, // 用路径作为唯一 ID（同一文件不重复打开）
      path,
      name,
      content,
      scrollPosition: 0,
      cursorPosition: { line: 0, ch: 0 },
      isModified: false,
    }

    tabs.value.push(newTab)
    activeTabId.value = newTab.id
  }

  /** 激活指定标签 */
  function activateTab(id: string) {
    activeTabId.value = id
  }

  /** 关闭指定标签 */
  function closeTab(id: string) {
    const index = tabs.value.findIndex(t => t.id === id)
    if (index === -1) return

    const tab = tabs.value[index]

    // 如果有未保存修改，提示确认（可扩展）
    if (tab.isModified) {
      // Phase 2 可选：弹出确认对话框
      // 此处简化处理，直接关闭（由调用方处理确认）
    }

    tabs.value.splice(index, 1)

    // 调整 activeTabId
    if (activeTabId.value === id) {
      if (tabs.value.length === 0) {
        activeTabId.value = null
      } else {
        // 优先激活左侧标签，否则第一个
        const newIndex = Math.min(index, tabs.value.length - 1)
        activeTabId.value = tabs.value[Math.max(0, newIndex)].id
      }
    }
  }

  /** 关闭其他标签 */
  function closeOthers(keepId: string) {
    const keepTab = tabs.value.find(t => t.id === keepId)
    if (!keepTab) return
    tabs.value = [keepTab]
    activeTabId.value = keepId
  }

  /** 关闭右侧标签 */
  function closeRight(anchorId: string) {
    const index = tabs.value.findIndex(t => t.id === anchorId)
    if (index === -1) return
    tabs.value = tabs.value.slice(0, index + 1)
    if (!tabs.value.find(t => t.id === activeTabId.value)) {
      activeTabId.value = anchorId
    }
  }

  /** 关闭全部标签 */
  function closeAll() {
    tabs.value = []
    activeTabId.value = null
  }

  /** 更新标签内容（编辑时） */
  function updateContent(id: string, content: string) {
    const tab = tabs.value.find(t => t.id === id)
    if (tab) {
      tab.content = content
      tab.isModified = true
    }
  }

  /** 标记标签为已保存 */
  function markSaved(id: string) {
    const tab = tabs.value.find(t => t.id === id)
    if (tab) {
      tab.isModified = false
    }
  }

  /** 保存滚动位置 */
  function saveScrollPosition(id: string, position: number) {
    const tab = tabs.value.find(t => t.id === id)
    if (tab) {
      tab.scrollPosition = position
    }
  }

  /** 标签拖拽排序 */
  function reorderTabs(fromIndex: number, toIndex: number) {
    const [moved] = tabs.value.splice(fromIndex, 1)
    tabs.value.splice(toIndex, 0, moved)
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    activeContent,
    hasModifiedTabs,
    tabCount,
    openFile,
    activateTab,
    closeTab,
    closeOthers,
    closeRight,
    closeAll,
    updateContent,
    markSaved,
    saveScrollPosition,
    reorderTabs,
  }
})
```

### 2.6 快捷键集成

```typescript
// composables/useKeyboard.ts 中的标签相关快捷键

function registerTabShortcuts() {
  const tabStore = useTabStore()

  useKeyboard({
    'Cmd+W': () => {
      if (tabStore.activeTabId) {
        tabStore.closeTab(tabStore.activeTabId)
      }
    },
    'Cmd+Tab': () => {
      // 切换到下一个标签
      const idx = tabStore.tabs.findIndex(t => t.id === tabStore.activeTabId)
      const next = tabStore.tabs[(idx + 1) % tabStore.tabs.length]
      if (next) tabStore.activateTab(next.id)
    },
    'Cmd+Shift+Tab': () => {
      // 切换到上一个标签
      const idx = tabStore.tabs.findIndex(t => t.id === tabStore.activeTabId)
      const prev = tabStore.tabs[(idx - 1 + tabStore.tabs.length) % tabStore.tabs.length]
      if (prev) tabStore.activateTab(prev.id)
    },
  })
}
```

---

## 3. 接口定义

### 3.1 Tab TypeScript Interface

```typescript
// types/tab.ts

/**
 * 标签页数据（Phase 2 完整版）
 * 继承 MVP 的 TabItem 接口，新增编辑相关字段
 */
export interface Tab {
  /** 唯一标识（使用文件绝对路径） */
  id: string
  /** 文件绝对路径 */
  path: string
  /** 文件名（含扩展名） */
  name: string
  /** 文件原始 Markdown 内容 */
  content: string
  /** 预览/编辑模式下的滚动位置 */
  scrollPosition: number
  /** 编辑器光标位置 */
  cursorPosition: CursorPosition
  /** 是否有未保存的修改 */
  isModified: boolean
}

export interface CursorPosition {
  line: number
  ch: number
}

/**
 * MVP 前瞻版 TabItem（F05-01 定义）
 * Tab 接口为其超集，保证数据结构兼容
 */
export interface TabItem {
  id: string
  path: string
  name: string
  content: string
  scrollPosition: number
}
```

### 3.2 TabBar 组件 Props / Emits

```typescript
// components/tabs/TabBar.vue
interface TabBarProps {
  // 无 Props，状态全部来自 tabStore
}

interface TabBarEmits {
  // 无 Emits，操作直接调用 tabStore Actions
}
```

### 3.3 TabItem 组件 Props / Emits

```typescript
// components/tabs/TabItem.vue
interface TabItemProps {
  tab: Tab
  isActive: boolean
  index: number
}

interface TabItemEmits {
  (e: 'activate', id: string): void
  (e: 'close', id: string): void
  (e: 'reorder', fromIndex: number, toIndex: number): void
}
```

### 3.4 ContextMenu 组件 Props

```typescript
// components/common/ContextMenu.vue
interface MenuItem {
  label: string
  action: string
  id: string
}

interface ContextMenuProps {
  x: number
  y: number
  items: MenuItem[]
}
```

---

## 4. 数据结构

### 4.1 Store 状态结构

```typescript
interface TabStoreState {
  tabs: Tab[]
  activeTabId: string | null
}

// 示例状态（打开 3 个文件）：
{
  tabs: [
    {
      id: "/Users/bigo/Knowledge/learn/Cpp/01_类型系统/变量.md",
      path: "/Users/bigo/Knowledge/learn/Cpp/01_类型系统/变量.md",
      name: "变量.md",
      content: "# 变量与常量\n\n变量是...",
      scrollPosition: 0,
      cursorPosition: { line: 0, ch: 0 },
      isModified: false,
    },
    {
      id: "/Users/bigo/Knowledge/learn/Cpp/02_指针/智能指针.md",
      path: "/Users/bigo/Knowledge/learn/Cpp/02_指针/智能指针.md",
      name: "智能指针.md",
      content: "# 智能指针\n\n`std::unique_ptr`...",
      scrollPosition: 450,
      cursorPosition: { line: 12, ch: 5 },
      isModified: true,  // 已编辑未保存
    },
  ],
  activeTabId: "/Users/bigo/Knowledge/learn/Cpp/02_指针/智能指针.md",
}
```

> **结构一致性**：`TabStoreState` 与 MVP 阶段的 `TabState`（F05-01）结构完全一致（`tabs` + `activeTabId`），确保从单文件到多标签的无缝升级。

### 4.2 TabBar 样式

```css
/* assets/styles/tabbar.css */
.tab-bar {
  display: flex;
  align-items: flex-end;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding-left: 4px;
  gap: 1px;
  overflow-x: auto;
  scrollbar-width: none; /* Firefox */
  height: var(--tabbar-height);
}

.tab-bar::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  font-family: var(--font-ui);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  position: relative;
  user-select: none;
}

.tab:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  background: var(--bg-primary);
}

.tab-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-amber);
  flex-shrink: 0;
}

.tab-close {
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  opacity: 0;
  transition: opacity 0.15s;
}

.tab:hover .tab-close {
  opacity: 1;
}

.tab-close:hover {
  background: var(--border);
}
```

---

## 5. 依赖关系

| 依赖模块 | 特性 | 说明 |
|---------|------|------|
| M05 | F05-01 单文件展示 | 在单文件状态管理上扩展为多标签 |
| M02 | F02-02 文件读写命令 | 新标签打开时调用 `read_file` |
| M04 | F04-02 树节点交互 | 双击/中键文件树节点在新标签打开 |
| M07 | F07-03 源码编辑器 | 编辑内容时通过 `updateContent` 更新标签状态 |
| M07 | F07-04 文件保存 | 保存后调用 `markSaved` 清除修改标记 |
| M08 | F08-04 配置持久化 | 应用重启后恢复上次打开的标签（可选 P3） |

**被依赖**：
- M03 F03-02 工具栏（标签栏嵌入工具栏下方）

---

## 6. 测试要点

### 6.1 单元测试（Store）

| 测试项 | 操作 | 预期结果 |
|--------|------|---------|
| 打开新文件 | openFile(path, name) | tabs 新增一项，activeTabId 指向新 tab |
| 打开已存在文件 | openFile(已打开路径) | 不新增 tab，仅切换 activeTabId |
| 关闭标签 | closeTab(id) | tabs 移除对应项，activeTabId 自动调整 |
| 关闭最后一个标签 | closeTab(唯一标签) | tabs 为空，activeTabId 为 null |
| 关闭活动标签 | closeTab(activeTabId) | 自动激活左侧或第一个标签 |
| 关闭其他 | closeOthers(id) | 仅剩指定标签 |
| 关闭右侧 | closeRight(id) | 保留当前及左侧所有标签 |
| 更新内容 | updateContent(id, content) | 对应 tab.isModified = true |
| 标记保存 | markSaved(id) | 对应 tab.isModified = false |
| 拖拽排序 | reorderTabs(0, 2) | tabs 数组顺序正确调整 |

### 6.2 组件测试

1. **TabBar 渲染**：打开 5 个标签，验证全部正确渲染文件名
2. **修改指示器**：编辑文件后验证橙色圆点显示
3. **Tooltip**：鼠标悬停标签，验证显示完整路径
4. **中键关闭**：鼠标中键点击标签，验证标签关闭
5. **右键菜单**：右键标签，验证菜单正确弹出
6. **标签溢出**：打开大量标签，验证横向滚动正常

### 6.3 快捷键测试

| 快捷键 | 操作 | 预期结果 |
|--------|------|---------|
| Cmd+W | 关闭当前标签 | activeTab 切换或清空 |
| Cmd+Tab | 切换到下一标签 | activeTabId 循环切换 |
| Cmd+Shift+Tab | 切换到上一标签 | activeTabId 反向循环 |

### 6.4 E2E 测试

1. 打开知识库，依次点击 5 个不同文件，验证标签栏正常显示
2. 关闭中间标签，验证标签顺序和 active 状态正确
3. 编辑文件内容，验证修改指示器出现；保存后消失
4. 切换标签，验证各标签的滚动位置独立保持
5. 拖拽标签排序，验证顺序持久化（如实现）

### 6.5 性能测试

| 指标 | 目标 |
|------|------|
| 打开 10 个标签内存占用 | < 200MB（PRD NFR-001） |
| 标签切换响应时间 | < 50ms |
| 同时打开 20 个标签 | 无卡顿，TabBar 可横向滚动 |
