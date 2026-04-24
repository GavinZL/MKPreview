import { onUnmounted } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUiStore } from '@/stores/uiStore'
import type { UnlistenFn } from '@tauri-apps/api/event'

export function useMenuEvents() {
  const settingsStore = useSettingsStore()
  const uiStore = useUiStore()

  const unlisteners: UnlistenFn[] = []

  async function setup() {
    unlisteners.push(
      await listen('menu:open-directory', async () => {
        const { openDirectoryDialog } = await import('@/composables/useOpenDirectory').then(m => m.useOpenDirectory())
        await openDirectoryDialog()
      }),
      await listen<string>('menu:set-mode', (event) => {
        settingsStore.setDisplayMode(event.payload as 'preview' | 'source' | 'split')
      }),
      await listen('menu:toggle-sidebar', () => {
        uiStore.toggleSidebar()
      })
    )
  }

  onUnmounted(() => unlisteners.forEach(fn => fn()))

  return { setupMenuEvents: setup }
}
