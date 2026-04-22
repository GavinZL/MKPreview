<template>
  <div class="file-tree-container">
    <TreeSearch />
    <div
      ref="treeContainer"
      class="file-tree"
      tabindex="0"
      @keydown="handleContainerKeydown"
    >
      <TreeNode
        v-for="node in sortedDisplayNodes"
        :key="node.path"
        :node="node"
        :depth="0"
        :search-keyword="fileTreeStore.searchKeyword"
      />
      <div v-if="!fileTreeStore.hasRoot" class="tree-empty">
        <p>点击工具栏打开目录</p>
      </div>
      <div v-else-if="sortedDisplayNodes.length === 0" class="tree-empty">
        <p>无匹配结果</p>
      </div>
    </div>
    <!-- 拖拽覆盖层 -->
    <div v-if="isDragOver" class="drop-overlay">
      <div class="drop-hint">释放以打开</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useFileTreeStore } from '@/stores/fileTreeStore'
import { useTabStore } from '@/stores/tabStore'
import TreeSearch from './TreeSearch.vue'
import TreeNode from './TreeNode.vue'
import { naturalSort } from '@/lib/naturalSort'

const fileTreeStore = useFileTreeStore()
const tabStore = useTabStore()
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

// 拖拽支持
const isDragOver = ref(false)
let dragCounter = 0

function handleDragEnter(e: DragEvent) {
  e.preventDefault()
  dragCounter++
  isDragOver.value = true
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy'
  }
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  dragCounter--
  if (dragCounter === 0) {
    isDragOver.value = false
  }
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  dragCounter = 0
  isDragOver.value = false
  const items = e.dataTransfer?.items
  if (!items) return

  for (const item of items) {
    if (item.kind === 'file') {
      const file = item.getAsFile() as any
      const path = file?.path
      if (!path) continue

      const entry = item.webkitGetAsEntry()
      if (entry?.isDirectory) {
        // 目录：加载为文件树根目录
        fileTreeStore.loadDirectory(path)
        break
      } else if (path.endsWith('.md') || path.endsWith('.markdown')) {
        // Markdown 文件：直接打开编辑
        const name = path.split('/').pop() || path
        tabStore.openFile(path, name)
      }
    }
  }
}

onMounted(() => {
  window.addEventListener('dragenter', handleDragEnter)
  window.addEventListener('dragover', handleDragOver)
  window.addEventListener('dragleave', handleDragLeave)
  window.addEventListener('drop', handleDrop)
})

onUnmounted(() => {
  window.removeEventListener('dragenter', handleDragEnter)
  window.removeEventListener('dragover', handleDragOver)
  window.removeEventListener('dragleave', handleDragLeave)
  window.removeEventListener('drop', handleDrop)
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
