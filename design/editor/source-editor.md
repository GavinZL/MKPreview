# F07-03 CodeMirror 可编辑模式 [Phase 2]

## 1. 功能描述与目标

**功能描述**：Phase 2 阶段将 MVP 的 CodeMirror 只读查看器升级为完整可编辑模式。用户可以在源码模式下直接编辑 Markdown 文本，支持代码折叠、搜索替换、Markdown 快捷键（加粗、斜体、标题级别调整等）、Undo/Redo。

**目标**：
- CodeMirror 6 编辑器切换为可编辑模式（`readOnly: false`）
- 支持代码折叠（fold 代码块、标题区域）
- 搜索替换（Cmd/Ctrl+F 搜索、Cmd/Ctrl+H 替换）
- Markdown 快捷键：加粗 Cmd+B、斜体 Cmd+I、标题级别调整
- Undo/Redo（Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z）
- 编辑状态实时同步到 `editorStore` 和 `tabStore`
- 自动保存触发（与 F07-04 文件保存联动）

**PRD 关联**：FR-003.2 源码模式（Phase 2 可编辑）、FR-005 文件编辑与保存

---

## 2. 技术实现方案

### 2.1 可编辑模式核心配置

```typescript
// composables/useCodeMirror.ts (Phase 2 扩展)
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
}

export function useCodeMirror(
  containerRef: Ref<HTMLElement | undefined>,
  options: CodeMirrorOptions = {}
) {
  const {
    readonly = false,  // Phase 2: 默认 false（可编辑）
    dark = false,
    lineNumbers: showLineNumbers = true,
    wordWrap = true,
    tabSize = 2,
  } = options

  function createExtensions(): Extension[] {
    const extensions: Extension[] = [
      // 基础编辑
      lineNumbers(),
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
        ...historyKeymap,      // Undo/Redo
        ...searchKeymap,       // 搜索
        indentWithTab,         // Tab 缩进
      ]),

      // 缩进配置
      indentUnit.of(' '.repeat(tabSize)),

      // 自动换行
      wordWrap ? EditorView.lineWrapping : [],

      // 只读配置
      EditorState.readOnly.of(readonly),

      // 主题
      dark ? oneDark : [],

      // 自定义主题样式
      EditorView.theme({
        '&': {
          fontSize: '14px',
          fontFamily: 'var(--font-mono)',
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

    return extensions.flat()
  }

  // ... init, destroy, setContent, setTheme 与 F07-01 相同

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

  /** 插入文本（用于 Markdown 快捷键） */
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
      const pos = view.value!.state.selection.main.head - after.length
      view.value!.dispatch({ selection: { anchor: pos } })
    }
  }

  return {
    // ... F07-01 已有方法
    getContent,
    getCursorPosition,
    setCursorPosition,
    insertText,
    replaceSelection,
    getSelectedText,
    wrapSelection,
  }
}
```

### 2.2 Markdown 快捷键实现

```typescript
// composables/useMarkdownShortcuts.ts
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

  /** 标题级别提升: Cmd+Shift+.] */
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
      wrapText(view, '[', `](https://)`)
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

// 工具函数：包裹文本
function wrapText(view: EditorView, before: string, after: string) {
  const { state } = view
  const { from, to } = state.selection.main
  const selected = state.sliceDoc(from, to)
  view.dispatch({
    changes: { from, to, insert: `${before}${selected}${after}` },
    selection: { anchor: from + before.length, head: to + before.length },
  })
}

// 工具函数：切换行前缀
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
```

### 2.3 SourceEditor.vue (Phase 2 可编辑版)

```vue
<!-- components/editor/SourceEditor.vue (Phase 2) -->
<template>
  <div ref="editorContainer" class="source-editor" />
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { useEditorStore } from '@/stores/editorStore'
import { useTabStore } from '@/stores/tabStore'
import { useCodeMirror } from '@/composables/useCodeMirror'
import { useMarkdownShortcuts } from '@/composables/useMarkdownShortcuts'

interface Props {
  content: string
  readonly?: boolean
  tabId?: string
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
})

