# F03-02 工具栏组件

## 1. 功能描述与目标

实现 MKPreview 顶部工具栏（Toolbar），提供全局操作入口：

- **左侧**：打开目录按钮、当前目录路径显示、切换侧栏折叠按钮
- **中部**：显示模式切换按钮组（Preview / Source / Split），图标+文字标签
- **右侧**：搜索按钮（P2）、主题切换按钮（太阳/月亮）、窗口控制按钮（最大化、关闭）

**核心目标**：
- 按原型设计实现工具栏布局，高度 40px，背景 `--bg-tertiary`
- MVP 阶段仅启用 Preview + Source 双模式切换
- 模式切换支持点击按钮和快捷键（Cmd/Ctrl+1、2、3）
- 当前激活模式高亮显示（蓝色文字 + 浅色背景胶囊）

## 2. 技术实现方案

### 2.1 Vue 3 组件设计

```vue
<!-- Toolbar.vue -->
<template>
  <header class="toolbar">
    <!-- 左侧：打开目录 + 目录路径 + 侧栏切换 -->
    <div class="toolbar-left">
      <button
        class="icon-btn"
        title="打开目录 (Cmd+O)"
        @click="handleOpenDirectory"
      >
        <FolderOpenIcon />
      </button>
      <button
        class="icon-btn"
        title="切换侧栏 (Cmd+B)"
        @click="uiStore.toggleSidebar()"
      >
        <PanelLeftIcon />
      </button>
      <span v-if="fileTreeStore.rootPath" class="toolbar-path">
        {{ fileTreeStore.rootName }}
      </span>
    </div>

    <!-- 中部：模式切换 -->
    <div class="toolbar-center">
      <button
        v-for="mode in availableModes"
        :key="mode.value"
        class="mode-btn"
        :class="{ active: settingsStore.displayMode === mode.value }"
        @click="switchMode(mode.value)"
      >
        <component :is="mode.icon" class="mode-icon" />
        <span>{{ mode.label }}</span>
      </button>
    </div>

    <!-- 右侧：搜索 + 主题 + 窗口控制 -->
    <div class="toolbar-right">
      <button
        v-if="isPhase2"
        class="icon-btn"
        title="全局搜索 (Cmd+Shift+F)"
        @click="toggleSearch"
      >
        <SearchIcon />
      </button>
      <button
        class="icon-btn"
        title="切换主题 (Cmd+Shift+T)"
        @click="themeStore.toggleTheme()"
      >
        <SunIcon v-if="themeStore.isDark" />
        <MoonIcon v-else />
      </button>
      <button class="icon-btn" title="最大化" @click="appWindow.maximize()">
        <MaximizeIcon />
      </button>
      <button class="icon-btn close-btn" title="关闭窗口" @click="appWindow.close()">
        <CloseIcon />
      </button>
    </div>
  </header>
</template>
```

### 2.2 CSS 布局方案

```css
/* Toolbar.vue <style scoped> */
.toolbar {
  grid-area: toolbar;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
  gap: 12px;
  height: 40px;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.toolbar-path {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.toolbar-center {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--bg-secondary);
  border-radius: 6px;
  padding: 2px;
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 14px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-ui);
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mode-btn:hover {
  color: var(--text-primary);
}

.mode-btn.active {
  background: var(--bg-primary);
  color: var(--accent);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.mode-icon {
  width: 14px;
  height: 14px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.icon-btn svg {
  width: 16px;
  height: 16px;
}

.close-btn:hover {
  background: rgba(239, 68, 68, 0.15);
  color: var(--accent-red);
}
```

### 2.3 模式切换逻辑

