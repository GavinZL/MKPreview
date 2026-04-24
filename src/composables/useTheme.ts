import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { updateMermaidTheme } from '@/lib/mermaidConfig'

export type ResolvedTheme = 'light' | 'dark'

export function useTheme() {
  const settingsStore = useSettingsStore()
  let mediaQuery: MediaQueryList | null = null

  const resolvedTheme = ref<ResolvedTheme>('light')

  function resolveTheme(): ResolvedTheme {
    const preference = settingsStore.theme
    if (preference === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return preference as ResolvedTheme
  }

  async function applyTheme(theme: ResolvedTheme) {
    document.documentElement.setAttribute('data-theme', theme)
    resolvedTheme.value = theme
    
    // 同步 Mermaid 主题（异步，不阻塞 UI）
    updateMermaidTheme(theme).catch(err => {
      console.error('[useTheme] Mermaid 主题同步失败:', err)
    })
  }

  function toggleTheme() {
    const next: ResolvedTheme = resolvedTheme.value === 'light' ? 'dark' : 'light'
    settingsStore.setTheme(next)
    applyTheme(next)
  }

  function handleSystemChange(e: MediaQueryListEvent) {
    if (settingsStore.theme === 'system') {
      applyTheme(e.matches ? 'dark' : 'light')
    }
  }

  onMounted(() => {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', handleSystemChange)
    applyTheme(resolveTheme())
  })

  onUnmounted(() => {
    mediaQuery?.removeEventListener('change', handleSystemChange)
  })

  watch(() => settingsStore.theme, () => {
    applyTheme(resolveTheme())
  })

  const isDark = computed(() => resolvedTheme.value === 'dark')

  return {
    resolvedTheme,
    isDark,
    toggleTheme,
    applyTheme,
    resolveTheme,
  }
}
