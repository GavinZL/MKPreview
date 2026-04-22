import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUiStore } from './uiStore'

describe('useUiStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始状态', () => {
    const store = useUiStore()
    expect(store.sidebarWidth).toBe(260)
    expect(store.sidebarCollapsed).toBe(false)
    expect(store.splitRatio).toBe(0.5)
  })

  it('setSidebarWidth: 正常值', () => {
    const store = useUiStore()
    store.setSidebarWidth(300)
    expect(store.sidebarWidth).toBe(300)
  })

  it('setSidebarWidth: 低于 180 clamp', () => {
    const store = useUiStore()
    store.setSidebarWidth(100)
    expect(store.sidebarWidth).toBe(180)
  })

  it('setSidebarWidth: 超过 400 clamp', () => {
    const store = useUiStore()
    store.setSidebarWidth(500)
    expect(store.sidebarWidth).toBe(400)
  })

  it('toggleSidebar: 切换 collapsed 状态', () => {
    const store = useUiStore()
    expect(store.sidebarCollapsed).toBe(false)
    store.toggleSidebar()
    expect(store.sidebarCollapsed).toBe(true)
    store.toggleSidebar()
    expect(store.sidebarCollapsed).toBe(false)
  })

  it('setSplitRatio: 正常值', () => {
    const store = useUiStore()
    store.setSplitRatio(0.6)
    expect(store.splitRatio).toBe(0.6)
  })

  it('setSplitRatio: 边界 clamp（0.3-0.7）', () => {
    const store = useUiStore()
    store.setSplitRatio(0.1)
    expect(store.splitRatio).toBe(0.3)
    store.setSplitRatio(0.9)
    expect(store.splitRatio).toBe(0.7)
  })

  it('resetSidebarWidth: 重置为 260', () => {
    const store = useUiStore()
    store.setSidebarWidth(300)
    store.resetSidebarWidth()
    expect(store.sidebarWidth).toBe(260)
  })

  it('sidebarStyle getter: collapsed 时为 0px', () => {
    const store = useUiStore()
    store.sidebarCollapsed = true
    expect(store.sidebarStyle.width).toBe('0px')
  })

  it('sidebarStyle getter: 正常时带宽度', () => {
    const store = useUiStore()
    store.sidebarCollapsed = false
    store.sidebarWidth = 300
    expect(store.sidebarStyle.width).toBe('300px')
  })
})
