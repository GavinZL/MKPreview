import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import {
  EditorView, keymap, lineNumbers, drawSelection,
  highlightActiveLine, highlightActiveLineGutter,
  dropCursor, rectangularSelection, crosshairCursor,
} from '@codemirror/view'
import {
  indentOnInput, syntaxHighlighting, defaultHighlightStyle,
  bracketMatching, foldGutter, indentUnit,
} from '@codemirror/language'
import {
  history, defaultKeymap, historyKeymap, indentWithTab,
} from '@codemirror/commands'
import {
  searchKeymap, highlightSelectionMatches,
} from '@codemirror/search'
import { EditorState, Compartment, type Extension } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'

export interface CodeMirrorOptions {
  readonly?: boolean
  dark?: boolean
  lineNumbers?: boolean
  content?: string
  wordWrap?: boolean
  tabSize?: number
  onContentChange?: (content: string) => void
  onCursorChange?: (position: { line: number; ch: number }) => void
}

export function useCodeMirror(
  containerRef: Ref<HTMLElement | undefined>,
  options: CodeMirrorOptions = {}
) {
  const {
    readonly = false,
    dark = false,
    lineNumbers: showLineNumbers = true,
    wordWrap = true,
    tabSize = 2,
    onContentChange,
    onCursorChange,
  } = options

  const view = ref<EditorView | null>(null)
  const themeCompartment = new Compartment()

  function createExtensions(darkMode: boolean): Extension[] {
    const exts: Extension[] = [
      // 基础编辑
      showLineNumbers !== false ? lineNumbers() : [],
      highlightActiveLineGutter(),
      highlightActiveLine(),
      drawSelection(),
      dropCursor(),
      indentOnInput(),
      bracketMatching(),
      rectangularSelection(),
      crosshairCursor(),

      // 历史记录（Undo/Redo）
      history(),

      // 代码折叠
      foldGutter({
        markerDOM(open) {
          const marker = document.createElement('span')
          marker.style.cursor = 'pointer'
          marker.style.color = 'var(--text-muted)'
          marker.style.fontSize = '10px'
          marker.textContent = open ? '▼' : '▶'
          return marker
        },
      }),

      // Markdown 语言
      markdown({ codeLanguages: languages }),

      // 语法高亮
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

      // 搜索高亮
      highlightSelectionMatches(),

      // 按键映射
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        indentWithTab,
      ]),

      // 缩进配置
      indentUnit.of(' '.repeat(tabSize)),

      // 自动换行
      wordWrap ? EditorView.lineWrapping : [],

      // 只读配置
      EditorState.readOnly.of(readonly),

      // 主题
      themeCompartment.of(darkMode ? oneDark : []),

      // 内容和光标变化监听
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          onContentChange?.(update.state.doc.toString())
        }
        if (update.selectionSet) {
          const pos = update.state.selection.main.head
          const line = update.state.doc.lineAt(pos)
          onCursorChange?.({
            line: line.number - 1,
            ch: pos - line.from,
          })
        }
      }),

      // 自定义主题样式
      EditorView.theme({
        '&': {
          fontSize: '14px',
          fontFamily: 'var(--font-mono, monospace)',
          lineHeight: '1.6',
        },
        '.cm-content': {
          padding: '20px 16px',
        },
        '.cm-gutters': {
          backgroundColor: 'transparent',
          borderRight: '1px solid var(--border)',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
        },
        '.cm-lineNumbers .cm-gutterElement': {
          color: 'var(--text-muted)',
          padding: '0 12px 0 8px',
          minWidth: '48px',
          textAlign: 'right',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'transparent',
          color: 'var(--text-primary)',
        },
        '.cm-activeLine': {
          backgroundColor: 'color-mix(in srgb, var(--accent) 4%, transparent)',
        },
        '.cm-selectionBackground': {
          backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent) !important',
        },
        '.cm-cursor': {
          borderLeftColor: 'var(--accent)',
        },
        '.cm-foldPlaceholder': {
          background: 'var(--bg-tertiary)',
          borderColor: 'var(--border)',
          color: 'var(--text-secondary)',
        },
      }),
    ]

    return exts.flat()
  }

  function init() {
    const container = containerRef.value
    if (!container) return

    const state = EditorState.create({
      doc: options.content ?? '',
      extensions: createExtensions(dark),
    })

    view.value = new EditorView({
      state,
      parent: container,
    })
  }

  function destroy() {
    view.value?.destroy()
    view.value = null
  }

  function setContent(content: string) {
    const v = view.value
    if (!v) return

    const current = v.state.doc.toString()
    if (current === content) return

    v.dispatch({
      changes: {
        from: 0,
        to: current.length,
        insert: content,
      },
    })
  }

  function setTheme(darkMode: boolean) {
    const v = view.value
    if (!v) return

    v.dispatch({
      effects: themeCompartment.reconfigure(darkMode ? oneDark : []),
    })
  }

  /** 获取当前编辑器内容 */
  function getContent(): string {
    return view.value?.state.doc.toString() ?? ''
  }

  /** 获取光标位置 */
  function getCursorPosition(): { line: number; ch: number } {
    if (!view.value) return { line: 0, ch: 0 }
    const pos = view.value.state.selection.main.head
    const line = view.value.state.doc.lineAt(pos)
    return { line: line.number - 1, ch: pos - line.from }
  }

  /** 设置光标位置 */
  function setCursorPosition(line: number, ch: number) {
    if (!view.value) return
    const doc = view.value.state.doc
    const targetLine = doc.line(Math.min(line + 1, doc.lines))
    const pos = Math.min(targetLine.from + ch, targetLine.to)
    view.value.dispatch({
      selection: { anchor: pos },
      scrollIntoView: true,
    })
  }

  /** 插入文本 */
  function insertText(text: string) {
    if (!view.value) return
    const { from } = view.value.state.selection.main
    view.value.dispatch({
      changes: { from, insert: text },
      selection: { anchor: from + text.length },
    })
  }

  /** 替换选中文本 */
  function replaceSelection(text: string) {
    if (!view.value) return
    view.value.dispatch(
      view.value.state.replaceSelection(text)
    )
  }

  /** 获取选中的文本 */
  function getSelectedText(): string {
    if (!view.value) return ''
    const { from, to } = view.value.state.selection.main
    return view.value.state.doc.sliceString(from, to)
  }

  /** 包裹选中文本 */
  function wrapSelection(before: string, after: string) {
    const selected = getSelectedText()
    if (selected) {
      replaceSelection(`${before}${selected}${after}`)
    } else {
      insertText(`${before}${after}`)
      // 移动光标到中间
      if (view.value) {
        const pos = view.value.state.selection.main.head - after.length
        view.value.dispatch({ selection: { anchor: pos } })
      }
    }
  }

  onMounted(() => init())
  onUnmounted(() => destroy())

  return {
    view,
    init,
    destroy,
    setContent,
    setTheme,
    getContent,
    getCursorPosition,
    setCursorPosition,
    insertText,
    replaceSelection,
    getSelectedText,
    wrapSelection,
  }
}