const emit = defineEmits<{
  change: [content: string]
  cursorChange: [position: { line: number; ch: number }]
}>()

const editorContainer = ref<HTMLElement>()
const settingsStore = useSettingsStore()
const editorStore = useEditorStore()
const tabStore = useTabStore()

const isDark = computed(() => settingsStore.theme === 'dark')

const { view, setContent, setTheme, getContent, getCursorPosition } =
  useCodeMirror(editorContainer, {
    readonly: props.readonly,
    dark: isDark.value,
    lineNumbers: true,
    wordWrap: true,
    tabSize: 2,
  })

// Markdown 快捷键
const shortcuts = useMarkdownShortcuts(view)

// 注册 Markdown 快捷键到 CodeMirror
onMounted(() => {
  if (!view.value) return

  const markdownKeymap = [
    { key: 'Mod-b', run: () => { shortcuts.toggleBold(); return true } },
    { key: 'Mod-i', run: () => { shortcuts.toggleItalic(); return true } },
    { key: 'Mod-Shift-c', run: () => { shortcuts.toggleInlineCode(); return true } },
    { key: 'Mod-Shift-.', run: () => { shortcuts.increaseHeading(); return true } },
    { key: 'Mod-Shift-,', run: () => { shortcuts.decreaseHeading(); return true } },
    { key: 'Mod-k', run: () => { shortcuts.insertLink(); return true } },
  ]

  view.value.dispatch({
    effects: EditorView.appendConfig.of([
      keymap.of(markdownKeymap),
    ]),
  })
})

// 内容变化监听 → 触发自动保存逻辑
watch(() => props.content, setContent)

// 监听编辑器内容变化（通过 CodeMirror updateListener）
// 实际实现需在 useCodeMirror 中添加 updateListener 扩展
function onEditorChange(content: string) {
  emit('change', content)
  editorStore.setModified(true)

  if (props.tabId) {
    tabStore.updateContent(props.tabId, content)
  }
}

// 主题变化
watch(isDark, (dark) => setTheme(dark))
</script>
```

### 2.4 editorStore 编辑状态管理

```typescript
// stores/editorStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useEditorStore = defineStore('editor', () => {
  const isModified = ref(false)
  const cursorLine = ref(0)
  const cursorColumn = ref(0)
  const canUndo = ref(false)
  const canRedo = ref(false)

  const cursorPosition = computed(() => ({
    line: cursorLine.value,
    column: cursorColumn.value,
  }))

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
  }
})
```

---

## 3. 接口定义

### 3.1 SourceEditor.vue Props / Emits (Phase 2)

```typescript
interface SourceEditorProps {
  content: string
  readonly?: boolean
  tabId?: string
}

interface SourceEditorEmits {
  (e: 'change', content: string): void
  (e: 'cursorChange', position: { line: number; ch: number }): void
}
```

### 3.2 useCodeMirror 扩展接口

```typescript
export interface UseCodeMirrorReturn {
  view: Ref<EditorView | null>
  init: (content?: string) => void
  destroy: () => void
  setContent: (content: string) => void
  setTheme: (dark: boolean) => void
  // Phase 2 新增
  getContent: () => string
  getCursorPosition: () => { line: number; ch: number }
  setCursorPosition: (line: number, ch: number) => void
  insertText: (text: string) => void
  replaceSelection: (text: string) => void
  getSelectedText: () => string
  wrapSelection: (before: string, after: string) => void
}
```

### 3.3 useMarkdownShortcuts 接口

```typescript
export interface UseMarkdownShortcutsReturn {
  toggleBold: () => void          // Cmd+B
  toggleItalic: () => void        // Cmd+I
  toggleInlineCode: () => void    // Cmd+Shift+C
  increaseHeading: () => void     // Cmd+Shift+]
  decreaseHeading: () => void     // Cmd+Shift+[
  insertLink: () => void          // Cmd+K
  insertUnorderedList: () => void
  insertOrderedList: () => void
  insertBlockquote: () => void
}
```

### 3.4 EditorStore 接口

```typescript
export interface EditorState {
  isModified: boolean
  cursorLine: number
  cursorColumn: number
  canUndo: boolean
  canRedo: boolean
}

