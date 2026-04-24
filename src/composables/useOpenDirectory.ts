import { open } from '@tauri-apps/plugin-dialog'
import { useFileTreeStore } from '@/stores/fileTreeStore'
import { useSettingsStore } from '@/stores/settingsStore'

export function useOpenDirectory() {
  const fileTreeStore = useFileTreeStore()
  const settingsStore = useSettingsStore()

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

  return { openDirectoryDialog }
}