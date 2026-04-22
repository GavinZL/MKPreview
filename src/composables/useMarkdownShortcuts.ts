import type { EditorView } from '@codemirror/view'
import { type Ref } from 'vue'

export function useMarkdownShortcuts(viewRef: Ref<EditorView | null>) {
  /** 加粗: Cmd+B */
  function toggleBold() {
    const view = viewRef.value
    if (!view) return
    wrapText(view, '**', '**')
  }

  /** 斜体: Cmd+I */
  function toggleItalic() {
    const view = viewRef.value
    if (!view) return
    wrapText(view, '*', '*')
  }

  /** 行内代码: Cmd+Shift+C */
  function toggleInlineCode() {
    const view = viewRef.value
    if (!view) return
    wrapText(view, '`', '`')
  }

  /** 标题级别提升: Cmd+Shift+] */
  function increaseHeading() {
    const view = viewRef.value
    if (!view) return
    const { state } = view
    const pos = state.selection.main.head
    const line = state.doc.lineAt(pos)
    const text = line.text

    // 匹配当前标题级别
    const match = text.match(/^(#{0,5})\s/)
    if (match) {
      const hashes = match[1].length
      if (hashes < 6) {
        const newText = text.replace(/^(#{0,5})\s/, '#'.repeat(hashes + 1) + ' ')
        view.dispatch({
          changes: { from: line.from, to: line.to, insert: newText },
        })
      }
    } else {
      // 非标题行，转为 H1
      view.dispatch({
        changes: { from: line.from, to: line.from, insert: '# ' },
      })
    }
  }

  /** 标题级别降低: Cmd+Shift+[ */
  function decreaseHeading() {
    const view = viewRef.value
    if (!view) return
    const { state } = view
    const pos = state.selection.main.head
    const line = state.doc.lineAt(pos)
    const text = line.text

    const match = text.match(/^(#{1,6})\s/)
    if (match) {
      const hashes = match[1].length
      if (hashes > 1) {
        const newText = text.replace(/^(#{1,6})\s/, '#'.repeat(hashes - 1) + ' ')
        view.dispatch({
          changes: { from: line.from, to: line.to, insert: newText },
        })
      } else {
        // H1 → 普通文本
        const newText = text.replace(/^#\s/, '')
        view.dispatch({
          changes: { from: line.from, to: line.to, insert: newText },
        })
      }
    }
  }

  /** 插入链接: Cmd+K */
  function insertLink() {
    const view = viewRef.value
    if (!view) return
    const selected = view.state.sliceDoc(
      view.state.selection.main.from,
      view.state.selection.main.to
    )
    if (selected) {
      wrapText(view, '[', '](https://)')
    } else {
      const text = '[链接文本](https://)'
      view.dispatch({
        changes: { from: view.state.selection.main.from, insert: text },
      })
    }
  }

  /** 插入无序列表 */
  function insertUnorderedList() {
    toggleLinePrefix(viewRef.value, '- ')
  }

  /** 插入有序列表 */
  function insertOrderedList() {
    toggleLinePrefix(viewRef.value, '1. ')
  }

  /** 插入引用块 */
  function insertBlockquote() {
    toggleLinePrefix(viewRef.value, '> ')
  }

  return {
    toggleBold,
    toggleItalic,
    toggleInlineCode,
    increaseHeading,
    decreaseHeading,
    insertLink,
    insertUnorderedList,
    insertOrderedList,
    insertBlockquote,
  }
}

// ========== 工具函数 ==========

/** 包裹文本 */
function wrapText(view: EditorView, before: string, after: string) {
  const { state } = view
  const { from, to } = state.selection.main
  const selected = state.sliceDoc(from, to)
  view.dispatch({
    changes: { from, to, insert: `${before}${selected}${after}` },
    selection: { anchor: from + before.length, head: to + before.length },
  })
}

/** 切换行前缀 */
function toggleLinePrefix(view: EditorView | null, prefix: string) {
  if (!view) return
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.head)
  const text = line.text
  if (text.startsWith(prefix)) {
    view.dispatch({
      changes: { from: line.from, to: line.from + prefix.length, insert: '' },
    })
  } else {
    view.dispatch({
      changes: { from: line.from, to: line.from, insert: prefix },
    })
  }
}
