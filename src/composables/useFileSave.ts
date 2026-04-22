import { ref } from 'vue'
import { tauriCommands } from '@/services/tauriCommands'
import { useTabStore } from '@/stores/tabStore'
import { useEditorStore } from '@/stores/editorStore'

export interface SaveResult {
  success: boolean
  error?: string
}

export function useFileSave() {
  const tabStore = useTabStore()
  const editorStore = useEditorStore()
  const isSaving = ref(false)
  const lastSavedAt = ref<Date | null>(null)

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
      await tauriCommands.writeFile(tab.path, tab.content)
      tabStore.markSaved(tabId)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
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
      await tauriCommands.writeFile(activeTab.path, activeTab.content)
      tabStore.markSaved(activeTab.id)
      editorStore.setModified(false)
      lastSavedAt.value = new Date()
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
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
