import { useNavigationStore, type NavigationEntry } from '@/stores/navigationStore'
import { useTabStore } from '@/stores/tabStore'
import { useSettingsStore } from '@/stores/settingsStore'

export function useNavigationActions() {
  const navigationStore = useNavigationStore()
  const tabStore = useTabStore()
  const settingsStore = useSettingsStore()

  function getCurrentScrollTop(): number {
    // 优先查找预览区域的滚动容器
    const previewContainer = document.querySelector('.markdown-preview') as HTMLElement | null
    if (previewContainer) {
      return previewContainer.scrollTop
    }
    // 如果是源码模式，找 CodeMirror 滚动容器
    const cmScroller = document.querySelector('.cm-scroller') as HTMLElement | null
    if (cmScroller) {
      return cmScroller.scrollTop
    }
    return 0
  }

  function restoreScrollPosition(scrollTop?: number) {
    if (scrollTop === undefined) return
    // 找到预览区域的滚动容器
    const previewContainer = document.querySelector('.markdown-preview') as HTMLElement | null
    if (previewContainer) {
      previewContainer.scrollTop = scrollTop
      return
    }
    // 如果是源码模式，找 CodeMirror 滚动容器
    const cmScroller = document.querySelector('.cm-scroller') as HTMLElement | null
    if (cmScroller) {
      cmScroller.scrollTop = scrollTop
    }
  }

  /** 保存当前活动文件的滚动位置到导航历史 */
  function saveCurrentScrollTop() {
    const currentTab = tabStore.activeTab
    if (!currentTab) return
    const scrollTop = getCurrentScrollTop()
    navigationStore.updateCurrentScrollTop(scrollTop)
  }

  function navigateToEntry(entry: NavigationEntry) {
    // 切换显示模式（如果有记录）
    if (entry.displayMode) {
      settingsStore.setDisplayMode(entry.displayMode)
    }

    const currentTab = tabStore.activeTab
    if (currentTab && currentTab.path === entry.path) {
      // 同文件回退/前进：只恢复滚动位置
      restoreScrollPosition(entry.scrollTop)
    } else {
      // 跨文件回退/前进：打开文件并恢复滚动位置
      tabStore.openFile(entry.path, entry.name)
      if (entry.scrollTop !== undefined) {
        setTimeout(() => restoreScrollPosition(entry.scrollTop), 300)
      }
    }
  }

  function navigateBack() {
    const entry = navigationStore.goBack()
    if (entry) {
      navigateToEntry(entry)
    }
  }

  function navigateForward() {
    const entry = navigationStore.goForward()
    if (entry) {
      navigateToEntry(entry)
    }
  }

  return {
    navigateBack,
    navigateForward,
    restoreScrollPosition,
    getCurrentScrollTop,
    saveCurrentScrollTop,
  }
}
