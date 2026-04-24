import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FileTreeNode } from '@/types'
import { tauriCommands } from '@/services/tauriCommands'
import { tauriEvents } from '@/services/tauriEvents'
import type { FsChangeEvent } from '@/types'
import type { UnlistenFn } from '@tauri-apps/api/event'

export const useFileTreeStore = defineStore('fileTree', () => {
  // State
  const rootPath = ref<string | null>(null)
  const rootNodes = ref<FileTreeNode[]>([])
  const expandedPaths = ref<Set<string>>(new Set())
  const selectedPath = ref<string | null>(null)
  const searchKeyword = ref('')
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)
  const showMarkdownOnly = ref(false)

  // 内部：事件监听 unlisten 句柄
  let unlistenFsChange: UnlistenFn | null = null
  let unlistenFsError: UnlistenFn | null = null

  // Getters
  const rootName = computed(() => {
    if (!rootPath.value) return ''
    const parts = rootPath.value.split(/[/\\]/)
    return parts[parts.length - 1] || rootPath.value
  })

  const hasRoot = computed(() => rootPath.value !== null)

  // 搜索过滤后的树
  const filteredRootNodes = computed(() => {
    let nodes = rootNodes.value
    
    // 应用 Markdown 过滤
    if (showMarkdownOnly.value) {
      nodes = filterMarkdownNodes(nodes)
    }
    
    // 应用搜索过滤
    if (!searchKeyword.value.trim()) return nodes
    return filterTree(nodes, searchKeyword.value.toLowerCase())
  })

  // Actions
  async function loadDirectory(path: string) {
    isLoading.value = true
    loadError.value = null
    try {
      // 如果已经在监听同一个路径，不重复重启 watcher
      if (rootPath.value !== path) {
        await stopWatching()
      }

      const tree = await tauriCommands.scanDirectory(path)
      rootPath.value = path
      rootNodes.value = tree

      // 默认展开第一层
      expandedPaths.value = new Set()
      for (const node of tree) {
        if (node.isDir) {
          expandedPaths.value.add(node.path)
        }
      }

      // 启动文件监控（只在路径变化或首次时）
      if (rootPath.value === path) {
        await startWatching(path)
      }
    } catch (err: any) {
      loadError.value = err.message || String(err)
      rootNodes.value = []
      rootPath.value = null
    } finally {
      isLoading.value = false
    }
  }

  function selectNode(path: string) {
    selectedPath.value = path
  }

  function toggleExpand(path: string) {
    if (expandedPaths.value.has(path)) {
      expandedPaths.value.delete(path)
    } else {
      expandedPaths.value.add(path)
    }
    // 触发响应式（Set 需要重新赋值）
    expandedPaths.value = new Set(expandedPaths.value)
  }

  function setSearchKeyword(keyword: string) {
    searchKeyword.value = keyword
  }

  function toggleMarkdownFilter(enabled: boolean) {
    showMarkdownOnly.value = enabled
  }

  // 文件监控相关
  async function startWatching(path: string) {
    try {
      await tauriCommands.startWatching(path)
      unlistenFsChange = await tauriEvents.onFsChange(handleFsChange)
      unlistenFsError = await tauriEvents.onFsError((event) => {
        console.warn('[FileTree] fs:error', event.message)
      })
    } catch (err) {
      console.warn('[FileTree] Failed to start watching:', err)
    }
  }

  async function stopWatching() {
    if (unlistenFsChange) {
      unlistenFsChange()
      unlistenFsChange = null
    }
    if (unlistenFsError) {
      unlistenFsError()
      unlistenFsError = null
    }
    try {
      await tauriCommands.stopWatching()
    } catch {
      // 忽略停止监控失败
    }
  }

  function handleFsChange(event: FsChangeEvent) {
    // 增量更新文件树，避免整目录重扫
    const { changeType, path, oldPath, isDir } = event

    if (changeType === 'modified') {
      // 文件内容修改不影响目录结构，直接忽略
      return
    }

    if (changeType === 'created') {
      // 新建：确定父目录，在 children 中插入新节点
      const parentPath = getParentPath(path)
      insertNode(parentPath, {
        name: path.split(/[/\\]/).pop() || path,
        path,
        isDir,
        children: isDir ? [] : undefined,
      })
      return
    }

    if (changeType === 'deleted') {
      // 删除：从父节点 children 中移除
      const parentPath = getParentPath(path)
      removeNode(parentPath, path)
      return
    }

    if (changeType === 'renamed' && oldPath) {
      // 重命名：找到旧节点，更新 name 和 path
      const parentPath = getParentPath(oldPath)
      updateNode(parentPath, oldPath, {
        name: path.split(/[/\\]/).pop() || path,
        path,
      })
      return
    }
  }

  /** 获取父目录路径 */
  function getParentPath(childPath: string): string {
    const lastSep = Math.max(childPath.lastIndexOf('/'), childPath.lastIndexOf('\\'))
    return lastSep > 0 ? childPath.substring(0, lastSep) : ''
  }

  /** 插入新节点 */
  function insertNode(parentPath: string, newNode: FileTreeNode) {
    // 重建根节点以触发响应式
    rootNodes.value = insertNodeRecursive([...rootNodes.value], parentPath, newNode)
  }

  function insertNodeRecursive(nodes: FileTreeNode[], parentPath: string, newNode: FileTreeNode): FileTreeNode[] {
    return nodes.map(node => {
      if (node.path === parentPath && node.isDir && node.children !== undefined) {
        return { ...node, children: [...node.children, newNode] }
      }
      if (node.children) {
        return { ...node, children: insertNodeRecursive(node.children, parentPath, newNode) }
      }
      return node
    })
  }

  /** 移除节点 */
  function removeNode(parentPath: string, targetPath: string) {
    rootNodes.value = removeNodeRecursive([...rootNodes.value], parentPath, targetPath)
  }

  function removeNodeRecursive(nodes: FileTreeNode[], parentPath: string, targetPath: string): FileTreeNode[] {
    return nodes
      .map(node => {
        if (node.path === parentPath && node.isDir && node.children) {
          return { ...node, children: node.children.filter(c => c.path !== targetPath) }
        }
        if (node.children) {
          return { ...node, children: removeNodeRecursive(node.children, parentPath, targetPath) }
        }
        return node
      })
      .filter(node => node.path !== targetPath) // 过滤掉被删除的节点
  }

  /** 更新节点（重命名） */
  function updateNode(parentPath: string, oldPath: string, updates: Partial<FileTreeNode>) {
    rootNodes.value = updateNodeRecursive([...rootNodes.value], parentPath, oldPath, updates)
  }

  function updateNodeRecursive(
    nodes: FileTreeNode[],
    parentPath: string,
    targetPath: string,
    updates: Partial<FileTreeNode>
  ): FileTreeNode[] {
    return nodes.map(node => {
      if (node.path === targetPath) {
        return { ...node, ...updates }
      }
      if (node.path === parentPath && node.isDir && node.children) {
        return {
          ...node,
          children: updateNodeRecursive(node.children, parentPath, targetPath, updates),
        }
      }
      if (node.children) {
        return { ...node, children: updateNodeRecursive(node.children, parentPath, targetPath, updates) }
      }
      return node
    })
  }

  // 辅助：递归过滤搜索
  function filterTree(nodes: FileTreeNode[], keyword: string): FileTreeNode[] {
    return nodes
      .map(node => {
        if (node.isDir && node.children) {
          const filteredChildren = filterTree(node.children, keyword)
          if (filteredChildren.length > 0) {
            return { ...node, children: filteredChildren }
          }
        }
        if (node.name.toLowerCase().includes(keyword)) {
          return node
        }
        return null
      })
      .filter((n): n is FileTreeNode => n !== null)
  }

  // 辅助：递归过滤只显示 Markdown 文件和包含 Markdown 文件的目录
  function filterMarkdownNodes(nodes: FileTreeNode[]): FileTreeNode[] {
    return nodes
      .map(node => {
        if (node.isDir && node.children) {
          const filteredChildren = filterMarkdownNodes(node.children)
          if (filteredChildren.length > 0) {
            return { ...node, children: filteredChildren }
          }
        }
        // 只保留 .md 和 .markdown 文件
        if (!node.isDir && (node.name.endsWith('.md') || node.name.endsWith('.markdown'))) {
          return node
        }
        return null
      })
      .filter((n): n is FileTreeNode => n !== null)
  }

  // 清理
  function $dispose() {
    stopWatching()
  }

  return {
    // State
    rootPath, rootNodes, expandedPaths, selectedPath,
    searchKeyword, isLoading, loadError, showMarkdownOnly,
    // Getters
    rootName, hasRoot, filteredRootNodes,
    // Actions
    loadDirectory, selectNode, toggleExpand,
    setSearchKeyword, stopWatching, handleFsChange, toggleMarkdownFilter,
    $dispose,
  }
})
