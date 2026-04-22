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
    if (!searchKeyword.value.trim()) return rootNodes.value
    return filterTree(rootNodes.value, searchKeyword.value.toLowerCase())
  })

  // Actions
  async function loadDirectory(path: string) {
    isLoading.value = true
    loadError.value = null
    try {
      // 停止之前的监控
      await stopWatching()

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

      // 启动文件监控
      await startWatching(path)
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

  function handleFsChange(_event: FsChangeEvent) {
    // MVP: 简单实现 - 重新加载整个目录树
    // Phase 2: 增量更新（handleCreate, handleDelete, handleRename, handleModify）
    if (rootPath.value) {
      loadDirectory(rootPath.value)
    }
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

  // 清理
  function $dispose() {
    stopWatching()
  }

  return {
    // State
    rootPath, rootNodes, expandedPaths, selectedPath,
    searchKeyword, isLoading, loadError,
    // Getters
    rootName, hasRoot, filteredRootNodes,
    // Actions
    loadDirectory, selectNode, toggleExpand,
    setSearchKeyword, stopWatching, handleFsChange,
    $dispose,
  }
})
