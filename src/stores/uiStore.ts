import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUiStore = defineStore('ui', () => {
  // State
  const sidebarWidth = ref(260)
  const sidebarCollapsed = ref(false)
  const splitRatio = ref(0.5)
  const searchPanelVisible = ref(false)
  const settingsPanelVisible = ref(false)

  // Getters
  const sidebarStyle = computed(() => ({
    width: sidebarCollapsed.value ? '0px' : `${sidebarWidth.value}px`
  }))

  // Actions
  function setSidebarWidth(width: number) {
    sidebarWidth.value = Math.max(180, Math.min(400, width))
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function setSplitRatio(ratio: number) {
    splitRatio.value = Math.max(0.3, Math.min(0.7, ratio))
  }

  function resetSidebarWidth() {
    sidebarWidth.value = 260
  }

  return {
    sidebarWidth, sidebarCollapsed, splitRatio, searchPanelVisible, settingsPanelVisible,
    sidebarStyle,
    setSidebarWidth, toggleSidebar, setSplitRatio, resetSidebarWidth,
  }
})
