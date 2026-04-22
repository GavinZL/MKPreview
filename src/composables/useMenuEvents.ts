import { onMounted, onUnmounted } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { useFileTreeStore } from '@/stores/fileTreeStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUiStore } from '@/stores/uiStore'
import type { UnlistenFn } from '@tauri-apps/api/event'

export function useMenuEvents() {
  const fileTreeStore = useFileTreeStore()
  const settingsStore = useSettingsStore()
  const uiStore = useUiStore()

  const unlisteners: UnlistenFn[] = []

  async function openDirectoryDialog() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择 Markdown 知识库目录',
    })
    if (selected && typeof selected === 'string') {
      await fileTreeStore.loadDirectory(selected)
      settingsStore.addRecentDirectory(selected)
    }
  }

  async function setup() {
    unlisteners.push(
      await listen('menu:open-directory', () => openDirectoryDialog()),
      await listen<string>('menu:set-mode', (event) => {
        settingsStore.setDisplayMode(event.payload as 'preview' | 'source' | 'split')
      }),
      await listen('menu:toggle-sidebar', () => {
        uiStore.toggleSidebar()
      })
    )
  }

  onMounted(() => setup())
  onUnmounted(() => unlisteners.forEach(fn => fn()))

  return { openDirectoryDialog }
}
