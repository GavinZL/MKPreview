import { ref, onMounted, onUnmounted } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { useTabStore } from '@/stores/tabStore'

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
    unlisten = await listen<{ paths: string[]; type: string }>('fs:change', (event) => {
      const { paths, type } = event.payload

      if (type !== 'Modified' && type !== 'modified') return

      for (const changedPath of paths) {
        const tab = tabStore.tabs.find(t => t.path === changedPath)
        if (tab && tab.isModified) {
          conflictInfo.value = {
            path: changedPath,
            fileName: tab.name,
          }
          conflictVisible.value = true
          return
        }

        if (tab && !tab.isModified) {
          tabStore.refreshFileIfOpen(changedPath)
        }
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

  onMounted(() => startListening())
  onUnmounted(() => stopListening())

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
