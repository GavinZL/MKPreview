<template>
  <div
    class="app-layout"
    :class="{
      'sidebar-collapsed': uiStore.sidebarCollapsed
    }"
    :style="layoutStyle"
  >
    <aside class="app-sidebar">
      <!-- 搜索面板/文件树切换 -->
      <SearchPanel
        v-if="uiStore.searchPanelVisible"
        :visible="true"
        :root-dir="fileTreeStore.rootPath || ''"
        @close="uiStore.searchPanelVisible = false"
        @select="onSearchSelect"
      />
      <FileTree v-else />
      <!-- 拖拽分割条 -->
      <div
        class="sidebar-resizer"
        @mousedown="startResize"
        @dblclick="resetWidth"
      />
    </aside>

    <header class="app-toolbar">
      <Toolbar />
    </header>

    <main class="app-content">
      <SingleFileView />
    </main>

    <footer class="app-statusbar">
      <StatusBar />
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useUiStore } from '@/stores/uiStore'
import { useTabStore } from '@/stores/tabStore'
import { useFileTreeStore } from '@/stores/fileTreeStore'
import { useNavigationStore } from '@/stores/navigationStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNavigationActions } from '@/composables/useNavigationActions'
import Toolbar from './Toolbar.vue'
import StatusBar from './StatusBar.vue'
import FileTree from '@/components/file-tree/FileTree.vue'
import SingleFileView from '@/components/editor/SingleFileView.vue'
import SearchPanel from '@/components/search/SearchPanel.vue'

const uiStore = useUiStore()
const tabStore = useTabStore()
const fileTreeStore = useFileTreeStore()
const navigationStore = useNavigationStore()
const settingsStore = useSettingsStore()
const { saveCurrentScrollTop } = useNavigationActions()

function onSearchSelect(result: any) {
  // 搜索结果选中后打开文件
  saveCurrentScrollTop()
  navigationStore.pushEntry(result.path, result.name, undefined, settingsStore.displayMode)
  tabStore.openFile(result.path, result.name)
  uiStore.searchPanelVisible = false
}

const isResizing = ref(false)

const layoutStyle = computed(() => ({
  '--sidebar-width': uiStore.sidebarCollapsed ? '0px' : `${uiStore.sidebarWidth}px`
}))

function startResize(e: MouseEvent) {
  e.preventDefault()
  isResizing.value = true
  const startX = e.clientX
  const startWidth = uiStore.sidebarWidth

  function onMouseMove(ev: MouseEvent) {
    if (!isResizing.value) return
    const delta = ev.clientX - startX
    const newWidth = startWidth + delta
    uiStore.setSidebarWidth(newWidth)
  }

  function onMouseUp() {
    isResizing.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function resetWidth() {
  uiStore.setSidebarWidth(260)
}
</script>

<style scoped>
.app-layout {
  display: grid;
  grid-template-rows: var(--toolbar-height) 1fr var(--statusbar-height);
  grid-template-columns: var(--sidebar-width) 1fr;
  grid-template-areas:
    "sidebar toolbar"
    "sidebar content"
    "sidebar status";
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  transition: grid-template-columns 0.2s ease;
}

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

.sidebar-resizer {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  height: 100%;
  cursor: col-resize;
  background: transparent;
  transition: background 0.15s ease;
  z-index: 20;
}

.sidebar-resizer:hover,
.sidebar-resizer:active {
  background: var(--accent);
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
</style>
