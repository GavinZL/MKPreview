<template>
  <div class="file-tree-container">
    <TreeSearch />
    <div
      ref="treeContainer"
      class="file-tree"
      tabindex="0"
      @keydown="handleContainerKeydown"
    >
      <div v-if="fileTreeStore.hasRoot" class="tree-root-header">
        <svg class="tree-root-icon" viewBox="0 0 16 16" fill="currentColor" width="16" height="16"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.879a1.5 1.5 0 0 1 1.06.44l1.122 1.12A1.5 1.5 0 0 0 9.62 4H13.5A1.5 1.5 0 0 1 15 5.5V12.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z"/></svg>
        <span class="tree-root-name">{{ fileTreeStore.rootName.toUpperCase() }}</span>
      </div>
      <TreeNode
        v-for="node in sortedDisplayNodes"
        :key="node.path"
        :node="node"
        :depth="0"
        :search-keyword="fileTreeStore.searchKeyword"
      />
      <div v-if="!fileTreeStore.hasRoot" class="tree-empty">
        <p>{{ t('tree.openDirectoryHint') }}</p>
      </div>
      <div v-else-if="sortedDisplayNodes.length === 0" class="tree-empty">
        <p>{{ t('tree.noResults') }}</p>
      </div>
    </div>
    <!-- 拖拽覆盖层 -->
    <div v-if="isDragOver" class="drop-overlay">
      <div class="drop-hint">{{ t('tree.dropHint') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFileTreeStore } from '@/stores/fileTreeStore'
import { useTabStore } from '@/stores/tabStore'
import { useNavigationStore } from '@/stores/navigationStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNavigationActions } from '@/composables/useNavigationActions'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { tauriCommands } from '@/services/tauriCommands'
import TreeSearch from './TreeSearch.vue'
import TreeNode from './TreeNode.vue'
import { naturalSort } from '@/lib/naturalSort'

const { t } = useI18n()
const fileTreeStore = useFileTreeStore()
const tabStore = useTabStore()
const navigationStore = useNavigationStore()
const settingsStore = useSettingsStore()
const { saveCurrentScrollTop } = useNavigationActions()
const treeContainer = ref<HTMLElement>()

const displayNodes = computed(() => {
  if (fileTreeStore.searchKeyword.trim()) {
    return fileTreeStore.filteredRootNodes
  }
  return fileTreeStore.rootNodes
})

const sortedDisplayNodes = computed(() => {
  return [...displayNodes.value].sort((a, b) => naturalSort(a.name, b.name))
})

// 键盘导航：在可见的 .tree-node 之间移动焦点
function getVisibleNodes(): HTMLElement[] {
  if (!treeContainer.value) return []
  return Array.from(treeContainer.value.querySelectorAll('.tree-node'))
}

function focusNode(index: number) {
  const nodes = getVisibleNodes()
  const node = nodes[index]
  if (node) {
    node.focus()
    const path = node.getAttribute('data-path')
    if (path) {
      fileTreeStore.selectNode(path)
    }
  }
}

function handleContainerKeydown(e: KeyboardEvent) {
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

// 拖拽支持（使用 Tauri 原生 API）
const isDragOver = ref(false)
let unlistenDragDrop: (() => void) | null = null

async function handleTauriDrop(paths: string[]) {
  for (const path of paths) {
    const meta = await tauriCommands.getFileMeta(path).catch(() => null)
    if (!meta) continue

    if (meta.isDir) {
      // 目录：加载为文件树根目录
      await fileTreeStore.loadDirectory(path)
    } else if (path.endsWith('.md') || path.endsWith('.markdown')) {
      // Markdown 文件：打开编辑
      const name = path.split('/').pop() || path.split('\\').pop() || path
      saveCurrentScrollTop()
      navigationStore.pushEntry(path, name, undefined, settingsStore.displayMode)
      await tabStore.openFile(path, name)
    }
  }
}

onMounted(async () => {
  const appWindow = getCurrentWebviewWindow()
  unlistenDragDrop = await appWindow.onDragDropEvent((event) => {
    if (event.payload.type === 'enter') {
      isDragOver.value = true
    } else if (event.payload.type === 'drop') {
      isDragOver.value = false
      handleTauriDrop(event.payload.paths)
    } else if (event.payload.type === 'leave') {
      isDragOver.value = false
    }
  })
})

onUnmounted(() => {
  if (unlistenDragDrop) {
    unlistenDragDrop()
    unlistenDragDrop = null
  }
})
</script>

<style scoped>
.file-tree-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.file-tree {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
  outline: none;
}

.tree-root-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.5px;
  user-select: none;
}

.tree-root-icon {
  flex-shrink: 0;
  color: var(--accent);
}

.tree-root-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  color: var(--text-muted);
  font-size: 12px;
}

.drop-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
}

.drop-hint {
  padding: 24px 48px;
  background: var(--bg-primary);
  border: 2px dashed var(--accent);
  border-radius: 12px;
  color: var(--accent);
  font-size: 18px;
  font-weight: 600;
  pointer-events: none;
}
</style>
