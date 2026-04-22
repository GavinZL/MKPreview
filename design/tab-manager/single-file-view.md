# F05-01 单文件展示模式

## 1. 功能描述与目标

**功能描述**：MVP 阶段，MKPreview 不实现多标签页，而是采用简化的单文件展示模式。当用户在文件树中点击某个 Markdown 文件时，直接在内容区加载并展示该文件内容。

**目标**：
- 提供最小可用的文件内容展示能力
- 支持文件内容的加载与显示（预览模式和源码模式）
- 为大文件加载提供进度反馈，不阻塞 UI
- 通过 Pinia Store 管理当前活动文件的状态
- 为 Phase 2 的多标签页管理奠定数据结构和状态管理基础

**PRD 关联**：FR-002（文件内容加载与展示）

---

## 2. 技术实现方案

### 2.1 整体流程

```
用户点击文件树中的文件
    │
    ▼
tabStore.openFile(path, name) → tabs[0] = { id, path, name, content, scrollPosition }
    │                           activeTabId = id（MVP 限制 tabs.length ≤ 1）
    ▼
调用 Rust read_file(path) 读取原始文本
    │
    ▼
文件内容存入 tabs[0].content
    │
    ▼
根据当前模式 (preview / source) 渲染内容
    │
    ├──► Preview 模式 → MarkdownPreview 组件渲染
    └──► Source 模式 → SourceEditor 组件显示
```

### 2.2 大文件加载处理

当文件超过 5000 行（约 200KB）时，为避免阻塞 UI：

1. 先快速读取文件内容（Rust 后端 read_file 是同步调用但通过 IPC 异步返回）
2. 前端显示加载进度遮罩（spinner + "加载中..." 文字）
3. 内容到达后一次性渲染（MVP 阶段不做增量渲染，Phase 3 优化）

```typescript
// composables/useFileLoader.ts
import { invoke } from '@tauri-apps/api/core'
import { ref } from 'vue'

export function useFileLoader() {
  const isLoading = ref(false)
  const loadingProgress = ref(0)

  async function loadFile(path: string): Promise<string> {
    isLoading.value = true
    loadingProgress.value = 0

    try {
      // Tauri IPC 调用 Rust 后端读取文件
      const content = await invoke<string>('read_file', { path })
      return content
    } finally {
      isLoading.value = false
    }
  }

  return { loadFile, isLoading, loadingProgress }
}
```

### 2.3 SourceEditor.vue 与 MarkdownPreview.vue 的切换

在单文件模式下，内容区通过条件渲染展示不同组件：

```vue
<!-- components/editor/SingleFileView.vue -->
<template>
  <div class="single-file-view">
    <!-- 加载中状态 -->
    <div v-if="isLoading" class="loading-overlay">
      <LoadingSpinner />
      <span>正在加载文件...</span>
    </div>

    <!-- 空状态：未选择文件 -->
    <EmptyState v-else-if="!activeTab" />

    <!-- 内容展示 -->
    <template v-else>
      <MarkdownPreview
        v-if="displayMode === 'preview'"
        :content="currentContent"
      />
      <SourceEditor
        v-else-if="displayMode === 'source'"
        :content="currentContent"
        :readonly="true"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTabStore } from '@/stores/tabStore'
import { useSettingsStore } from '@/stores/settingsStore'
import MarkdownPreview from '@/components/preview/MarkdownPreview.vue'
import SourceEditor from '@/components/editor/SourceEditor.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { useFileLoader } from '@/composables/useFileLoader'

const tabStore = useTabStore()
const settingsStore = useSettingsStore()
const { isLoading } = useFileLoader()

const activeTab = computed(() => tabStore.activeTab)
const currentContent = computed(() => tabStore.activeContent)
const displayMode = computed(() => settingsStore.displayMode)
</script>
```

### 2.4 文件切换时的滚动位置记忆

单文件模式下，虽然不涉及标签切换，但切换文件时应重置滚动位置。此逻辑为 Phase 2 多标签页中的滚动记忆做铺垫。

```typescript
// stores/tabStore.ts (MVP 前瞻版：数据结构兼容多标签，但逻辑限制单文件)

export interface TabItem {
  id: string        // 唯一标识（使用文件绝对路径）
  path: string
  name: string
  content: string
  scrollPosition: number
}

const state = () => ({
  tabs: [] as TabItem[],
  activeTabId: null as string | null,
})

// Getters
const activeTab = computed(() =>
  state.tabs.find(t => t.id === state.activeTabId) ?? null
)
const activeContent = computed(() => activeTab.value?.content ?? '')

const actions = {
  async openFile(path: string, name: string) {
    // MVP 阶段：始终只有一个标签，新文件直接替换
    // Phase 2：放开限制，改为查找已有标签或创建新标签
    const content = await loadFile(path)
    const id = path

    if (state.tabs.length > 0) {
      // 保存当前标签滚动位置
      state.tabs[0].scrollPosition = getCurrentScrollPosition()
    }

    state.tabs = [{ id, path, name, content, scrollPosition: 0 }]
    state.activeTabId = id
  },

  clearFile() {
    state.tabs = []
    state.activeTabId = null
  },

  // MVP 阶段预留的 Phase 2 接口
  saveScrollPosition(position: number) {
    const tab = state.tabs.find(t => t.id === state.activeTabId)
    if (tab) tab.scrollPosition = position
  }
}
```

