# F04-01 文件树核心组件

## 1. 功能描述与目标

实现 MKPreview 左侧文件树面板的核心组件，递归展示目录结构：

- **目录加载**：调用 Rust `scan_directory` 命令获取目录树数据
- **递归渲染**：文件夹/文件图标 + 名称 + 文件数量角标（目录节点）
- **展开/折叠**：点击目录节点展开/折叠子目录，支持记忆展开状态
- **自然排序**：按数字前缀自然排序（`01_xxx` < `02_xxx` < `10_xxx`）
- **空目录过滤**：仅展示包含 `.md` 文件的目录
- **性能**：加载 250 文件/100 目录的树在 200ms 内完成

**核心目标**：
- 按原型设计渲染树节点（缩进、图标、角标、hover/选中高亮）
- 支持大规模目录（250+ 文件）的性能需求
- Pinia Store 管理树数据、展开状态和选中节点

## 2. 技术实现方案

### 2.1 Vue 3 组件设计

```vue
<!-- FileTree.vue -->
<template>
  <div class="file-tree" ref="treeContainer">
    <TreeNode
      v-for="node in sortedRootNodes"
      :key="node.path"
      :node="node"
      :depth="0"
    />
    <div v-if="!fileTreeStore.rootNodes.length" class="tree-empty">
      <p>点击工具栏打开目录</p>
    </div>
  </div>
</template>
```

```vue
<!-- TreeNode.vue -->
<template>
  <div class="tree-node-wrapper">
    <div
      class="tree-node"
      :class="{ active: isActive, expanded: isExpanded }"
      :style="nodeStyle"
      @click="handleClick"
    >
      <!-- 展开箭头 -->
      <span v-if="node.isDir" class="node-chevron" :class="{ collapsed: !isExpanded }">
        <ChevronDownIcon />
      </span>
      <span v-else class="node-spacer" />

      <!-- 图标 -->
      <span class="node-icon" :class="{ folder: node.isDir }">
        <FolderIcon v-if="node.isDir" />
        <FileTextIcon v-else />
      </span>

      <!-- 名称 -->
      <span class="node-label">{{ displayName }}</span>

      <!-- 文件数量角标 -->
      <span v-if="node.isDir && node.fileCount" class="node-badge">
        {{ node.fileCount }}
      </span>
    </div>

    <!-- 递归渲染子节点 -->
    <div v-if="node.isDir && isExpanded" class="tree-children">
      <TreeNode
        v-for="child in sortedChildren"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
      />
    </div>
  </div>
</template>
```

### 2.2 CSS 布局方案

```css
/* FileTree.vue / TreeNode.vue <style scoped> */
.file-tree {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px 4px calc(12px + var(--depth, 0) * 14px);
  cursor: pointer;
  user-select: none;
  border-radius: 4px;
  margin: 0 4px;
  transition: background 0.1s ease;
  height: 28px;
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

.tree-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  color: var(--text-muted);
  font-size: 12px;
}
```

### 2.3 Pinia Store 设计

```typescript
// stores/fileTreeStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { scanDirectory } from '@/services/tauriCommands'
import { naturalSort } from '@/lib/naturalSort'
import type { FileTreeNode } from '@/types/fileTree'

export const useFileTreeStore = defineStore('fileTree', () => {
  // ===== State =====
  const rootPath = ref('')
  const rootNodes = ref<FileTreeNode[]>([])
  const expandedPaths = ref<Set<string>>(new Set())
  const selectedPath = ref('')
  const isLoading = ref(false)

  // ===== Getters =====
  const rootName = computed(() => {
    if (!rootPath.value) return ''
    return rootPath.value.split(/[/\\]/).pop() || ''
  })

  const sortedRootNodes = computed(() => {
    return sortNodes(rootNodes.value)
  })

  const selectedNode = computed(() => {
    return findNodeByPath(rootNodes.value, selectedPath.value)
  })

  // ===== Actions =====
  async function loadDirectory(path?: string) {
    isLoading.value = true
    try {
      const targetPath = path || await openDirectoryDialog()
      if (!targetPath) return

      rootPath.value = targetPath
      const tree = await scanDirectory(targetPath)
      rootNodes.value = tree

      // 默认展开第一层
      tree.forEach(node => {
        if (node.isDir) expandedPaths.value.add(node.path)
      })
    } finally {
      isLoading.value = false
    }
  }

  function toggleExpand(path: string) {
    if (expandedPaths.value.has(path)) {
      expandedPaths.value.delete(path)
    } else {
      expandedPaths.value.add(path)
    }
  }

  function expandAll() {
    const collectPaths = (nodes: FileTreeNode[]) => {
      nodes.forEach(node => {
        if (node.isDir) {
          expandedPaths.value.add(node.path)
          if (node.children) collectPaths(node.children)
        }
      })
    }
    collectPaths(rootNodes.value)
  }

  function collapseAll() {
    expandedPaths.value.clear()
  }

  function selectNode(path: string) {
    selectedPath.value = path
  }

  function isExpanded(path: string): boolean {
    return expandedPaths.value.has(path)
  }

  // 持久化展开状态
  function saveExpandedState(): string[] {
    return Array.from(expandedPaths.value)
  }

  function restoreExpandedState(paths: string[]) {
    expandedPaths.value = new Set(paths)
  }

  return {
    rootPath, rootNodes, expandedPaths, selectedPath, isLoading,
    rootName, sortedRootNodes, selectedNode,
    loadDirectory, toggleExpand, expandAll, collapseAll,
    selectNode, isExpanded, saveExpandedState, restoreExpandedState
  }
})

// 递归排序
function sortNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  const sorted = [...nodes].sort((a, b) => naturalSort(a.name, b.name))
  return sorted.map(node => ({
    ...node,
    children: node.children ? sortNodes(node.children) : undefined
  }))
}

// 递归查找节点
function findNodeByPath(nodes: FileTreeNode[], path: string): FileTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.children) {
      const found = findNodeByPath(node.children, path)
      if (found) return found
    }
  }
  return null
}
```

