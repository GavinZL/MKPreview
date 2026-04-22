# F07-02 Preview/Source 模式切换 [MVP]

## 1. 功能描述与目标

**功能描述**：MVP 阶段实现预览模式（Preview Mode）和源码模式（Source Mode）的双模式切换。用户可通过工具栏按钮组或快捷键在两种模式间切换，切换时保持滚动位置，并伴随平滑的过渡动画。

**目标**：
- 工具栏提供 Preview / Source 两个模式切换按钮（MVP 阶段隐藏 Split 按钮）
- 快捷键支持：Cmd/Ctrl+1（预览）、Cmd/Ctrl+2（源码）
- 模式切换时保持当前文件的滚动位置（同模式内）
- 150ms 淡入淡出过渡动画，无闪烁
- 通过 `settingsStore` 管理当前模式状态
- 实现 `useKeyboard.ts` 统一快捷键管理 composable

**PRD 关联**：FR-003（三种显示模式）、附录 A 快捷键汇总

---

## 2. 技术实现方案

### 2.1 模式状态管理

```typescript
// stores/settingsStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type DisplayMode = 'preview' | 'source' | 'split'

export const useSettingsStore = defineStore('settings', () => {
  const displayMode = ref<DisplayMode>('preview') // MVP 默认预览模式

  const isPreviewMode = computed(() => displayMode.value === 'preview')
  const isSourceMode = computed(() => displayMode.value === 'source')
  const isSplitMode = computed(() => displayMode.value === 'split')

  function setDisplayMode(mode: DisplayMode) {
    // MVP 阶段仅支持 preview 和 source
    if (mode === 'split') {
      console.warn('Split mode is not available in MVP')
      return
    }
    displayMode.value = mode
  }

  return {
    displayMode,
    isPreviewMode,
    isSourceMode,
    isSplitMode,
    setDisplayMode,
  }
})
```

### 2.2 模式切换动画实现

使用 Vue 的 `<Transition>` 组件实现 150ms 淡入淡出：

```vue
<!-- components/editor/ModeSwitch.vue -->
<template>
  <div class="mode-switch-container">
    <Transition name="mode-fade" mode="out-in">
      <MarkdownPreview
        v-if="displayMode === 'preview'"
        key="preview"
        :content="content"
        ref="previewRef"
      />
      <SourceEditor
        v-else-if="displayMode === 'source'"
        key="source"
        :content="content"
        ref="sourceRef"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTabStore } from '@/stores/tabStore'
import MarkdownPreview from '@/components/preview/MarkdownPreview.vue'
import SourceEditor from '@/components/editor/SourceEditor.vue'

const settingsStore = useSettingsStore()
const tabStore = useTabStore()

const displayMode = computed(() => settingsStore.displayMode)
const content = computed(() => tabStore.activeContent)

const previewRef = ref<InstanceType<typeof MarkdownPreview>>()
const sourceRef = ref<InstanceType<typeof SourceEditor>>()

// 模式切换前的滚动位置
const savedScrollPosition = ref(0)

// 监听模式切换，保持滚动位置
watch(displayMode, async (newMode, oldMode) => {
  // 保存当前模式的滚动位置
  if (oldMode === 'preview' && previewRef.value) {
    savedScrollPosition.value = previewRef.value.getScrollPosition()
  } else if (oldMode === 'source' && sourceRef.value) {
    savedScrollPosition.value = sourceRef.value.getScrollPosition()
  }

  // 等待 DOM 更新后恢复滚动位置
  await nextTick()
  setTimeout(() => {
    if (newMode === 'preview' && previewRef.value) {
      previewRef.value.setScrollPosition(savedScrollPosition.value)
    } else if (newMode === 'source' && sourceRef.value) {
      sourceRef.value.setScrollPosition(savedScrollPosition.value)
    }
  }, 50) // 过渡动画结束后恢复
})
</script>

<style scoped>
.mode-switch-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.mode-fade-enter-active,
.mode-fade-leave-active {
  transition: opacity 150ms ease;
}

.mode-fade-enter-from,
.mode-fade-leave-to {
  opacity: 0;
}
</style>
```

### 2.3 工具栏模式切换按钮组

```vue
<!-- 内嵌在 Toolbar.vue 中的模式切换按钮组 -->
<template>
  <div class="toolbar-center">
    <button
      v-for="mode in availableModes"
      :key="mode.value"
      class="mode-btn"
      :class="{ active: currentMode === mode.value }"
      @click="switchMode(mode.value)"
    >
      {{ mode.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore, type DisplayMode } from '@/stores/settingsStore'

const settingsStore = useSettingsStore()
const currentMode = computed(() => settingsStore.displayMode)

// MVP 阶段仅显示 Preview 和 Source
const availableModes = [
  { label: 'Preview', value: 'preview' as DisplayMode },
  { label: 'Source', value: 'source' as DisplayMode },
  // { label: 'Split', value: 'split' as DisplayMode }, // Phase 2 启用
]

function switchMode(mode: DisplayMode) {
  settingsStore.setDisplayMode(mode)
}
</script>
```

