import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from './settingsStore'

// Mock services
vi.mock('@/services/tauriCommands', () => ({
  tauriCommands: {
    saveSettings: vi.fn(),
  },
}))

vi.mock('@/services/errorHandler', () => ({
  invokeWithDefault: vi.fn(),
}))

import { invokeWithDefault } from '@/services/errorHandler'

describe('useSettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始状态', () => {
    const store = useSettingsStore()
    expect(store.theme).toBe('system')
    expect(store.fontSize).toBe(16)
    expect(store.codeFontSize).toBe(14)
    expect(store.recentDirectories).toEqual([])
    expect(store.displayMode).toBe('preview')
  })

  it('setTheme: 设置主题偏好', () => {
    const store = useSettingsStore()
    store.setTheme('dark')
    expect(store.theme).toBe('dark')
    store.setTheme('light')
    expect(store.theme).toBe('light')
  })

  it('setDisplayMode: 切换 preview/source', () => {
    const store = useSettingsStore()
    store.setDisplayMode('source')
    expect(store.displayMode).toBe('source')
    store.setDisplayMode('split')
    expect(store.displayMode).toBe('split')
  })

  it('setFontSize: 正常值', () => {
    const store = useSettingsStore()
    store.setFontSize(18)
    expect(store.fontSize).toBe(18)
  })

  it('setFontSize: clamp 到 12-24 范围', () => {
    const store = useSettingsStore()
    store.setFontSize(8)
    expect(store.fontSize).toBe(12)
    store.setFontSize(30)
    expect(store.fontSize).toBe(24)
  })

  it('addRecentDirectory: 添加目录', () => {
    const store = useSettingsStore()
    store.addRecentDirectory('/path/one')
    expect(store.recentDirectories).toContain('/path/one')
    expect(store.lastDirectory).toBe('/path/one')
  })

  it('addRecentDirectory: 去重', () => {
    const store = useSettingsStore()
    store.addRecentDirectory('/path/one')
    store.addRecentDirectory('/path/one')
    expect(store.recentDirectories).toEqual(['/path/one'])
  })

  it('addRecentDirectory: 最多 10 个', () => {
    const store = useSettingsStore()
    for (let i = 0; i < 12; i++) {
      store.addRecentDirectory(`/path/${i}`)
    }
    expect(store.recentDirectories.length).toBe(10)
  })

  it('toSettingsObject: 返回完整 settings 对象', () => {
    const store = useSettingsStore()
    const obj = store.toSettingsObject()
    expect(obj.theme).toBe(store.theme)
    expect(obj.fontSize).toBe(store.fontSize)
    expect(obj.recentDirectories).toBe(store.recentDirectories)
  })

  it('loadSettings: mock invoke 返回配置后 apply', async () => {
    const mockSettings = {
      theme: 'dark' as const,
      fontSize: 20,
      codeFontSize: 14,
      recentDirectories: ['/docs'],
      lastDirectory: '/docs',
      treeExpandedState: {},
      windowState: { width: 1200, height: 800, x: 0, y: 0, maximized: false },
      sidebarWidth: 260,
      showLineNumbers: true,
      autoSave: false,
      autoSaveInterval: 3,
    }
    vi.mocked(invokeWithDefault).mockResolvedValue(mockSettings)

    const store = useSettingsStore()
    await store.loadSettings()

    expect(invokeWithDefault).toHaveBeenCalledWith('get_settings', undefined, expect.any(Object))
    expect(store.theme).toBe('dark')
    expect(store.fontSize).toBe(20)
    expect(store.recentDirectories).toEqual(['/docs'])
  })
})
