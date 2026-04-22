import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useEditorStore = defineStore('editor', () => {
  // State
  const isModified = ref(false)
  const cursorLine = ref(0)
  const cursorColumn = ref(0)
  const canUndo = ref(false)
  const canRedo = ref(false)

  // Getters
  const cursorPosition = computed(() => ({
    line: cursorLine.value,
    column: cursorColumn.value,
  }))

  // Actions
  function setModified(modified: boolean) {
    isModified.value = modified
  }

  function setCursorPosition(line: number, column: number) {
    cursorLine.value = line
    cursorColumn.value = column
  }

  function setUndoRedoState(undo: boolean, redo: boolean) {
    canUndo.value = undo
    canRedo.value = redo
  }

  function reset() {
    isModified.value = false
    cursorLine.value = 0
    cursorColumn.value = 0
    canUndo.value = false
    canRedo.value = false
  }

  return {
    isModified,
    cursorLine,
    cursorColumn,
    cursorPosition,
    canUndo,
    canRedo,
    setModified,
    setCursorPosition,
    setUndoRedoState,
    reset,
  }
})