### 2.4 useKeyboard Composable（完整快捷键管理）

```typescript
// composables/useKeyboard.ts
import { onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTabStore } from '@/stores/tabStore'
import { useTheme } from './useTheme'

export type ShortcutHandler = (event: KeyboardEvent) => void | boolean

export interface ShortcutMap {
  [key: string]: ShortcutHandler
}

/** 判断当前平台是否为 macOS */
function isMac(): boolean {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0
}

/** 获取平台修饰键前缀 */
function getModifierPrefix(): string {
  return isMac() ? 'Cmd' : 'Ctrl'
}

/**
 * 统一快捷键管理 Composable
 * 注册全局键盘事件监听，支持平台差异（macOS: Cmd / Windows: Ctrl）
 */
export function useKeyboard(shortcuts?: ShortcutMap) {
  const settingsStore = useSettingsStore()
  const tabStore = useTabStore()
  const { toggleTheme } = useTheme()

  const mac = isMac()
  const cmdKey = mac ? 'metaKey' : 'ctrlKey'

  /** 默认快捷键映射（附录 A 完整定义） */
  const defaultShortcuts: ShortcutMap = {
    // 模式切换
    '1': () => settingsStore.setDisplayMode('preview'),
    '2': () => settingsStore.setDisplayMode('source'),
    '3': () => {
      // Phase 2 启用分屏模式
      // settingsStore.setDisplayMode('split')
    },

    // 主题切换
    'Shift+T': () => toggleTheme(),

    // 侧栏切换
    'B': () => {
      // 触发 uiStore.toggleSidebar()
    },

    // 全局搜索（Phase 2）
    'Shift+F': () => {
      // 触发搜索面板显示
    },

    // 保存（Phase 2）
    'S': (e) => {
      // 阻止浏览器默认保存行为
      e.preventDefault()
      // 触发保存逻辑
    },

    // 关闭标签（Phase 2）
    'W': () => {
      if (tabStore.activeTabId) {
        tabStore.closeTab(tabStore.activeTabId)
      }
    },
  }

  function getShortcutKey(e: KeyboardEvent): string {
    const parts: string[] = []

    if (e.shiftKey) parts.push('Shift')
    if (e.altKey) parts.push('Alt')
    // Cmd(macOS) / Ctrl(Windows)
    if (e.metaKey || e.ctrlKey) {
      // 已由外部判断，此处仅记录键值
    }

    // 数字键直接记录数字
    if (e.key >= '0' && e.key <= '9') {
      parts.push(e.key)
    } else if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
      parts.push(e.key.toUpperCase())
    }

    return parts.join('+')
  }

  function handleKeyDown(e: KeyboardEvent) {
    // 只处理带有 Cmd/Ctrl 修饰键的快捷键
    if (!e[cmdKey as keyof KeyboardEvent]) return

    // 忽略输入框内的快捷键（除非特殊处理）
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      // 允许某些全局快捷键即使在输入框内也生效
      // 如 Cmd+S 保存、Cmd+W 关闭标签
      const key = getShortcutKey(e)
      if (key !== 'S' && key !== 'W') return
    }

    const key = getShortcutKey(e)
    const merged = { ...defaultShortcuts, ...shortcuts }
    const handler = merged[key]

    if (handler) {
      e.preventDefault()
      const result = handler(e)
      // 若 handler 返回 false，阻止后续处理
      if (result === false) {
        e.stopPropagation()
      }
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })

  return {
    isMac: mac,
    modifierKey: getModifierPrefix(),
  }
}
```

### 2.5 快捷键处理规则表

| 功能 | macOS | Windows | 触发条件 | 阻止默认行为 |
|------|-------|---------|---------|-------------|
| 预览模式 | Cmd+1 | Ctrl+1 | 全局 | 是 |
| 源码模式 | Cmd+2 | Ctrl+2 | 全局 | 是 |
| 分屏模式 | Cmd+3 | Ctrl+3 | 全局（P2） | 是 |
| 切换主题 | Cmd+Shift+T | Ctrl+Shift+T | 全局 | 是 |
| 切换侧栏 | Cmd+B | Ctrl+B | 全局 | 是 |
| 搜索 | Cmd+F | Ctrl+F | 全局（搜索 CodeMirror 内） | 是 |
| 全局搜索 | Cmd+Shift+F | Ctrl+Shift+F | 全局（P2） | 是 |
| 保存 | Cmd+S | Ctrl+S | 全局（P2） | 是 |
| 关闭标签 | Cmd+W | Ctrl+W | 全局（P2） | 是 |
| 放大 | Cmd+= | Ctrl+= | 全局 | 是 |
| 缩小 | Cmd+- | Ctrl+- | 全局 | 是 |
| 重置缩放 | Cmd+0 | Ctrl+0 | 全局 | 是 |

