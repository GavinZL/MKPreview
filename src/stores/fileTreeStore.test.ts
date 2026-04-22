import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFileTreeStore } from './fileTreeStore'
import type { FileTreeNode } from '@/types'

vi.mock('@/services/tauriCommands', () => ({
  tauriCommands: {
    scanDirectory: vi.fn(),
    startWatching: vi.fn(),
    stopWatching: vi.fn(),
  },
}))

vi.mock('@/services/tauriEvents', () => ({
  tauriEvents: {
    onFsChange: vi.fn().mockResolvedValue(() => {}),
    onFsError: vi.fn().mockResolvedValue(() => {}),
  },
}))

describe('useFileTreeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始状态', () => {
    const store = useFileTreeStore()
    expect(store.rootPath).toBeNull()
    expect(store.rootNodes).toEqual([])
    expect(store.selectedPath).toBeNull()
    expect(store.searchKeyword).toBe('')
    expect(store.isLoading).toBe(false)
  })

  it('selectNode: 设置 selectedPath', () => {
    const store = useFileTreeStore()
    store.selectNode('/test.md')
    expect(store.selectedPath).toBe('/test.md')
  })

  it('toggleExpand: 切换展开状态', () => {
    const store = useFileTreeStore()
    store.toggleExpand('/dir')
    expect(store.expandedPaths.has('/dir')).toBe(true)
    store.toggleExpand('/dir')
    expect(store.expandedPaths.has('/dir')).toBe(false)
  })

  it('setSearchKeyword: 设置搜索关键词', () => {
    const store = useFileTreeStore()
    store.setSearchKeyword('test')
    expect(store.searchKeyword).toBe('test')
  })

  it('filteredRootNodes: 搜索过滤逻辑', () => {
    const store = useFileTreeStore()
    const nodes: FileTreeNode[] = [
      {
        name: 'readme.md',
        path: '/readme.md',
        isDir: false,
        children: [],
      },
      {
        name: 'notes',
        path: '/notes',
        isDir: true,
        children: [
          {
            name: 'todo.md',
            path: '/notes/todo.md',
            isDir: false,
            children: [],
          },
        ],
      },
    ]
    store.rootNodes = nodes

    store.setSearchKeyword('readme')
    expect(store.filteredRootNodes).toHaveLength(1)
    expect(store.filteredRootNodes[0].name).toBe('readme.md')

    store.setSearchKeyword('todo')
    expect(store.filteredRootNodes).toHaveLength(1)
    expect(store.filteredRootNodes[0].name).toBe('notes')

    store.setSearchKeyword('')
    expect(store.filteredRootNodes).toHaveLength(2)
  })

  it('rootName: 从 rootPath 提取目录名', () => {
    const store = useFileTreeStore()
    store.rootPath = '/Users/docs/project'
    expect(store.rootName).toBe('project')
  })

  it('rootName: rootPath 为空时返回空字符串', () => {
    const store = useFileTreeStore()
    store.rootPath = null
    expect(store.rootName).toBe('')
  })

  it('hasRoot getter', () => {
    const store = useFileTreeStore()
    expect(store.hasRoot).toBe(false)
    store.rootPath = '/docs'
    expect(store.hasRoot).toBe(true)
  })
})
