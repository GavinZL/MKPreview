import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTabStore } from './tabStore'

vi.mock('@/services/tauriCommands', () => ({
  tauriCommands: {
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
    searchFiles: vi.fn().mockResolvedValue([]),
  },
}))

import { tauriCommands } from '@/services/tauriCommands'

describe('useTabStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(tauriCommands.readFile).mockReset()
  })

  it('初始状态', () => {
    const store = useTabStore()
    expect(store.tabs).toEqual([])
    expect(store.activeTabId).toBeNull()
  })

  describe('openFile', () => {
    it('成功加载文件后 tabs 有一项, activeTabId 正确, content 正确', async () => {
      vi.mocked(tauriCommands.readFile).mockResolvedValue('file content')
      const store = useTabStore()
      await store.openFile('/test.md', 'test.md')
      expect(store.tabs).toHaveLength(1)
      expect(store.activeTabId).toBe('/test.md')
      expect(store.tabs[0].content).toBe('file content')
    })

    it('已打开文件切换标签，不重复创建', async () => {
      vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
      const store = useTabStore()
      await store.openFile('/test.md', 'test.md')
      await store.openFile('/other.md', 'other.md')
      expect(store.tabs).toHaveLength(2)

      // 切回第一个文件
      await store.openFile('/test.md', 'test.md')
      expect(store.tabs).toHaveLength(2)
      expect(store.activeTabId).toBe('/test.md')
    })

    it('失败时抛出错误', async () => {
      vi.mocked(tauriCommands.readFile).mockRejectedValue(new Error('read failed'))
      const store = useTabStore()
      await expect(store.openFile('/test.md', 'test.md')).rejects.toThrow('read failed')
    })
  })

  describe('activateTab', () => {
    it('激活指定标签', async () => {
      vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
      const store = useTabStore()
      await store.openFile('/a.md', 'a.md')
      await store.openFile('/b.md', 'b.md')
      expect(store.activeTabId).toBe('/b.md')

      store.activateTab('/a.md')
      expect(store.activeTabId).toBe('/a.md')
    })
  })

  describe('closeTab', () => {
    it('关闭标签后激活左侧标签', async () => {
      vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
      const store = useTabStore()
      await store.openFile('/a.md', 'a.md')
      await store.openFile('/b.md', 'b.md')
      await store.openFile('/c.md', 'c.md')
      store.activateTab('/b.md')

      store.closeTab('/b.md')
      expect(store.tabs).toHaveLength(2)
      // 关闭 b 后，优先激活左侧的 a
      expect(store.activeTabId).toBe('/a.md')
    })

    it('关闭唯一标签后 activeTabId 为 null', async () => {
      vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
      const store = useTabStore()
      await store.openFile('/test.md', 'test.md')
      store.closeTab('/test.md')
      expect(store.tabs).toEqual([])
      expect(store.activeTabId).toBeNull()
    })

    it('关闭非活动标签不改变 activeTabId', async () => {
      vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
      const store = useTabStore()
      await store.openFile('/a.md', 'a.md')
      await store.openFile('/b.md', 'b.md')

      store.closeTab('/a.md')
      expect(store.activeTabId).toBe('/b.md')
    })
  })

  describe('closeOthers', () => {
    it('只保留指定标签', async () => {
      vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
      const store = useTabStore()
      await store.openFile('/a.md', 'a.md')
      await store.openFile('/b.md', 'b.md')
      await store.openFile('/c.md', 'c.md')

      store.closeOthers('/b.md')
      expect(store.tabs).toHaveLength(1)
      expect(store.tabs[0].id).toBe('/b.md')
      expect(store.activeTabId).toBe('/b.md')
    })
  })

  describe('closeRight', () => {
    it('关闭右侧标签', async () => {
      vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
      const store = useTabStore()
      await store.openFile('/a.md', 'a.md')
      await store.openFile('/b.md', 'b.md')
      await store.openFile('/c.md', 'c.md')
      await store.openFile('/d.md', 'd.md')

      store.closeRight('/b.md')
      expect(store.tabs).toHaveLength(2)
      expect(store.tabs.map(t => t.id)).toEqual(['/a.md', '/b.md'])
    })

    it('关闭右侧后若 activeTab 被关闭则激活锚点标签', async () => {
      vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
      const store = useTabStore()
      await store.openFile('/a.md', 'a.md')
      await store.openFile('/b.md', 'b.md')
      await store.openFile('/c.md', 'c.md')

      store.activateTab('/c.md')
      store.closeRight('/b.md')
      expect(store.activeTabId).toBe('/b.md')
    })
  })

  describe('closeAll', () => {
    it('清空所有标签', async () => {
      vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
      const store = useTabStore()
      await store.openFile('/a.md', 'a.md')
      await store.openFile('/b.md', 'b.md')

      store.closeAll()
      expect(store.tabs).toEqual([])
      expect(store.activeTabId).toBeNull()
    })
  })

  describe('updateContent', () => {
    it('内容变化且 isModified=true', async () => {
      vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
      const store = useTabStore()
      await store.openFile('/test.md', 'test.md')
      expect(store.tabs[0].isModified).toBe(false)

      store.updateContent('/test.md', 'new content')
      expect(store.tabs[0].content).toBe('new content')
      expect(store.tabs[0].isModified).toBe(true)
    })
  })

  describe('markSaved', () => {
    it('isModified 恢复为 false', async () => {
      vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
      const store = useTabStore()
      await store.openFile('/test.md', 'test.md')
      store.updateContent('/test.md', 'new content')
      expect(store.tabs[0].isModified).toBe(true)

      store.markSaved('/test.md')
      expect(store.tabs[0].isModified).toBe(false)
    })
  })

  describe('reorderTabs', () => {
    it('拖拽排序', async () => {
      vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
      const store = useTabStore()
      await store.openFile('/a.md', 'a.md')
      await store.openFile('/b.md', 'b.md')
      await store.openFile('/c.md', 'c.md')

      store.reorderTabs(0, 2)
      expect(store.tabs.map(t => t.id)).toEqual(['/b.md', '/c.md', '/a.md'])
    })
  })

  it('clearFile: 清空 tabs 和 activeTabId', async () => {
    vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
    const store = useTabStore()
    await store.openFile('/test.md', 'test.md')
    store.clearFile()
    expect(store.tabs).toEqual([])
    expect(store.activeTabId).toBeNull()
  })

  it('saveScrollPosition / restoreScrollPosition', async () => {
    vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
    const store = useTabStore()
    await store.openFile('/test.md', 'test.md')
    store.saveScrollPosition(150)
    expect(store.restoreScrollPosition()).toBe(150)
  })

  it('activeTab getter', async () => {
    vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
    const store = useTabStore()
    await store.openFile('/test.md', 'test.md')
    expect(store.activeTab).not.toBeNull()
    expect(store.activeTab?.name).toBe('test.md')
  })

  it('activeContent getter', async () => {
    vi.mocked(tauriCommands.readFile).mockResolvedValue('hello world')
    const store = useTabStore()
    await store.openFile('/test.md', 'test.md')
    expect(store.activeContent).toBe('hello world')
  })

  it('hasActiveFile getter', async () => {
    vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
    const store = useTabStore()
    expect(store.hasActiveFile).toBe(false)
    await store.openFile('/test.md', 'test.md')
    expect(store.hasActiveFile).toBe(true)
  })

  it('fileName getter', async () => {
    vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
    const store = useTabStore()
    expect(store.fileName).toBe('')
    await store.openFile('/test.md', 'test.md')
    expect(store.fileName).toBe('test.md')
  })

  it('filePath getter', async () => {
    vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
    const store = useTabStore()
    expect(store.filePath).toBe('')
    await store.openFile('/test.md', 'test.md')
    expect(store.filePath).toBe('/test.md')
  })

  it('hasModifiedTabs getter', async () => {
    vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
    const store = useTabStore()
    await store.openFile('/a.md', 'a.md')
    await store.openFile('/b.md', 'b.md')
    expect(store.hasModifiedTabs).toBe(false)

    store.updateContent('/a.md', 'modified')
    expect(store.hasModifiedTabs).toBe(true)
  })

  it('tabCount getter', async () => {
    vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
    const store = useTabStore()
    expect(store.tabCount).toBe(0)
    await store.openFile('/a.md', 'a.md')
    expect(store.tabCount).toBe(1)
  })
})
