<template>
  <AppLayout />
  <!-- 全局弹出层 -->
  <SettingsPanel
    :visible="uiStore.settingsPanelVisible"
    @close="uiStore.settingsPanelVisible = false"
  />
  <ConflictDialog
    :visible="conflict.conflictVisible.value"
    :file-name="conflict.conflictInfo.value?.fileName ?? ''"
    :file-path="conflict.conflictInfo.value?.path ?? ''"
    @keep-local="conflict.keepLocal()"
    @load-external="conflict.loadExternal()"
    @view-diff="conflict.viewDiff()"
  />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import SettingsPanel from '@/components/settings/SettingsPanel.vue'
import ConflictDialog from '@/components/common/ConflictDialog.vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUiStore } from '@/stores/uiStore'
import { useFileConflict } from '@/composables/useFileConflict'
import { useMenuEvents } from '@/composables/useMenuEvents'
import { setLocale } from '@/i18n'

const settingsStore = useSettingsStore()
const uiStore = useUiStore()

// 初始化全局功能
const { setupMenuEvents } = useMenuEvents()
setupMenuEvents()
const conflict = useFileConflict()
conflict.startListening()

onUnmounted(() => {
  conflict.stopListening()
})

// 加载设置并应用主题和语言
onMounted(async () => {
  await settingsStore.loadSettings()
  document.documentElement.setAttribute('data-theme', settingsStore.resolvedTheme)
  setLocale(settingsStore.locale)
})
</script>
