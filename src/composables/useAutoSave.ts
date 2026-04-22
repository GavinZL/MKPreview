import { ref, watch, onUnmounted, type Ref } from 'vue'
import { useTabStore } from '@/stores/tabStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useFileSave } from './useFileSave'

export function useAutoSave(options?: {
  enabled?: Ref<boolean>
  interval?: Ref<number>
}) {
  const tabStore = useTabStore()
  const settingsStore = useSettingsStore()
  const { saveCurrentFile } = useFileSave()

  const enabled = options?.enabled ?? ref(settingsStore.autoSave)
  const interval = options?.interval ?? ref(settingsStore.autoSaveInterval)

  const autoSaveTimer = ref<ReturnType<typeof setTimeout> | null>(null)
  const isAutoSaving = ref(false)

  /** 启动自动保存计时器 */
  function scheduleAutoSave() {
    if (!enabled.value) return
    cancelAutoSave()

    autoSaveTimer.value = setTimeout(async () => {
      const activeTab = tabStore.activeTab
      if (activeTab?.isModified) {
        isAutoSaving.value = true
        await saveCurrentFile()
        isAutoSaving.value = false
      }
    }, interval.value * 1000)
  }

  /** 取消自动保存计时器 */
  function cancelAutoSave() {
    if (autoSaveTimer.value) {
      clearTimeout(autoSaveTimer.value)
      autoSaveTimer.value = null
    }
  }

  // 监听活动标签的 isModified 变化，触发自动保存计时
  watch(
    () => tabStore.activeTab?.isModified,
    (modified) => {
      if (modified) {
        scheduleAutoSave()
      } else {
        cancelAutoSave()
      }
    }
  )

  // 标签切换时取消当前计时器
  watch(
    () => tabStore.activeTabId,
    () => {
      cancelAutoSave()
    }
  )

  // 自动保存开关变化时处理
  watch(enabled, (newEnabled) => {
    if (!newEnabled) {
      cancelAutoSave()
    }
  })

  onUnmounted(() => {
    cancelAutoSave()
  })

  return {
    isAutoSaving,
    scheduleAutoSave,
    cancelAutoSave,
  }
}