### 2.6 滚动位置保持策略

模式切换时的滚动位置保持分为两种情况：

1. **Preview → Source**：预览区的像素滚动位置按比例映射到源码区的行号位置
   - 计算预览区当前滚动百分比：`previewScrollPercent = previewScrollTop / previewScrollHeight`
   - 源码区目标行号：`targetLine = Math.floor(previewScrollPercent * totalLines)`
   - SourceEditor 滚动到对应行

2. **Source → Preview**：源码区的行号位置反向映射到预览区的像素位置
   - 计算源码区当前行号占比：`sourceLinePercent = currentLine / totalLines`
   - 预览区目标像素：`targetScrollTop = sourceLinePercent * previewScrollHeight`
   - MarkdownPreview 滚动到对应像素位置

```typescript
// 滚动位置保持简化实现（精确同步在 F07-05 中实现）
function preserveScrollPosition(
  fromMode: DisplayMode,
  toMode: DisplayMode,
  fromPosition: number,
  contentLines: number
): number {
  if (fromMode === 'preview' && toMode === 'source') {
    // 预览像素 → 源码行号
    const approximateLine = Math.floor((fromPosition / previewHeight) * contentLines)
    return approximateLine * lineHeight
  } else if (fromMode === 'source' && toMode === 'preview') {
    // 源码行号 → 预览像素（粗略映射）
    const approximatePercent = fromPosition / (contentLines * lineHeight)
    return approximatePercent * previewHeight
  }
  return fromPosition
}
```

---

## 3. 接口定义

### 3.1 SettingsStore 扩展

```typescript
// stores/settingsStore.ts
export type DisplayMode = 'preview' | 'source' | 'split'

export interface SettingsState {
  displayMode: DisplayMode
  theme: 'light' | 'dark' | 'system'
  // ... 其他设置项
}

export interface SettingsActions {
  setDisplayMode(mode: DisplayMode): void
  toggleTheme(): void
}
```

### 3.2 ModeSwitch 组件 Props / Emits

```typescript
// components/editor/ModeSwitch.vue
interface ModeSwitchProps {
  // 无 Props，状态来自 Store
}

interface ModeSwitchEmits {
  // 无 Emits
}
```

### 3.3 useKeyboard Composable 接口

```typescript
// composables/useKeyboard.ts
export interface UseKeyboardReturn {
  /** 是否为 macOS 平台 */
  isMac: boolean
  /** 修饰键名称（'Cmd' 或 'Ctrl'） */
  modifierKey: string
}

export function useKeyboard(shortcuts?: ShortcutMap): UseKeyboardReturn
```

### 3.4 Toolbar 模式按钮 Props

```typescript
// 工具栏模式按钮组
interface ModeButton {
  label: string
  value: DisplayMode
  shortcut: string // 显示在 tooltip 中，如 "Cmd+1"
}
```

---

## 4. 数据结构

### 4.1 DisplayMode 枚举

```typescript
// types/settings.ts
export const DisplayMode = {
  PREVIEW: 'preview',
  SOURCE: 'source',
  SPLIT: 'split',
} as const

export type DisplayMode = typeof DisplayMode[keyof typeof DisplayMode]
```

### 4.2 快捷键数据结构

