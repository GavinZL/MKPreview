# F03-01 CSS Grid 整体布局骨架

## 1. 功能描述与目标

实现 MKPreview 应用的整体界面布局骨架，基于 CSS Grid 构建一个四行两列的响应式网格布局，包含：

- **工具栏区域（Toolbar）**：40px 固定高度，跨内容区
- **标签栏区域（TabBar）**：36px 固定高度，跨内容区（P2 阶段启用）
- **侧边栏（Sidebar）**：文件树面板，默认 260px 宽度，支持 180px~400px 范围调节
- **内容区（Content Area）**：1fr 弹性占据剩余空间，最小 400px
- **状态栏（Status Bar）**：24px 固定高度，跨内容区

**核心目标**：
- 提供稳定、可扩展的网格骨架，支撑三种显示模式（Preview / Source / Split）的容器嵌套
- 支持侧边栏折叠/展开动画（200ms 滑动过渡）
- 支持分屏模式下的 CSS Grid 子布局（1fr 1fr 左右分栏）
- 所有面板尺寸严格遵循 PRD 7.2 布局规格

## 2. 技术实现方案

### 2.1 Vue 3 组件设计

```vue
<!-- AppLayout.vue -->
<template>
  <div class="app-layout" :class="{ 'sidebar-collapsed': uiStore.sidebarCollapsed }">
    <!-- 侧边栏 -->
    <aside class="app-sidebar" :style="sidebarStyle">
      <slot name="sidebar">
        <Sidebar />
      </slot>
      <GridResizer
        direction="horizontal"
        :min="180"
        :max="400"
        :default="260"
        @resize="handleSidebarResize"
        @dblclick="handleSidebarReset"
      />
    </aside>

    <!-- 工具栏 -->
    <header class="app-toolbar">
      <slot name="toolbar">
        <Toolbar />
      </slot>
    </header>

    <!-- 标签栏 (P2) -->
    <nav v-if="settingsStore.showTabBar" class="app-tabbar">
      <slot name="tabbar">
        <TabBar />
      </slot>
    </nav>

    <!-- 内容区 -->
    <main class="app-content">
      <slot name="content">
        <ContentArea />
      </slot>
    </main>

    <!-- 状态栏 -->
    <footer class="app-statusbar">
      <slot name="statusbar">
        <StatusBar />
      </slot>
    </footer>
  </div>
</template>
```

### 2.2 CSS Grid 布局方案

```css
/* AppLayout.vue <style scoped> */
.app-layout {
  display: grid;
  grid-template-rows: var(--toolbar-height) var(--tabbar-height) 1fr var(--statusbar-height);
  grid-template-columns: var(--sidebar-width) 1fr;
  grid-template-areas:
    "sidebar toolbar"
    "sidebar tabbar"
    "sidebar content"
    "sidebar status";
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  transition: grid-template-columns 0.2s ease;
}

/* 标签栏隐藏时（MVP 阶段） */
.app-layout.no-tabbar {
  grid-template-rows: var(--toolbar-height) 1fr var(--statusbar-height);
  grid-template-areas:
    "sidebar toolbar"
    "sidebar content"
    "sidebar status";
}

/* 侧边栏折叠 */
.app-layout.sidebar-collapsed {
  grid-template-columns: 0px 1fr;
}

.app-sidebar {
  grid-area: sidebar;
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  overflow: hidden;
  min-width: 0;
}

.app-toolbar {
  grid-area: toolbar;
  display: flex;
  align-items: center;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
  padding: 0 16px;
  gap: 12px;
  z-index: 10;
}

.app-tabbar {
  grid-area: tabbar;
  display: flex;
  align-items: flex-end;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding-left: 4px;
  gap: 1px;
  overflow-x: auto;
}

.app-content {
  grid-area: content;
  background: var(--bg-primary);
  overflow: hidden;
  position: relative;
  min-width: 400px;
}

.app-statusbar {
  grid-area: status;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-muted);
  z-index: 10;
}
```

### 2.3 CSS 变量定义

```css
/* global.css */
:root {
  --sidebar-width: 260px;
  --toolbar-height: 40px;
  --tabbar-height: 36px;
  --statusbar-height: 24px;
}
```

