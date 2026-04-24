import { ref } from 'vue'
import { tauriEvents } from '@/services/tauriEvents'
import { useTabStore } from '@/stores/tabStore'
import type { FsChangeEvent } from '@/types'

interface ConflictInfo {
  path: string
  fileName: string
}

export function useFileConflict() {
  const tabStore = useTabStore()
  const conflictVisible = ref(false)
  const conflictInfo = ref<ConflictInfo | null>(null)

  let unlisten: (() => void) | null = null

  async function startListening() {
    unlisten = await tauriEvents.onFsChange((payload: FsChangeEvent) => {
      if (payload.changeType !== 'modified') return
      const tab = tabStore.tabs.find(t => t.path === payload.path)
      if (!tab) return
      if (tab.isModified) {
        conflictInfo.value = {
          path: payload.path,
          fileName: tab.name,
        }
        conflictVisible.value = true
      } else {
        tabStore.refreshFileIfOpen(payload.path)
      }
    })
  }

  /** 保留本地修改 */
  function keepLocal() {
    conflictVisible.value = false
    conflictInfo.value = null
  }

  /** 加载外部版本 */
  async function loadExternal() {
    if (conflictInfo.value) {
      await tabStore.refreshFileIfOpen(conflictInfo.value.path)
    }
    conflictVisible.value = false
    conflictInfo.value = null
  }

  /** 查看差异（简化版：直接加载外部版本） */
  async function viewDiff() {
    await loadExternal()
  }

  function stopListening() {
    if (unlisten) {
      unlisten()
      unlisten = null
    }
  }

  return {
    conflictVisible,
    conflictInfo,
    keepLocal,
    loadExternal,
    viewDiff,
    startListening,
    stopListening,
  }
}