```typescript
// types/keyboard.ts
export interface KeyboardShortcut {
  /** 功能标识 */
  id: string
  /** 功能名称 */
  name: string
  /** macOS 快捷键 */
  macShortcut: string
  /** Windows/Linux 快捷键 */
  winShortcut: string
  /** 是否全局生效（即使焦点在输入框内） */
  global: boolean
  /** 处理函数 */
  handler: (e: KeyboardEvent) => void
}

// 完整快捷键列表（附录 A）
export const SHORTCUTS: KeyboardShortcut[] = [
  { id: 'open-dir', name: '打开目录', macShortcut: 'Cmd+O', winShortcut: 'Ctrl+O', global: true, handler: () => {} },
  { id: 'save', name: '保存文件', macShortcut: 'Cmd+S', winShortcut: 'Ctrl+S', global: true, handler: () => {} },
  { id: 'preview', name: '预览模式', macShortcut: 'Cmd+1', winShortcut: 'Ctrl+1', global: true, handler: () => {} },
  { id: 'source', name: '源码模式', macShortcut: 'Cmd+2', winShortcut: 'Ctrl+2', global: true, handler: () => {} },
  { id: 'split', name: '分屏模式', macShortcut: 'Cmd+3', winShortcut: 'Ctrl+3', global: true, handler: () => {} },
  { id: 'search', name: '搜索', macShortcut: 'Cmd+F', winShortcut: 'Ctrl+F', global: false, handler: () => {} },
  { id: 'global-search', name: '全局搜索', macShortcut: 'Cmd+Shift+F', winShortcut: 'Ctrl+Shift+F', global: true, handler: () => {} },
  { id: 'close-tab', name: '关闭标签', macShortcut: 'Cmd+W', winShortcut: 'Ctrl+W', global: true, handler: () => {} },
  { id: 'zoom-in', name: '放大', macShortcut: 'Cmd+=', winShortcut: 'Ctrl+=', global: true, handler: () => {} },
  { id: 'zoom-out', name: '缩小', macShortcut: 'Cmd+-', winShortcut: 'Ctrl+-', global: true, handler: () => {} },
  { id: 'zoom-reset', name: '重置缩放', macShortcut: 'Cmd+0', winShortcut: 'Ctrl+0', global: true, handler: () => {} },
  { id: 'toggle-theme', name: '切换主题', macShortcut: 'Cmd+Shift+T', winShortcut: 'Ctrl+Shift+T', global: true, handler: () => {} },
  { id: 'toggle-sidebar', name: '切换侧栏', macShortcut: 'Cmd+B', winShortcut: 'Ctrl+B', global: true, handler: () => {} },
]
```

### 4.3 过渡动画 CSS

```css
/* 模式切换淡入淡出 */
.mode-fade-enter-active,
.mode-fade-leave-active {
  transition: opacity 150ms ease-in-out;
}

.mode-fade-enter-from,
.mode-fade-leave-to {
  opacity: 0;
}

/* 工具栏按钮激活态 */
.mode-btn {
  padding: 5px 14px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-ui);
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.mode-btn:hover {
  color: var(--text-primary);
}

.mode-btn.active {
  background: var(--bg-primary);
  color: var(--accent);
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
}
```

---

## 5. 依赖关系

| 依赖模块 | 特性 | 说明 |
|---------|------|------|
| M05 | F05-01 单文件展示 | 需要 activeContent 作为数据源 |
| M06 | F06-06 预览主组件 | Preview 模式依赖 MarkdownPreview |
| M07 | F07-01 CodeMirror 只读查看器 | Source 模式依赖 SourceEditor |
| M08 | F08-02 主题切换功能 | 模式切换按钮组需跟随主题样式 |
| M03 | F03-02 工具栏组件 | 模式切换按钮嵌入工具栏 |

**被依赖**：
- M07 F07-05 分屏模式（Split 模式作为第三种模式注册）
- M03 F03-02 工具栏（工具栏按钮组触发模式切换）

---

## 6. 测试要点

### 6.1 单元测试

| 测试项 | 操作 | 预期结果 |
|--------|------|---------|
| 切换到预览 | setDisplayMode('preview') | displayMode 变为 'preview'，isPreviewMode 为 true |
| 切换到源码 | setDisplayMode('source') | displayMode 变为 'source'，isSourceMode 为 true |
| 无效模式 | setDisplayMode('split')（MVP） | 警告日志，模式不变 |
| 快捷键 Cmd+1 | 键盘按下 Cmd+1 | 触发 preview 模式 |
| 快捷键 Cmd+2 | 键盘按下 Cmd+2 | 触发 source 模式 |
| 输入框内快捷键 | 在 CodeMirror 中按 Cmd+1 | 正确切换模式（全局快捷键） |

### 6.2 组件测试

1. **模式切换动画**：点击 Source 按钮 → Preview 淡出 150ms → Source 淡入 150ms
2. **按钮高亮**：当前模式的按钮显示 active 样式（蓝色文字 + 白色背景）
3. **滚动保持**：Preview 滚动到 50% → 切换到 Source → Source 大致滚动到中间位置
4. **内容一致性**：切换模式前后内容不改变

### 6.3 快捷键测试（跨平台）

| 平台 | 按键组合 | 预期 |
|------|---------|------|
| macOS | Cmd+1 | 切换到 Preview |
| macOS | Cmd+2 | 切换到 Source |
| Windows | Ctrl+1 | 切换到 Preview |
| Windows | Ctrl+2 | 切换到 Source |
| macOS | Cmd+Shift+T | 切换主题 |
| Windows | Ctrl+Shift+T | 切换主题 |

### 6.4 性能测试

| 指标 | 目标 |
|------|------|
| 模式切换响应 | < 150ms（含过渡动画） |
| 快捷键响应延迟 | < 16ms |
| 模式切换无闪烁 | 验证淡入淡出过渡平滑 |
