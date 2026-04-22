<template>
  <div class="tree-node-wrapper">
    <div
      class="tree-node"
      :class="{ active: isActive, expanded: isExpanded }"
      :style="nodeStyle"
      :data-path="node.path"
      tabindex="0"
      @click="handleClick"
      @contextmenu.prevent="handleContextMenu"
      @keydown="handleKeydown"
    >
      <!-- 展开箭头 -->
      <span v-if="node.isDir" class="node-chevron" :class="{ collapsed: !isExpanded }">
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span v-else class="node-spacer" />

      <!-- 图标 -->
      <span class="node-icon" :class="fileTypeIcon">
        <svg v-if="node.isDir" viewBox="0 0 24 24" width="16" height="16">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
        <svg v-else-if="fileTypeIcon === 'image'" viewBox="0 0 24 24" width="16" height="16">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
          <path d="M3 16l5-5 4 4 5-5 4 4" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" width="16" height="16">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="1.5"/>
          <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </span>

      <!-- 名称（支持搜索高亮） -->
      <span class="node-label">
        <template v-if="highlightParts.length > 1 || (highlightParts.length === 1 && highlightParts[0].highlight)">
          <template v-for="(part, i) in highlightParts" :key="i">
            <mark v-if="part.highlight" class="search-highlight">{{ part.text }}</mark>
            <template v-else>{{ part.text }}</template>
          </template>
        </template>
        <template v-else>{{ node.name }}</template>
      </span>

      <!-- 文件数量角标 -->
      <span v-if="node.isDir && node.fileCount && node.fileCount > 0" class="node-badge">
        {{ node.fileCount }}
      </span>
    </div>

    <!-- 递归渲染子节点 -->
    <div v-if="node.isDir && isExpanded && node.children" class="tree-children">
      <TreeNode
        v-for="child in sortedChildren"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :search-keyword="searchKeyword"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFileTreeStore } from '@/stores/fileTreeStore'
import { useTabStore } from '@/stores/tabStore'
import { useNavigationStore } from '@/stores/navigationStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNavigationActions } from '@/composables/useNavigationActions'
import type { FileTreeNode } from '@/types'
import { naturalSort } from '@/lib/naturalSort'

const props = defineProps<{
  node: FileTreeNode
  depth: number
  searchKeyword?: string
}>()

const fileTreeStore = useFileTreeStore()
const tabStore = useTabStore()
const navigationStore = useNavigationStore()
const settingsStore = useSettingsStore()
const { saveCurrentScrollTop } = useNavigationActions()

const isActive = computed(() => fileTreeStore.selectedPath === props.node.path)
const isExpanded = computed(() => fileTreeStore.expandedPaths.has(props.node.path))

const nodeStyle = computed(() => ({
  paddingLeft: `calc(12px + ${props.depth} * 14px)`
}))

const sortedChildren = computed(() => {
  if (!props.node.children) return []
  return [...props.node.children].sort((a, b) => {
    if (a.isDir && !b.isDir) return -1
    if (!a.isDir && b.isDir) return 1
    return naturalSort(a.name, b.name)
  })
})

const fileTypeIcon = computed(() => {
  if (props.node.isDir) return 'folder'
  const ext = props.node.name.split('.').pop()?.toLowerCase() || ''
  const iconMap: Record<string, string> = {
    'md': 'markdown',
    'markdown': 'markdown',
    'png': 'image',
    'jpg': 'image',
    'jpeg': 'image',
    'gif': 'image',
    'svg': 'image',
    'webp': 'image',
    'json': 'config',
    'yaml': 'config',
    'yml': 'config',
    'toml': 'config',
    'xml': 'config',
    'pdf': 'pdf',
    'txt': 'text',
    'js': 'code',
    'ts': 'code',
    'rs': 'code',
    'py': 'code',
    'css': 'code',
    'html': 'code',
  }
  return iconMap[ext] || 'file'
})

function isMarkdownFile(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.markdown')
}

