import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Settings, ThemePreference, DisplayMode, BuiltInPreviewThemeId, PreviewTemplateId, SavedCustomTheme, AppLocale } from '@/types'
import { tauriCommands } from '@/services/tauriCommands'
import { invokeWithDefault } from '@/services/errorHandler'
import { updateMermaidTheme } from '@/lib/mermaidConfig'
import { setLocale as applyLocale } from '@/i18n'

const defaultSettings: Settings = {
  theme: 'system',
  displayMode: 'preview',
  fontSize: 16,
  codeFontSize: 14,
  recentDirectories: [],
  lastDirectory: null,
  treeExpandedState: {},
  windowState: { width: 1200, height: 800, x: 0, y: 0, maximized: false },
  sidebarWidth: 260,
  showLineNumbers: true,
  autoSave: false,
  autoSaveInterval: 3,
  enableMermaid: true,
  enableKaTeX: true,
  enableFolding: true,
  fontBody: '',
  fontCode: '',
  previewTheme: 'default',
  previewTemplate: 'default',
  customThemes: [],
  locale: 'zh-CN',
}

export const useSettingsStore = defineStore('settings', () => {
  // State
  const theme = ref<ThemePreference>('system')
  const displayMode = ref<DisplayMode>('preview')
  const fontSize = ref(16)
  const codeFontSize = ref(14)
  const recentDirectories = ref<string[]>([])
  const lastDirectory = ref<string | null>(null)
  const showLineNumbers = ref(true)
  const autoSave = ref(false)
  const autoSaveInterval = ref(3)
  const enableMermaid = ref(true)
  const enableKaTeX = ref(true)
  const enableFolding = ref(true)
  const fontBody = ref('')
  const fontCode = ref('')
  const sidebarWidth = ref(260)
  const treeExpandedState = ref<Record<string, boolean>>({})
  const previewTheme = ref<BuiltInPreviewThemeId>('default')
  const previewTemplate = ref<PreviewTemplateId>('default')
  const customThemes = ref<SavedCustomTheme[]>([])
  const locale = ref<AppLocale>('zh-CN')

  // Getters
  const isDark = computed(() => {
    if (theme.value === 'dark') return true
    if (theme.value === 'light') return false
    // system: 使用 matchMedia 检测
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const resolvedTheme = computed(() => isDark.value ? 'dark' : 'light')

  // Actions
  function setTheme(t: ThemePreference) {
    theme.value = t
    // 立即应用主题到 DOM
    const resolved = t === 'system' 
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : t
    document.documentElement.setAttribute('data-theme', resolved)
    // 同步 Mermaid 主题
    updateMermaidTheme(resolved).catch(err => {
      console.error('[settingsStore] Mermaid 主题同步失败:', err)
    })
  }

  function setDisplayMode(mode: DisplayMode) {
    displayMode.value = mode
  }

  function setPreviewTheme(id: BuiltInPreviewThemeId) {
    previewTheme.value = id
  }

  function setPreviewTemplate(id: PreviewTemplateId) {
    previewTemplate.value = id
  }

  function setLocale(l: AppLocale) {
    locale.value = l
    // 立即应用语言
    applyLocale(l)
  }

  function addCustomTheme(theme: SavedCustomTheme) {
    customThemes.value = [theme, ...customThemes.value].slice(0, 10)
  }

  function deleteCustomTheme(id: string) {
    customThemes.value = customThemes.value.filter(t => t.id !== id)
  }

  function setFontSize(size: number) {
    fontSize.value = Math.max(12, Math.min(24, size))
  }

  function addRecentDirectory(dir: string) {
    recentDirectories.value = [
      dir,
      ...recentDirectories.value.filter(d => d !== dir)
    ].slice(0, 10)
    lastDirectory.value = dir
  }

  // 从后端加载配置
  async function loadSettings() {
    const settings = await invokeWithDefault<Settings>(
      'get_settings',
      undefined,
      defaultSettings
    )
    applySettings(settings)
  }

  function applySettings(settings: Settings) {
    theme.value = settings.theme
    displayMode.value = settings.displayMode
    fontSize.value = settings.fontSize
    codeFontSize.value = settings.codeFontSize
    recentDirectories.value = settings.recentDirectories
    lastDirectory.value = settings.lastDirectory
    treeExpandedState.value = settings.treeExpandedState
    sidebarWidth.value = settings.sidebarWidth
    showLineNumbers.value = settings.showLineNumbers
    autoSave.value = settings.autoSave
    autoSaveInterval.value = settings.autoSaveInterval
    enableMermaid.value = settings.enableMermaid
    enableKaTeX.value = settings.enableKaTeX
    enableFolding.value = settings.enableFolding
    fontBody.value = settings.fontBody
    fontCode.value = settings.fontCode
    previewTheme.value = settings.previewTheme
    previewTemplate.value = settings.previewTemplate
    customThemes.value = settings.customThemes
    locale.value = settings.locale

    // 应用字体 CSS 变量
    if (settings.fontBody) {
      document.documentElement.style.setProperty('--font-body', settings.fontBody)
    }
    if (settings.fontCode) {
      document.documentElement.style.setProperty('--font-code', settings.fontCode)
    }
    // 应用字体大小 CSS 变量
    document.documentElement.style.setProperty('--font-size-base', `${settings.fontSize}px`)
    document.documentElement.style.setProperty('--code-font-size', `${settings.codeFontSize}px`)
  }

  // 保存到后端（防抖在外部或内部实现）
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      try {
        await tauriCommands.saveSettings(toSettingsObject())
      } catch (err) {
        console.error('Failed to save settings:', err)
      }
    }, 500)
  }

  function toSettingsObject(): Settings {
    return {
      theme: theme.value,
      displayMode: displayMode.value,
      fontSize: fontSize.value,
      codeFontSize: codeFontSize.value,
      recentDirectories: recentDirectories.value,
      lastDirectory: lastDirectory.value,
      treeExpandedState: treeExpandedState.value,
      windowState: { width: 1200, height: 800, x: 0, y: 0, maximized: false },
      sidebarWidth: sidebarWidth.value,
      showLineNumbers: showLineNumbers.value,
      autoSave: autoSave.value,
      autoSaveInterval: autoSaveInterval.value,
      enableMermaid: enableMermaid.value,
      enableKaTeX: enableKaTeX.value,
      enableFolding: enableFolding.value,
      fontBody: fontBody.value,
      fontCode: fontCode.value,
      previewTheme: previewTheme.value,
      previewTemplate: previewTemplate.value,
      customThemes: customThemes.value,
      locale: locale.value,
    }
  }

  // Watch 配置变化自动保存
  watch(
    [theme, displayMode, fontSize, codeFontSize, showLineNumbers, autoSave, autoSaveInterval, sidebarWidth, enableMermaid, enableKaTeX, enableFolding, fontBody, fontCode, previewTheme, previewTemplate, customThemes, locale],
    () => { scheduleSave() },
    { deep: true }
  )

  // Watch 字体设置变化，动态应用 CSS 变量
  watch(fontBody, (newFont) => {
    if (newFont) {
      document.documentElement.style.setProperty('--font-body', newFont)
    } else {
      document.documentElement.style.removeProperty('--font-body')
    }
  })

  watch(fontCode, (newFont) => {
    if (newFont) {
      document.documentElement.style.setProperty('--font-code', newFont)
    } else {
      document.documentElement.style.removeProperty('--font-code')
    }
  })

  watch(fontSize, (newSize) => {
    document.documentElement.style.setProperty('--font-size-base', `${newSize}px`)
  })

  watch(codeFontSize, (newSize) => {
    document.documentElement.style.setProperty('--code-font-size', `${newSize}px`)
  })

  return {
    // State
    theme, displayMode, fontSize, codeFontSize,
    recentDirectories, lastDirectory, showLineNumbers,
    autoSave, autoSaveInterval, enableMermaid, enableKaTeX, enableFolding, fontBody, fontCode,
    sidebarWidth, treeExpandedState, previewTheme, previewTemplate, customThemes, locale,
    // Getters
    isDark, resolvedTheme,
    // Actions
    setTheme, setDisplayMode, setPreviewTheme, setPreviewTemplate, addCustomTheme, deleteCustomTheme, setFontSize, setLocale,
    addRecentDirectory, loadSettings, scheduleSave,
    toSettingsObject,
  }
})