export interface EditorActions {
  setModified(modified: boolean): void
  setCursorPosition(line: number, column: number): void
  setUndoRedoState(undo: boolean, redo: boolean): void
}
```

---

## 4. 数据结构

### 4.1 CodeMirror 扩展配置类型

```typescript
// types/codemirror.ts
import type { Extension } from '@codemirror/state'

export interface CodeMirrorConfig {
  readonly: boolean
  dark: boolean
  showLineNumbers: boolean
  wordWrap: boolean
  tabSize: number
  foldGutter: boolean
}

export interface EditorUpdateEvent {
  content: string
  cursorPosition: { line: number; ch: number }
  isModified: boolean
  canUndo: boolean
  canRedo: boolean
}
```

### 4.2 Markdown 快捷键映射表

```typescript
// config/markdownShortcuts.ts
export const MARKDOWN_SHORTCUTS = [
  { key: 'Mod-b', action: 'bold', label: '加粗' },
  { key: 'Mod-i', action: 'italic', label: '斜体' },
  { key: 'Mod-Shift-c', action: 'inlineCode', label: '行内代码' },
  { key: 'Mod-Shift-.', action: 'increaseHeading', label: '提升标题级别' },
  { key: 'Mod-Shift-,', action: 'decreaseHeading', label: '降低标题级别' },
  { key: 'Mod-k', action: 'link', label: '插入链接' },
] as const
```

---

## 5. 依赖关系

| 依赖模块 | 特性 | 说明 |
|---------|------|------|
| M07 | F07-01 CodeMirror 只读查看器 | 在只读基础上扩展为可编辑 |
| M05 | F05-02 多标签页管理 | 编辑内容同步到 tabStore.updateContent |
| M08 | F08-01 CSS 变量主题系统 | 编辑器主题跟随 |
| M02 | F02-02 文件读写命令 | 编辑后需要 write_file 保存 |

**被依赖**：
- M07 F07-04 文件保存（依赖编辑状态判断是否需要保存）
- M07 F07-05 分屏模式（分屏左侧需要可编辑编辑器）

---

## 6. 测试要点

### 6.1 单元测试

| 测试项 | 输入 | 预期结果 |
|--------|------|---------|
| 可编辑模式 | readonly = false | 用户可输入文本 |
| 内容编辑 | 输入新字符 | tabStore 对应 tab.isModified = true |
| Undo | Cmd+Z | 撤销最近编辑操作 |
| Redo | Cmd+Shift+Z | 重做已撤销操作 |
| 搜索 | Cmd+F | 打开 CodeMirror 搜索面板 |
| 替换 | Cmd+H | 打开 CodeMirror 替换面板 |
| 加粗快捷键 | 选中文本 + Cmd+B | 文本被 ** 包裹 |
| 标题提升 | 光标在 H2 行 + Cmd+Shift+] | 变为 H3 |
| 代码折叠 | 点击 gutter 折叠标记 | 代码块折叠/展开 |

### 6.2 集成测试

1. **编辑 → 修改标记**：编辑文件 → tab 显示修改圆点 → 保存后圆点消失
2. **Undo/Redo 链路**：编辑文本 → Undo → Redo → 内容恢复
3. **分屏编辑同步**：分屏模式下编辑源码 → 右侧预览实时更新（需 F07-05）

### 6.3 性能测试

| 指标 | 目标 |
|------|------|
| 输入响应延迟 | < 16ms |
| 大文件编辑（5000 行） | 打字无卡顿 |
| Undo/Redo 栈内存 | 1000 步操作 < 5MB |

### 6.4 可访问性测试

- Tab 键在编辑器内产生缩进（indentWithTab）
- 搜索面板支持键盘导航
- 代码折叠可通过键盘操作
