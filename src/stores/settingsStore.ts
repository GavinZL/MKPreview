import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Settings, ThemePreference, DisplayMode, BuiltInPreviewThemeId, PreviewTemplateId, SavedCustomTheme } from '@/types'
import { tauriCommands } from '@/services/tauriCommands'
import { invokeWithDefault } from '@/services/errorHandler'

const defaultSettings: Settings = {
  theme: 'system',
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
    fontSize.value = settings.fontSize
    codeFontSize.value = settings.codeFontSize
    recentDirectories.value = settings.recentDirectories
    lastDirectory.value = settings.lastDirectory
    treeExpandedState.value = settings.treeExpandedState
    sidebarWidth.value = settings.sidebarWidth
    showLineNumbers.value = settings.showLineNumbers
    autoSave.value = settings.autoSave
    autoSaveInterval.value = settings.autoSaveInterval
    enableMermaid.value = settings.enableMermaid ?? true
    enableKaTeX.value = settings.enableKaTeX ?? true
    enableFolding.value = settings.enableFolding ?? true
    fontBody.value = settings.fontBody ?? ''
    fontCode.value = settings.fontCode ?? ''
    previewTheme.value = settings.previewTheme ?? 'default'
    previewTemplate.value = settings.previewTemplate ?? 'default'
    customThemes.value = settings.customThemes ?? []
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
    }
  }

  // Watch 配置变化自动保存
  watch(
    [theme, fontSize, codeFontSize, showLineNumbers, autoSave, autoSaveInterval, sidebarWidth, enableMermaid, enableKaTeX, enableFolding, fontBody, fontCode, previewTheme, previewTemplate, customThemes],
    () => { scheduleSave() },
    { deep: true }
  )

  return {
    // State
    theme, displayMode, fontSize, codeFontSize,
    recentDirectories, lastDirectory, showLineNumbers,
    autoSave, autoSaveInterval, enableMermaid, enableKaTeX, enableFolding, fontBody, fontCode,
    sidebarWidth, treeExpandedState, previewTheme, previewTemplate, customThemes,
    // Getters
    isDark, resolvedTheme,
    // Actions
    setTheme, setDisplayMode, setPreviewTheme, setPreviewTemplate, addCustomTheme, deleteCustomTheme, setFontSize,
    addRecentDirectory, loadSettings, scheduleSave,
    toSettingsObject,
  }
})