### 2.4 自然排序工具

```typescript
// lib/naturalSort.ts
export function naturalSort(a: string, b: string): number {
  const collator = new Intl.Collator('zh-CN', {
    numeric: true,
    sensitivity: 'base'
  })
  return collator.compare(a, b)
}
```

## 3. 接口定义

### FileTree.vue Props/Emits

```typescript
// 无 Props，全部数据来自 fileTreeStore

interface FileTreeEmits {
  (e: 'node-select', node: FileTreeNode): void
  (e: 'node-expand', node: FileTreeNode): void
  (e: 'node-collapse', node: FileTreeNode): void
}
```

### TreeNode.vue Props/Emits

```typescript
interface TreeNodeProps {
  node: FileTreeNode
  depth: number
}

interface TreeNodeEmits {
  (e: 'select', node: FileTreeNode): void
  (e: 'toggle', node: FileTreeNode): void
}
```

### fileTreeStore 完整定义

| 类型 | 名称 | 类型 | 说明 |
|------|------|------|------|
| State | `rootPath` | `string` | 当前根目录绝对路径 |
| State | `rootNodes` | `FileTreeNode[]` | 树形数据 |
| State | `expandedPaths` | `Set<string>` | 已展开节点路径集合 |
| State | `selectedPath` | `string` | 当前选中节点路径 |
| State | `isLoading` | `boolean` | 是否正在加载 |
| Getter | `rootName` | `string` | 根目录名（路径最后一段） |
| Getter | `sortedRootNodes` | `FileTreeNode[]` | 自然排序后的根节点 |
| Getter | `selectedNode` | `FileTreeNode \| null` | 当前选中节点对象 |
| Action | `loadDirectory(path?)` | `Promise<void>` | 加载目录，path 为空时弹出对话框 |
| Action | `toggleExpand(path)` | `void` | 切换展开/折叠 |
| Action | `expandAll()` | `void` | 展开所有目录 |
| Action | `collapseAll()` | `void` | 折叠所有目录 |
| Action | `selectNode(path)` | `void` | 选中节点 |
| Action | `isExpanded(path)` | `boolean` | 判断是否已展开 |
| Action | `saveExpandedState()` | `string[]` | 导出展开状态用于持久化 |
| Action | `restoreExpandedState(paths)` | `void` | 恢复展开状态 |

## 4. 数据结构

```typescript
// types/fileTree.ts
export interface FileTreeNode {
  name: string
  path: string
  isDir: boolean
  children?: FileTreeNode[]
  fileCount?: number    // 目录下 .md 文件数（递归计数）
}

export interface FileTreeState {
  rootPath: string
  rootNodes: FileTreeNode[]
  expandedPaths: Set<string>
  selectedPath: string
  isLoading: boolean
}
```

## 5. 依赖关系

| 依赖模块 | 说明 |
|---------|------|
| F02-01 目录扫描服务 | Rust `scan_directory` 命令返回 FileTreeNode[] |
| F03-01 CSS Grid 整体布局 | FileTree 嵌套在 Sidebar 容器内 |
| F03-04 面板拖拽分割条 | 调整 Sidebar 宽度间接影响文件树显示区域 |
| F04-02 树节点交互 | TreeNode 的事件处理在此定义 |
| F04-03 树搜索过滤 | 搜索过滤结果基于 fileTreeStore.rootNodes |
| F08-01 CSS 变量主题系统 | --bg-tertiary、--accent、--accent-amber 等 |
| @tauri-apps/plugin-dialog | `open_directory_dialog` 系统目录选择 |

## 6. 测试要点

1. **目录加载**：调用 scan_directory 后是否正确渲染树结构
2. **自然排序**：`01_基础` < `02_进阶` < `10_高级` 是否正确排序
3. **空目录过滤**：不包含 .md 文件的目录是否被过滤
4. **展开/折叠**：点击目录节点是否正确展开/折叠子节点
5. **选中高亮**：选中文件节点时是否应用 active 样式（蓝色背景）
6. **文件角标**：目录节点是否显示递归 .md 文件数量
7. **图标区分**：文件夹图标为黄色，文件图标为灰色
8. **缩进层级**：每深一级增加 14px padding-left
9. **空状态**：未加载目录时是否显示提示
10. **性能**：250 文件/100 目录加载时间 < 200ms
11. **默认展开**：加载目录后第一层是否自动展开
12. **持久化**：展开状态 save/restore 是否正确
