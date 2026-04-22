import { onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUiStore } from '@/stores/uiStore'
import { useTabStore } from '@/stores/tabStore'
import { useFileSave } from '@/composables/useFileSave'
import { useNavigationActions } from '@/composables/useNavigationActions'

export function useKeyboard() {
  const settingsStore = useSettingsStore()
  const uiStore = useUiStore()
  const tabStore = useTabStore()
  const { saveCurrentFile } = useFileSave()
  const { navigateBack, navigateForward } = useNavigationActions()

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const cmdKey = isMac ? 'metaKey' : 'ctrlKey'

  function handleKeyDown(e: KeyboardEvent) {
    if (!(e as any)[cmdKey]) return

    // 在输入框中忽略大部分快捷键
    const target = e.target as HTMLElement
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

    // Cmd/Ctrl+1: 预览模式
    if (e.key === '1') {
      e.preventDefault()
      settingsStore.setDisplayMode('preview')
      return
    }

    // Cmd/Ctrl+2: 源码模式
    if (e.key === '2') {
      e.preventDefault()
      settingsStore.setDisplayMode('source')
      return
    }

    // Cmd/Ctrl+B: 切换侧栏
    if (e.key === 'b' || e.key === 'B') {
      if (isInput) return
      e.preventDefault()
      uiStore.toggleSidebar()
      return
    }

    // Cmd/Ctrl+3: 分屏模式
    if (e.key === '3') {
      e.preventDefault()
      settingsStore.setDisplayMode('split')
      return
    }

    // Cmd/Ctrl+S: 保存当前文件
    if (e.key === 's' || e.key === 'S') {
      e.preventDefault()
      saveCurrentFile()
      return
    }

    // Cmd/Ctrl+W: 关闭当前标签
    if (e.key === 'w' || e.key === 'W') {
      if (isInput) return
      e.preventDefault()
      if (tabStore.activeTabId) {
        tabStore.closeTab(tabStore.activeTabId)
      }
      return
    }

    // Cmd/Ctrl+Shift+T: 切换主题
    if (e.shiftKey && (e.key === 't' || e.key === 'T')) {
      e.preventDefault()
      const newTheme = settingsStore.theme === 'dark' ? 'light' : 'dark'
      settingsStore.setTheme(newTheme)
      document.documentElement.setAttribute('data-theme', newTheme)
      return
    }

    // Cmd+Shift+F: 切换搜索面板
    if (e.shiftKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault()
      uiStore.searchPanelVisible = !uiStore.searchPanelVisible
      return
    }

    // Cmd+,: 打开设置面板
    if (e.key === ',') {
      e.preventDefault()
      uiStore.settingsPanelVisible = true
      return
    }

    // Cmd+[ 或 Ctrl+[ : 回退
    if (e.key === '[') {
      e.preventDefault()
      navigateBack()
      return
    }

    // Cmd+] 或 Ctrl+] : 前进
    if (e.key === ']') {
      e.preventDefault()
      navigateForward()
      return
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeyDown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))

  return { isMac, modifierKey: isMac ? 'Cmd' : 'Ctrl' }
}
