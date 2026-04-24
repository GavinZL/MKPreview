import { ref } from 'vue'
import { tauriCommands } from '@/services/tauriCommands'
import { useTabStore } from '@/stores/tabStore'
import { useEditorStore } from '@/stores/editorStore'
import { useFileConflict } from '@/composables/useFileConflict'

export interface SaveResult {
  success: boolean
  error?: string
  conflict?: boolean
}

export function useFileSave() {
  const tabStore = useTabStore()
  const editorStore = useEditorStore()
  const isSaving = ref(false)
  const lastSavedAt = ref<Date | null>(null)
  const fileConflict = useFileConflict()

  /** 保存指定标签的文件 */
  async function saveFile(tabId: string): Promise<SaveResult> {
    const tab = tabStore.tabs.find(t => t.id === tabId)
    if (!tab) {
      return { success: false, error: 'Tab not found' }
    }

    if (!tab.isModified) {
      return { success: true }
    }

    isSaving.value = true
    try {
      await tauriCommands.writeFile(tab.path, tab.content, tab.originalMtime)
      tabStore.markSaved(tabId)
      // 更新 originalMtime 为当前时间（保存后文件是最新的）
      const updatedTab = tabStore.tabs.find(t => t.id === tabId)
      if (updatedTab?.originalMtime !== undefined) {
        updatedTab.originalMtime = Date.now() / 1000
      }
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // 检测 FS_CONFLICT 错误码
      if (message.includes('FS_CONFLICT') || message.includes('FS_CONFLICT')) {
        fileConflict.conflictInfo.value = { path: tab.path, fileName: tab.name }
        fileConflict.conflictVisible.value = true
        return { success: false, error: message, conflict: true }
      }
      return { success: false, error: message }
    } finally {
      isSaving.value = false
    }
  }

  /** 保存当前活动文件 */
  async function saveCurrentFile(): Promise<SaveResult> {
    const activeTab = tabStore.activeTab
    if (!activeTab) {
      return { success: false, error: 'No active file' }
    }

    if (!activeTab.isModified) {
      return { success: true }
    }

    isSaving.value = true
    try {
      await tauriCommands.writeFile(activeTab.path, activeTab.content, activeTab.originalMtime)
      tabStore.markSaved(activeTab.id)
      editorStore.setModified(false)
      lastSavedAt.value = new Date()
      // 更新 originalMtime
      const updatedTab = tabStore.tabs.find(t => t.id === activeTab.id)
      if (updatedTab?.originalMtime !== undefined) {
        updatedTab.originalMtime = Date.now() / 1000
      }
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('FS_CONFLICT')) {
        fileConflict.conflictInfo.value = { path: activeTab.path, fileName: activeTab.name }
        fileConflict.conflictVisible.value = true
        return { success: false, error: message, conflict: true }
      }
      return { success: false, error: message }
    } finally {
      isSaving.value = false
    }
  }

  /** 保存所有已修改的文件 */
  async function saveAllFiles(): Promise<{ saved: number; errors: string[] }> {
    const modifiedTabs = tabStore.tabs.filter(t => t.isModified)
    const errors: string[] = []
    let saved = 0

    for (const tab of modifiedTabs) {
      const result = await saveFile(tab.id)
      if (result.success) {
        saved++
      } else {
        errors.push(`${tab.name}: ${result.error}`)
      }
    }

    return { saved, errors }
  }

  return {
    isSaving,
    lastSavedAt,
    saveFile,
    saveCurrentFile,
    saveAllFiles,
  }
}