---

## 3. 接口定义

### 3.1 Pinia Store：tabStore（MVP 前瞻版）

```typescript
// stores/tabStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'

/** 标签项（与 Phase 2 多标签结构完全一致） */
export interface TabItem {
  /** 唯一标识（使用文件绝对路径） */
  id: string
  /** 文件绝对路径 */
  path: string
  /** 文件名（含 .md 后缀） */
  name: string
  /** 文件原始 Markdown 内容 */
  content: string
  /** 预览/编辑模式下的滚动位置 */
  scrollPosition: number
}

export const useTabStore = defineStore('tab', () => {
  // ========== State ==========
  /** 标签列表（MVP 阶段限制长度 ≤ 1） */
  const tabs = ref<TabItem[]>([])
  /** 当前活动标签 ID */
  const activeTabId = ref<string | null>(null)
  const isLoading = ref(false)

  // ========== Getters ==========
  const activeTab = computed(() =>
    tabs.value.find(t => t.id === activeTabId.value) ?? null
  )
  const activeContent = computed(() => activeTab.value?.content ?? '')
  const hasActiveFile = computed(() => activeTab.value !== null)
  const fileName = computed(() => activeTab.value?.name ?? '')
  const filePath = computed(() => activeTab.value?.path ?? '')

  // ========== Actions ==========
  async function openFile(path: string, name: string) {
    isLoading.value = true
    try {
      const content = await invoke<string>('read_file', { path })
      const id = path

      // MVP：始终替换为单个标签；Phase 2 改为查找已有标签或 push 新标签
      tabs.value = [{ id, path, name, content, scrollPosition: 0 }]
      activeTabId.value = id
    } catch (error) {
      console.error('Failed to load file:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  function clearFile() {
    tabs.value = []
    activeTabId.value = null
  }

  /** 保存当前活动标签的滚动位置（Phase 2 多标签切换时复用） */
  function saveScrollPosition(position: number) {
    const tab = tabs.value.find(t => t.id === activeTabId.value)
    if (tab) tab.scrollPosition = position
  }

  /** 恢复当前活动标签的滚动位置 */
  function restoreScrollPosition(): number {
    return activeTab.value?.scrollPosition ?? 0
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    activeContent,
    isLoading,
    hasActiveFile,
    fileName,
    filePath,
    openFile,
    clearFile,
    saveScrollPosition,
    restoreScrollPosition,
  }
})
```

> **设计说明**：MVP 阶段的 `tabStore` 在数据结构上**完全兼容 Phase 2 多标签**，区别仅在于业务逻辑限制（`tabs.length ≤ 1`）。这样 Phase 2 时只需放开长度限制并增加标签切换/关闭逻辑，无需修改数据结构或重构组件。

### 3.2 SingleFileView 组件 Props / Emits

```typescript
interface SingleFileViewProps {
  // 无 Props，所有状态从 Store 获取
}

interface SingleFileViewEmits {
  // 无 Emits
}
```

### 3.3 useFileLoader Composable

```typescript
// composables/useFileLoader.ts
export interface UseFileLoaderReturn {
  loadFile: (path: string) => Promise<string>
  isLoading: Ref<boolean>
  loadingProgress: Ref<number>
}
```

### 3.4 Rust IPC 命令

```rust
// src-tauri/src/commands/file_system.rs
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    // 路径安全校验：canonicalize 后验证在 FS Scope 内
    let canonical = std::fs::canonicalize(&path)
        .map_err(|e| format!("Invalid path: {}", e))?;

    // 读取 UTF-8 文件
    let content = std::fs::read_to_string(&canonical)
        .map_err(|e| format!("Read failed: {}", e))?;

    Ok(content)
}
```

---

## 4. 数据结构

### 4.1 TypeScript Interface

```typescript
// types/tab.ts

/** 标签项（MVP 前瞻版，与 Phase 2 多标签结构完全一致） */
export interface TabItem {
  /** 唯一标识（使用文件绝对路径） */
  id: string
  /** 文件绝对路径 */
  path: string
  /** 文件名（含 .md 后缀） */
  name: string
  /** 文件原始 Markdown 内容 */
  content: string
  /** 预览/编辑模式下的滚动位置 */
  scrollPosition: number
}

/** 文件加载状态 */
export interface FileLoadState {
  isLoading: boolean
  progress: number // 0-100，MVP 阶段仅 0/100 两个状态
  error: string | null
}
```

