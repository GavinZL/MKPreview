import { computed, watch } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import type { BuiltInPreviewThemeId } from '@/types'

export function usePreviewTheme() {
  const settingsStore = useSettingsStore()
  const currentTheme = computed<BuiltInPreviewThemeId>(
    () => settingsStore.previewTheme as BuiltInPreviewThemeId
  )

  function applyTheme(themeId: BuiltInPreviewThemeId) {
    document.querySelectorAll('.markdown-preview').forEach((el) => {
      el.setAttribute('data-preview-theme', themeId)
    })
  }

  function setTheme(themeId: BuiltInPreviewThemeId) {
    settingsStore.setPreviewTheme(themeId)
    applyTheme(themeId)
  }

  watch(
    currentTheme,
    (id) => {
      applyTheme(id)
    },
    { immediate: true }
  )

  return {
    currentTheme,
    setTheme,
    applyTheme,
  }
}
