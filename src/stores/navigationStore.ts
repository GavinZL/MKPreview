import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DisplayMode } from '@/types'

export interface NavigationEntry {
  path: string
  name: string
  scrollTop?: number
  displayMode?: DisplayMode
}

const MAX_HISTORY_SIZE = 10

export const useNavigationStore = defineStore('navigation', () => {
  const history = ref<NavigationEntry[]>([])
  const currentIndex = ref(-1)

  const canGoBack = computed(() => currentIndex.value > 0)
  const canGoForward = computed(() => currentIndex.value < history.value.length - 1)
  const currentEntry = computed(() =>
    currentIndex.value >= 0 ? history.value[currentIndex.value] : null
  )

  // 标记是否正在进行导航（回退/前进），避免重复 push
  let isNavigating = false

  function pushEntry(path: string, name: string, scrollTop?: number, displayMode?: DisplayMode) {
    if (isNavigating) return // 回退/前进操作不 push

    // 如果当前不在末尾，截断后续历史
    if (currentIndex.value < history.value.length - 1) {
      history.value = history.value.slice(0, currentIndex.value + 1)
    }

    // 避免连续相同文件且相同滚动位置和相同模式
    const last = history.value[history.value.length - 1]
    if (last && last.path === path && last.scrollTop === scrollTop && last.displayMode === displayMode) return

    history.value.push({ path, name, scrollTop, displayMode })
    currentIndex.value = history.value.length - 1

    // 限制最大容量，超出时从头部移除
    if (history.value.length > MAX_HISTORY_SIZE) {
      const overflow = history.value.length - MAX_HISTORY_SIZE
      history.value = history.value.slice(overflow)
      currentIndex.value = Math.max(0, currentIndex.value - overflow)
    }
  }

  // 更新当前条目的滚动位置（在跳转前调用）
  function updateCurrentScrollTop(scrollTop: number) {
    if (currentIndex.value >= 0 && currentIndex.value < history.value.length) {
      history.value[currentIndex.value].scrollTop = scrollTop
    }
  }

  function goBack(): NavigationEntry | null {
    if (!canGoBack.value) return null
    isNavigating = true
    currentIndex.value--
    const entry = history.value[currentIndex.value]
    // nextTick 后重置标记
    setTimeout(() => { isNavigating = false }, 0)
    return entry ?? null
  }

  function goForward(): NavigationEntry | null {
    if (!canGoForward.value) return null
    isNavigating = true
    currentIndex.value++
    const entry = history.value[currentIndex.value]
    setTimeout(() => { isNavigating = false }, 0)
    return entry ?? null
  }

  function clear() {
    history.value = []
    currentIndex.value = -1
  }

  return {
    history,
    currentIndex,
    canGoBack,
    canGoForward,
    currentEntry,
    pushEntry,
    updateCurrentScrollTop,
    goBack,
    goForward,
    clear,
  }
})