### 4.2 Pinia Store State 类型

```typescript
// stores/tabStore.ts
export interface TabState {
  tabs: TabItem[]
  activeTabId: string | null
  isLoading: boolean
}
```

> **MVP 约束**：`tabs.length` 始终为 0 或 1。打开新文件时直接替换 `tabs[0]`，不保留历史。

## 7. MVP → Phase 2 迁移策略

本章节说明 MVP 阶段的 Store 设计如何平滑过渡到 Phase 2 多标签页管理。

### 7.1 数据结构零变更

MVP 的 `TabItem` 接口与 Phase 2 的 `Tab` 接口字段完全一致（`id`, `path`, `name`, `content`, `scrollPosition`）。Phase 2 仅需扩展字段（如 `cursorPosition`, `isModified`），不影响已有代码。

### 7.2 Store 逻辑演进

| 阶段 | `tabs` 长度限制 | `openFile` 行为 | 新增 Actions |
|------|----------------|----------------|-------------|
| MVP | `≤ 1` | 始终替换 `tabs[0]` | `saveScrollPosition`, `restoreScrollPosition` |
| Phase 2 | 无限制 | 查找已有 → 切换；否则 push 新标签 | `closeTab`, `activateTab`, `closeOthers`, `closeRight`, `closeAll`, `updateContent`, `markSaved`, `reorderTabs` |

### 7.3 组件层影响

- **SingleFileView.vue**：无需修改，它只关心 `activeContent`，对 `tabs.length` 无感知
- **MarkdownPreview.vue / SourceEditor.vue**：无需修改，通过 Props 接收 `content`
- **TabBar.vue**（Phase 2 新增）：直接绑定 `tabStore.tabs` 和 `tabStore.activeTabId`

### 7.4 状态持久化（Phase 3 可选）

应用重启时恢复标签页，需序列化 `tabs` 中的 `id`, `path`, `name`（不序列化 `content`，启动后懒加载）。`activeTabId` 一并持久化。

---

### 4.3 加载状态 CSS

```css
/* assets/styles/loading.css */
.loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: var(--text-secondary);
  font-size: 14px;
}

.loading-overlay .spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

## 5. 依赖关系

| 依赖模块 | 特性 | 说明 |
|---------|------|------|
| M02 (后端文件服务) | F02-02 文件读写命令 | 依赖 `read_file` Tauri Command |
| M04 (文件树) | F04-01 文件树核心组件 | 文件树点击事件触发单文件打开 |
| M03 (应用布局框架) | F03-01 CSS Grid 布局 | 需要 ContentArea 容器 |
| M06 (Markdown 渲染引擎) | F06-06 预览主组件 | 预览模式依赖 MarkdownPreview |
| M07 (编辑器) | F07-01 CodeMirror 只读查看器 | 源码模式依赖 SourceEditor |
| M08 (主题与设置) | F08-02 主题切换 | 需要 settingsStore 中的 displayMode |

**被依赖**：
- M07 F07-02 模式切换（需要 currentContent 作为数据源）
- M06 F06-06 预览主组件（需要 currentContent）

---

## 6. 测试要点

### 6.1 单元测试

| 测试项 | 输入 | 预期结果 |
|--------|------|---------|
| 打开有效文件 | 点击文件树中的 `.md` 文件 | activeFile 更新，currentContent 有内容，isLoading 先 true 后 false |
| 打开大文件 | 选择 >5000 行的文件 | 显示 loading 状态，内容加载完成后显示 |
| 打开无效路径 | 路径不存在 | 抛出错误，isLoading 恢复 false，activeFile 不变 |
| 切换文件 | 文件 A → 文件 B | 内容正确切换为新文件内容 |
| 清空文件 | 调用 clearFile() | activeFile 为 null，currentContent 为空 |

### 6.2 集成测试

1. **文件树 → 单文件展示链路**：点击文件树节点 → tabStore.openFile → 内容区正确显示
2. **模式切换不影响文件内容**：Preview ↔ Source 切换时，currentContent 不变，仅渲染方式变化
3. **空状态**：未选择文件时，内容区显示 EmptyState（提示 "请选择一个 Markdown 文件"）

### 6.3 E2E 测试

- 加载 `Knowledge/learn/` 后，点击任意 `.md` 文件，内容区在 < 100ms 内显示内容
- 快速连续点击不同文件，无状态错乱
- 窗口 resize 不影响内容展示

### 6.4 性能测试

| 指标 | 目标 |
|------|------|
| 普通文件 (<1000 行) | 打开到显示 < 100ms |
| 大文件 (5000 行) | 打开到显示 < 500ms |
| 超大文件 (10000+ 行) | 不阻塞 UI，有加载指示 |
