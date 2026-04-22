import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEditorStore } from './editorStore'

describe('useEditorStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始状态', () => {
    const store = useEditorStore()
    expect(store.isModified).toBe(false)
    expect(store.cursorLine).toBe(0)
    expect(store.cursorColumn).toBe(0)
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(false)
    expect(store.cursorPosition).toEqual({ line: 0, column: 0 })
  })

  it('setModified: 更新修改状态', () => {
    const store = useEditorStore()
    store.setModified(true)
    expect(store.isModified).toBe(true)
    store.setModified(false)
    expect(store.isModified).toBe(false)
  })

  it('setCursorPosition: 更新光标位置', () => {
    const store = useEditorStore()
    store.setCursorPosition(10, 5)
    expect(store.cursorLine).toBe(10)
    expect(store.cursorColumn).toBe(5)
    expect(store.cursorPosition).toEqual({ line: 10, column: 5 })
  })

  it('setUndoRedoState: 更新撤销重做状态', () => {
    const store = useEditorStore()
    store.setUndoRedoState(true, true)
    expect(store.canUndo).toBe(true)
    expect(store.canRedo).toBe(true)
    store.setUndoRedoState(false, false)
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(false)
  })

  it('reset: 恢复所有状态为初始值', () => {
    const store = useEditorStore()
    store.setModified(true)
    store.setCursorPosition(20, 10)
    store.setUndoRedoState(true, true)

    store.reset()

    expect(store.isModified).toBe(false)
    expect(store.cursorLine).toBe(0)
    expect(store.cursorColumn).toBe(0)
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(false)
    expect(store.cursorPosition).toEqual({ line: 0, column: 0 })
  })
})
