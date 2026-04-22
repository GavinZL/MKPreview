import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { tauriCommands } from '@/services/tauriCommands'
import type { Tab, CursorPosition } from '@/types'

export const useTabStore = defineStore('tab', () => {
  // ========== State ==========
  const tabs = ref<Tab[]>([])
  const activeTabId = ref<string | null>(null)
  const isLoading = ref(false)

  // ========== Getters ==========
  const activeTab = computed(() =>
    tabs.value.find(t => t.id === activeTabId.value) ?? null
  )

  const activeContent = computed(() => activeTab.value?.content ?? '')

  const hasModifiedTabs = computed(() => tabs.value.some(t => t.isModified))

  const tabCount = computed(() => tabs.value.length)

  const hasActiveFile = computed(() => activeTab.value !== null)

  const fileName = computed(() => activeTab.value?.name ?? '')

  const filePath = computed(() => activeTab.value?.path ?? '')

  // ========== Actions ==========

  /** 打开或切换到标签 */
  async function openFile(path: string, name: string) {
    const existingTab = tabs.value.find(t => t.path === path)

    if (existingTab) {
      // 文件已在标签中，直接切换
      activeTabId.value = existingTab.id
      return
    }

    // 新标签：读取文件内容
    isLoading.value = true
    try {
      const content = await tauriCommands.readFile(path)
      const newTab: Tab = {
        id: path, // 用路径作为唯一 ID（同一文件不重复打开）
        path,
        name,
        content,
        scrollPosition: 0,
        cursorPosition: { line: 0, ch: 0 },
        isModified: false,
      }

      tabs.value.push(newTab)
      activeTabId.value = newTab.id
    } catch (error) {
      console.error('Failed to load file:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  /** 激活指定标签 */
  function activateTab(id: string) {
    activeTabId.value = id
  }

  /** 关闭指定标签（关闭后激活左侧标签） */
  function closeTab(id: string) {
    const index = tabs.value.findIndex(t => t.id === id)
    if (index === -1) return

    tabs.value.splice(index, 1)

    // 调整 activeTabId
    if (activeTabId.value === id) {
      if (tabs.value.length === 0) {
        activeTabId.value = null
      } else {
        // 优先激活左侧标签，否则第一个
        const newIndex = Math.max(0, index - 1)
        activeTabId.value = tabs.value[newIndex].id
      }
    }
  }

  /** 关闭其他标签 */
  function closeOthers(keepId: string) {
    const keepTab = tabs.value.find(t => t.id === keepId)
    if (!keepTab) return
    tabs.value = [keepTab]
    activeTabId.value = keepId
  }

  /** 关闭右侧标签 */
  function closeRight(anchorId: string) {
    const index = tabs.value.findIndex(t => t.id === anchorId)
    if (index === -1) return
    tabs.value = tabs.value.slice(0, index + 1)
    if (!tabs.value.find(t => t.id === activeTabId.value)) {
      activeTabId.value = anchorId
    }
  }

  /** 关闭全部标签 */
  function closeAll() {
    tabs.value = []
    activeTabId.value = null
  }

  /** 清空所有标签（兼容 MVP） */
  function clearFile() {
    closeAll()
  }

  /** 更新标签内容（编辑时设 isModified=true） */
  function updateContent(id: string, content: string) {
    const tab = tabs.value.find(t => t.id === id)
    if (tab) {
      tab.content = content
      tab.isModified = true
    }
  }

  /** 标记标签为已保存（设 isModified=false） */
  function markSaved(id: string) {
    const tab = tabs.value.find(t => t.id === id)
    if (tab) {
      tab.isModified = false
    }
  }

  /** 保存滚动位置（兼容旧签名：无 id 时保存到当前活动标签） */
  function saveScrollPosition(idOrPosition: string | number, position?: number) {
    if (typeof idOrPosition === 'string') {
      // 新签名: saveScrollPosition(id, position)
      const tab = tabs.value.find(t => t.id === idOrPosition)
      if (tab && position !== undefined) {
        tab.scrollPosition = position
      }
    } else {
      // 旧签名兼容: saveScrollPosition(position) — 保存到当前活动标签
      const tab = tabs.value.find(t => t.id === activeTabId.value)
      if (tab) tab.scrollPosition = idOrPosition
    }
  }

  /** 恢复滚动位置 */
  function restoreScrollPosition(): number {
    return activeTab.value?.scrollPosition ?? 0
  }

  /** 更新标签光标位置 */
  function saveCursorPosition(id: string, position: CursorPosition) {
    const tab = tabs.value.find(t => t.id === id)
    if (tab) {
      tab.cursorPosition = position
    }
  }

  /** 刷新当前打开的文件（如外部修改） */
  async function refreshFileIfOpen(path: string) {
    const tab = tabs.value.find(t => t.path === path)
    if (tab) {
      try {
        const content = await tauriCommands.readFile(path)
        tab.content = content
        tab.isModified = false
      } catch (err) {
        console.error('Failed to refresh file:', err)
      }
    }
  }

  /** 标签拖拽排序 */
  function reorderTabs(fromIndex: number, toIndex: number) {
    const [moved] = tabs.value.splice(fromIndex, 1)
    tabs.value.splice(toIndex, 0, moved)
  }

  return {
    // State
    tabs,
    activeTabId,
    isLoading,
    // Getters
    activeTab,
    activeContent,
    hasModifiedTabs,
    tabCount,
    hasActiveFile,
    fileName,
    filePath,
    // Actions
    openFile,
    activateTab,
    closeTab,
    closeOthers,
    closeRight,
    closeAll,
    clearFile,
    updateContent,
    markSaved,
    saveScrollPosition,
    restoreScrollPosition,
    saveCursorPosition,
    refreshFileIfOpen,
    reorderTabs,
  }
})