```typescript
// Toolbar.vue <script setup>
import { computed } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUiStore } from '@/stores/uiStore'
import { useFileTreeStore } from '@/stores/fileTreeStore'
import { useTheme } from '@/composables/useTheme'
import { appWindow } from '@tauri-apps/api/window'
import { open as openDialog } from '@tauri-apps/plugin-dialog'

const settingsStore = useSettingsStore()
const uiStore = useUiStore()
const fileTreeStore = useFileTreeStore()
const themeStore = useTheme()

const availableModes = computed(() => [
  { value: 'preview' as const, label: 'Preview', icon: EyeIcon },
  { value: 'source' as const, label: 'Source', icon: CodeIcon },
  ...(isPhase2.value ? [{ value: 'split' as const, label: 'Split', icon: ColumnsIcon }] : [])
])

function switchMode(mode: 'preview' | 'source' | 'split') {
  settingsStore.setDisplayMode(mode)
}

// 打开目录：调用系统目录选择对话框
async function handleOpenDirectory() {
  const selected = await openDialog({
    directory: true,
    multiple: false,
    title: '选择目录',
  })
  if (selected && typeof selected === 'string') {
    await fileTreeStore.loadDirectory(selected)
  }
}

function toggleSearch() {
  uiStore.searchPanelVisible = !uiStore.searchPanelVisible
}
```

## 3. 接口定义

### Toolbar.vue Props/Emits

```typescript
interface ToolbarProps {
  isPhase2?: boolean   // 是否启用 P2 功能，默认 false
}

interface ToolbarEmits {
  (e: 'mode-change', mode: 'preview' | 'source' | 'split'): void
  (e: 'search-toggle'): void
}
```

### 依赖 Store

| Store | 用途 |
|-------|------|
| `settingsStore` | 读取/设置 `displayMode`（preview/source/split） |
| `uiStore` | 调用 `toggleSidebar()`、控制搜索面板可见性 |
| `fileTreeStore` | 显示当前根目录名称 `rootName`、`loadDirectory()` 加载选中目录 |

## 4. 数据结构

```typescript
// types/settings.ts
export type DisplayMode = 'preview' | 'source' | 'split'

export interface ModeButtonConfig {
  value: DisplayMode
  label: string
  icon: Component
  shortcut: string   // 如 'Cmd+1'
}

// stores/settingsStore.ts
export const useSettingsStore = defineStore('settings', () => {
  const displayMode = ref<DisplayMode>('preview')
  function setDisplayMode(mode: DisplayMode) {
    displayMode.value = mode
  }
  return { displayMode, setDisplayMode }
})
```

## 5. 依赖关系

| 依赖模块 | 说明 |
|---------|------|
| F03-01 CSS Grid 整体布局 | Toolbar 作为 AppLayout 的子组件嵌入 grid-area: toolbar |
| F04-01 文件树核心组件 | 获取当前加载的目录路径显示在左侧 |
| F08-01 CSS 变量主题系统 | --bg-tertiary、--text-secondary、--accent 等变量 |
| F08-02 主题切换功能 | useTheme composable 提供 toggleTheme() |
| F02-01 目录扫描服务 | fileTreeStore.rootPath 来源 |
| @tauri-apps/api/window | appWindow.maximize() / close() |
| @tauri-apps/plugin-dialog | `open` 系统目录选择对话框 |

## 6. PRD 需求追溯

- **FR-001.1**：系统原生目录选择对话框 → toolbar-left 打开目录按钮，调用 `@tauri-apps/plugin-dialog` 的 `open({ directory: true })`
- **附录 A**：Cmd+O 快捷键 → 菜单栏 File > Open Directory（按钮本身不绑定快捷键，快捷键由菜单系统处理）

## 7. 测试要点

1. **模式切换**：点击 Preview/Source/Split 按钮，active 类是否正确切换
2. **快捷键**：Cmd/Ctrl+1/2/3 是否正确切换模式并更新按钮高亮
3. **MVP 限制**：MVP 阶段 Split 按钮是否隐藏或不响应
4. **侧栏切换**：点击侧栏按钮是否正确触发 uiStore.toggleSidebar()
5. **主题按钮**：暗色模式下显示太阳图标，亮色模式显示月亮图标
6. **窗口控制**：最大化/关闭按钮是否调用对应 Tauri API
7. **路径显示**：加载目录后是否显示根目录名，未加载时是否隐藏
8. **响应式**：工具栏在小窗口下是否保持布局不崩（mode 按钮文字可隐藏仅显示图标）
9. **hover 效果**：所有按钮悬浮时背景色/文字色变化是否符合规范
10. **打开目录按钮**：点击文件夹图标是否弹出系统目录选择对话框
11. **目录加载**：选择目录后是否正确加载文件树并显示目录名