function handleClick() {
  if (props.node.isDir) {
    fileTreeStore.toggleExpand(props.node.path)
  }
  fileTreeStore.selectNode(props.node.path)

  if (!props.node.isDir && isMarkdownFile(props.node.name)) {
    saveCurrentScrollTop()
    navigationStore.pushEntry(props.node.path, props.node.name, undefined, settingsStore.displayMode)
    tabStore.openFile(props.node.path, props.node.name)
  }
}

function handleContextMenu() {
  fileTreeStore.selectNode(props.node.path)
}

function handleKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowRight':
      e.preventDefault()
      if (props.node.isDir && !isExpanded.value) {
        fileTreeStore.toggleExpand(props.node.path)
      }
      break
    case 'ArrowLeft':
      e.preventDefault()
      if (props.node.isDir && isExpanded.value) {
        fileTreeStore.toggleExpand(props.node.path)
      }
      break
    case 'Enter':
      e.preventDefault()
      if (!props.node.isDir && isMarkdownFile(props.node.name)) {
        fileTreeStore.selectNode(props.node.path)
        saveCurrentScrollTop()
        navigationStore.pushEntry(props.node.path, props.node.name, undefined, settingsStore.displayMode)
        tabStore.openFile(props.node.path, props.node.name)
      } else if (props.node.isDir) {
        fileTreeStore.toggleExpand(props.node.path)
      }
      break
  }
}

interface HighlightPart {
  text: string
  highlight: boolean
}

const highlightParts = computed<HighlightPart[]>(() => {
  const keyword = props.searchKeyword?.trim()
  if (!keyword) return [{ text: props.node.name, highlight: false }]

  const lowerName = props.node.name.toLowerCase()
  const lowerKeyword = keyword.toLowerCase()
  const parts: HighlightPart[] = []
  let index = 0
  let matchIndex = lowerName.indexOf(lowerKeyword, index)

  while (matchIndex !== -1) {
    if (matchIndex > index) {
      parts.push({ text: props.node.name.slice(index, matchIndex), highlight: false })
    }
    parts.push({
      text: props.node.name.slice(matchIndex, matchIndex + keyword.length),
      highlight: true
    })
    index = matchIndex + keyword.length
    matchIndex = lowerName.indexOf(lowerKeyword, index)
  }

  if (index < props.node.name.length) {
    parts.push({ text: props.node.name.slice(index), highlight: false })
  }

  return parts.length > 0 ? parts : [{ text: props.node.name, highlight: false }]
})
</script>

<style scoped>
.tree-node {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  cursor: pointer;
  user-select: none;
  border-radius: 4px;
  margin: 0 4px;
  transition: background 0.1s ease;
  height: 28px;
  outline: none;
}

.tree-node:hover {
  background: var(--bg-tertiary);
}

.tree-node.active {
  background: var(--accent);
  color: white;
}

.tree-node.active .node-icon {
  color: white;
}

.tree-node.active .node-badge {
  background: rgba(255, 255, 255, 0.25);
  color: white;
}

.node-chevron {
  width: 14px;
  height: 14px;
  color: var(--text-muted);
  transition: transform 0.15s ease;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.node-chevron.collapsed {
  transform: rotate(-90deg);
}

.node-spacer {
  width: 14px;
  flex-shrink: 0;
}

.node-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--text-muted);
}

.node-icon.folder {
  color: var(--accent-amber);
}

.node-icon.markdown {
  color: #3b82f6;
}

.node-icon.image {
  color: #22c55e;
}

.node-icon.config {
  color: #f97316;
}

.node-icon.code {
  color: #a855f7;
}

.node-icon.pdf {
  color: #ef4444;
}

.node-icon.text {
  color: #6b7280;
}

.node-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12.5px;
}

.node-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 8px;
  background: var(--bg-tertiary);
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.search-highlight {
  background: color-mix(in srgb, var(--accent) 25%, transparent);
  color: var(--accent);
  border-radius: 2px;
  padding: 0 1px;
}

.tree-node.active .search-highlight {
  background: rgba(255, 255, 255, 0.35);
  color: white;
}
</style>
