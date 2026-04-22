import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFileSave } from './useFileSave'

vi.mock('@/services/tauriCommands', () => ({
  tauriCommands: {
    readFile: vi.fn().mockResolvedValue('# Test Content'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    searchFiles: vi.fn().mockResolvedValue([]),
  },
}))

import { tauriCommands } from '@/services/tauriCommands'
import { useTabStore } from '@/stores/tabStore'
import { useEditorStore } from '@/stores/editorStore'

describe('useFileSave', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(tauriCommands.writeFile).mockReset().mockResolvedValue(undefined)
    vi.mocked(tauriCommands.readFile).mockReset().mockResolvedValue('# Test Content')
  })

  describe('saveFile', () => {
    it('保存指定标签的文件：调用 writeFile 并 markSaved', async () => {
      vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
      const tabStore = useTabStore()
      await tabStore.openFile('/test.md', 'test.md')
      tabStore.updateContent('/test.md', 'new content')

      const { saveFile } = useFileSave()
      const result = await saveFile('/test.md')

      expect(result.success).toBe(true)
      expect(tauriCommands.writeFile).toHaveBeenCalledWith('/test.md', 'new content')
      expect(tabStore.tabs[0].isModified).toBe(false)
    })

    it('未修改的文件直接返回成功', async () => {
      vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
      const tabStore = useTabStore()
      await tabStore.openFile('/test.md', 'test.md')

      const { saveFile } = useFileSave()
      const result = await saveFile('/test.md')

      expect(result.success).toBe(true)
      expect(tauriCommands.writeFile).not.toHaveBeenCalled()
    })

    it('不存在的标签返回错误', async () => {
      const { saveFile } = useFileSave()
      const result = await saveFile('/nonexistent.md')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Tab not found')
    })

    it('写入失败返回错误信息', async () => {
      vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
      const tabStore = useTabStore()
      await tabStore.openFile('/test.md', 'test.md')
      tabStore.updateContent('/test.md', 'new content')

      vi.mocked(tauriCommands.writeFile).mockRejectedValue(new Error('disk full'))

      const { saveFile } = useFileSave()
      const result = await saveFile('/test.md')

      expect(result.success).toBe(false)
      expect(result.error).toBe('disk full')
    })
  })

  describe('saveCurrentFile', () => {
    it('保存当前活动文件', async () => {
      vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
      const tabStore = useTabStore()
      const editorStore = useEditorStore()
      await tabStore.openFile('/test.md', 'test.md')
      tabStore.updateContent('/test.md', 'new content')

      const { saveCurrentFile, lastSavedAt } = useFileSave()
      const result = await saveCurrentFile()

      expect(result.success).toBe(true)
      expect(tauriCommands.writeFile).toHaveBeenCalledWith('/test.md', 'new content')
      expect(tabStore.tabs[0].isModified).toBe(false)
      expect(editorStore.isModified).toBe(false)
      expect(lastSavedAt.value).not.toBeNull()
    })

    it('无活动文件返回错误', async () => {
      const { saveCurrentFile } = useFileSave()
      const result = await saveCurrentFile()

      expect(result.success).toBe(false)
      expect(result.error).toBe('No active file')
    })

    it('未修改的活动文件直接返回成功', async () => {
      vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
      const tabStore = useTabStore()
      await tabStore.openFile('/test.md', 'test.md')

      const { saveCurrentFile } = useFileSave()
      const result = await saveCurrentFile()

      expect(result.success).toBe(true)
      expect(tauriCommands.writeFile).not.toHaveBeenCalled()
    })
  })

  describe('saveAllFiles', () => {
    it('批量保存所有已修改的文件', async () => {
      vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
      const tabStore = useTabStore()
      await tabStore.openFile('/a.md', 'a.md')
      await tabStore.openFile('/b.md', 'b.md')
      await tabStore.openFile('/c.md', 'c.md')

      tabStore.updateContent('/a.md', 'modified a')
      tabStore.updateContent('/c.md', 'modified c')

      const { saveAllFiles } = useFileSave()
      const result = await saveAllFiles()

      expect(result.saved).toBe(2)
      expect(result.errors).toEqual([])
      expect(tauriCommands.writeFile).toHaveBeenCalledTimes(2)
    })

    it('部分保存失败收集错误', async () => {
      vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
      const tabStore = useTabStore()
      await tabStore.openFile('/a.md', 'a.md')
      await tabStore.openFile('/b.md', 'b.md')

      tabStore.updateContent('/a.md', 'modified a')
      tabStore.updateContent('/b.md', 'modified b')

      vi.mocked(tauriCommands.writeFile)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('permission denied'))

      const { saveAllFiles } = useFileSave()
      const result = await saveAllFiles()

      expect(result.saved).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('permission denied')
    })

    it('无修改文件时 saved 为 0', async () => {
      vi.mocked(tauriCommands.readFile).mockResolvedValue('content')
      const tabStore = useTabStore()
      await tabStore.openFile('/a.md', 'a.md')

      const { saveAllFiles } = useFileSave()
      const result = await saveAllFiles()

      expect(result.saved).toBe(0)
      expect(result.errors).toEqual([])
    })
  })
})