### 2.4 Pinia Store 设计

由 `uiStore` 管理布局状态：

```typescript
// stores/uiStore.ts
export const useUiStore = defineStore('ui', () => {
  const sidebarWidth = ref(260)
  const sidebarCollapsed = ref(false)
  const splitRatio = ref(0.5)  // 分屏比例 0.3 ~ 0.7

  const sidebarStyle = computed(() => ({
    width: sidebarCollapsed.value ? '0px' : `${sidebarWidth.value}px`
  }))

  function setSidebarWidth(width: number) {
    sidebarWidth.value = Math.max(180, Math.min(400, width))
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function setSplitRatio(ratio: number) {
    splitRatio.value = Math.max(0.3, Math.min(0.7, ratio))
  }

  return {
    sidebarWidth, sidebarCollapsed, splitRatio,
    sidebarStyle, setSidebarWidth, toggleSidebar, setSplitRatio
  }
})
```

## 3. 接口定义

### AppLayout.vue Props/Emits

```typescript
// Props
interface AppLayoutProps {
  showTabBar?: boolean       // 是否显示标签栏，默认 false（MVP 为 false）
}

// Emits
interface AppLayoutEmits {
  (e: 'sidebar-resize', width: number): void
  (e: 'sidebar-toggle', collapsed: boolean): void
}
```

### uiStore State/Getters/Actions

| 类型 | 名称 | 类型 | 说明 |
|------|------|------|------|
| State | `sidebarWidth` | `number` | 侧边栏当前宽度，默认 260 |
| State | `sidebarCollapsed` | `boolean` | 侧边栏是否折叠 |
| State | `splitRatio` | `number` | 分屏模式左右比例，默认 0.5 |
| Getter | `sidebarStyle` | `CSSProperties` | 用于绑定 :style |
| Action | `setSidebarWidth(width)` | `void` | 设置侧边栏宽度（ clamp 180~400 ） |
| Action | `toggleSidebar()` | `void` | 切换侧边栏折叠状态 |
| Action | `setSplitRatio(ratio)` | `void` | 设置分屏比例（ clamp 0.3~0.7 ） |

## 4. 数据结构

```typescript
// types/ui.ts
export interface PanelLayout {
  sidebarWidth: number
  sidebarCollapsed: boolean
  splitRatio: number
}

export interface LayoutConstraints {
  sidebar: { min: 180; max: 400; default: 260 }
  content: { min: 400 }
  split: { min: 0.3; max: 0.7; default: 0.5 }
  toolbarHeight: 40
  tabbarHeight: 36
  statusbarHeight: 24
}
```

## 5. 依赖关系

| 依赖模块 | 说明 |
|---------|------|
| F01-02 前端基础配置 | Vite + Tailwind + CSS 变量基础设施 |
| F03-02 工具栏组件 | AppLayout 插槽中默认渲染 Toolbar |
| F03-03 状态栏组件 | AppLayout 插槽中默认渲染 StatusBar |
| F03-04 面板拖拽分割条 | GridResizer 组件用于调节 sidebar 宽度 |
| F04-01 文件树核心组件 | Sidebar 插槽中默认渲染 FileTree |
| F08-01 CSS 变量主题系统 | --bg-primary/secondary/tertiary 等变量 |

## 6. 测试要点

1. **布局结构验证**：检查 grid-template-areas 是否正确映射到各子区域
2. **尺寸约束**：侧边栏宽度是否能正确限制在 180px~400px 区间
3. **折叠动画**：侧边栏折叠/展开时 200ms 过渡是否流畅，无闪烁
4. **最小宽度**：内容区在侧边栏展开到最大 400px 时是否仍保持 >= 400px
5. **响应式**：窗口缩小时布局不自崩，侧边栏优先收缩
6. **分屏子布局**：Split 模式下内容区内部的 CSS Grid 左右比例是否正确
7. **快捷键**：Cmd/Ctrl+B 切换侧边栏时 grid-template-columns 是否正确切换
8. **暗色主题**：所有背景色、边框色是否正确跟随 CSS 变量切换
