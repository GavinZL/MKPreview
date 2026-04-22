# F07-01 CodeMirror 6 只读查看器 [MVP]

## 1. 功能描述与目标

**功能描述**：MVP 阶段的源码模式使用 CodeMirror 6 作为 Markdown 文本的只读查看器。用户可以在源码模式下查看 Markdown 原始文本，支持 Markdown 语法高亮、行号显示、主题跟随应用主题。

**目标**：
- 集成 CodeMirror 6 编辑器引擎，配置为只读模式
- 支持 Markdown 语法高亮（标题、代码块、链接、强调等）
- 显示行号（左侧固定宽度 gutter）
- 编辑器主题跟随应用亮/暗主题
- 支持大文件（5000+ 行）的流畅滚动
- 通过 `useCodeMirror.ts` composable 封装生命周期管理

**PRD 关联**：FR-003.2 源码模式（MVP 只读）、FR-007.5 CodeMirror 编辑器主题跟随应用主题

---

## 2. 技术实现方案

### 2.1 CodeMirror 6 核心包选择

| 包名 | 用途 |
|------|------|
| `@codemirror/view` | 编辑器视图核心 |
| `@codemirror/state` | 编辑器状态管理 |
| `@codemirror/lang-markdown` | Markdown 语言支持与语法高亮 |
| `@codemirror/language-data` | 代码块内嵌语言数据（用于 ``` 内的高亮） |
| `@codemirror/commands` | 基础编辑命令（MVP 只读模式下部分命令仍可用如查找） |
| `@codemirror/search` | 搜索面板（MVP 可用 Cmd/Cmd+F 搜索） |
| `@codemirror/lint` | 代码检查（Markdown 无需） |
| `@lezer/highlight` | 语法高亮样式系统 |
| `@codemirror/theme-one-dark` | 暗色主题基础（自定义改造） |

### 2.2 useCodeMirror Composable

```typescript
// composables/useCodeMirror.ts
import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { defaultKeymap } from '@codemirror/commands'

export interface CodeMirrorOptions {
  readonly?: boolean
  dark?: boolean
  lineNumbers?: boolean
  content?: string
}

export function useCodeMirror(
  containerRef: Ref<HTMLElement | undefined>,
  options: CodeMirrorOptions = {}
) {
  const view = ref<EditorView | null>(null)
  const { readonly = true, dark = false, lineNumbers: showLineNumbers = true } = options

  // 使用 Compartment 包装主题扩展，支持动态重配置（零销毁重建）
  const themeCompartment = new Compartment()

  function createExtensions(): Extension[] {
    const extensions: Extension[] = [
      // Markdown 语言支持（含代码块内嵌语言）
      markdown({ codeLanguages: languages }),

      // 只读配置
      EditorState.readOnly.of(readonly),

      // 行号
      showLineNumbers ? lineNumbers() : [],

      // 搜索高亮
      highlightSelectionMatches(),

      // 按键映射
      keymap.of([
        ...defaultKeymap,
        ...searchKeymap,
      ]),

      // 主题（通过 Compartment 包装，支持运行时动态切换）
      themeCompartment.of(dark ? oneDark : []),

      // 自定义样式扩展
      EditorView.theme({
        '&': {
          fontSize: '14px',
          fontFamily: 'var(--font-mono)',
          lineHeight: '1.6',
        },
        '.cm-content': {
          padding: '20px 0',
        },
        '.cm-gutters': {
          backgroundColor: 'transparent',
          borderRight: 'none',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
        },
        '.cm-lineNumbers .cm-gutterElement': {
          color: 'var(--text-muted)',
          padding: '0 16px 0 8px',
          minWidth: '56px',
          textAlign: 'right',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'transparent',
        },
        '.cm-activeLine': {
          backgroundColor: 'color-mix(in srgb, var(--accent) 5%, transparent)',
        },
        '.cm-selectionBackground': {
          backgroundColor: 'color-mix(in srgb, var(--accent) 25%, transparent)',
        },
      }),
    ]

    return extensions.flat()
  }

  function init(content: string = '') {
    if (!containerRef.value) return

    const state = EditorState.create({
      doc: content,
      extensions: createExtensions(),
    })

    view.value = new EditorView({
      state,
      parent: containerRef.value,
    })
  }

  function destroy() {
    view.value?.destroy()
    view.value = null
  }

  function setContent(content: string) {
    if (!view.value) return
    const current = view.value.state.doc.toString()
    if (current === content) return

    view.value.dispatch({
      changes: {
        from: 0,
        to: current.length,
        insert: content,
      },
    })
  }

  /**
   * 动态切换主题（CodeMirror 6 Compartment 方案）
   * 优点：零销毁重建，完整保留光标位置、选区、滚动状态和编辑历史
   */
  function setTheme(darkMode: boolean) {
    if (!view.value) return
    options.dark = darkMode
    view.value.dispatch({
      effects: themeCompartment.reconfigure(darkMode ? oneDark : [])
    })
  }

  // 生命周期
  onMounted(() => init(options.content ?? ''))
  onUnmounted(destroy)

  // 监听外部 content 变化
  watch(() => options.content, (newContent) => {
    if (newContent !== undefined) setContent(newContent)
  })

  return {
    view,
    init,
    destroy,
    setContent,
    setTheme,
  }
}
```

### 2.3 SourceEditor.vue 组件

```vue
<!-- components/editor/SourceEditor.vue -->
<template>
  <div ref="editorContainer" class="source-editor" />
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { useCodeMirror } from '@/composables/useCodeMirror'

interface Props {
  content: string
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: true,
})

const editorContainer = ref<HTMLElement>()
const settingsStore = useSettingsStore()
const isDark = computed(() => settingsStore.theme === 'dark')

const { setContent, setTheme } = useCodeMirror(editorContainer, {
  readonly: props.readonly,
  dark: isDark.value,
  lineNumbers: true,
  content: props.content,
})

// 内容变化时更新编辑器
watch(() => props.content, setContent)

// 主题变化时更新编辑器主题
watch(isDark, (dark) => setTheme(dark))
</script>

<style scoped>
.source-editor {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg-primary);
}

.source-editor :deep(.cm-editor) {
  height: 100%;
  background: var(--bg-primary);
}

.source-editor :deep(.cm-scroller) {
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.6;
}
</style>
```

### 2.4 Markdown 语法高亮 Token 映射

CodeMirror 6 的 `@codemirror/lang-markdown` 已内置 Markdown 语法高亮。以下为自定义的 Token 颜色映射（覆盖 Lezer 高亮类）：

```css
/* assets/styles/codemirror-theme.css */

/* 亮色主题 */
[data-theme="light"] .cm-editor {
  /* 标题 */
  .tok-heading { color: var(--accent-red); font-weight: 600; }

  /* 代码 */
  .tok-code { color: var(--accent-green); }

  /* 注释 / 元信息 */
  .tok-meta { color: var(--text-muted); }

  /* 链接 */
  .tok-link { color: var(--accent); text-decoration: underline; }

  /* 强调 */
  .tok-strong { font-weight: 600; }
  .tok-emphasis { font-style: italic; }

  /* 引用块标记 */
  .tok-quote { color: var(--accent); }

  /* 列表标记 */
  .tok-list { color: var(--accent); }

  /* 行内代码 */
  .tok-monospace { color: var(--accent-red); background: var(--bg-code); }
}

/* 暗色主题 */
[data-theme="dark"] .cm-editor {
  .tok-heading { color: var(--accent-red); font-weight: 600; }
  .tok-code { color: var(--accent-green); }
  .tok-meta { color: var(--text-muted); }
  .tok-link { color: var(--accent); text-decoration: underline; }
  .tok-strong { font-weight: 600; }
  .tok-emphasis { font-style: italic; }
  .tok-quote { color: var(--accent); }
  .tok-list { color: var(--accent); }
  .tok-monospace { color: var(--accent-red); background: var(--bg-code); }
}
```

### 2.5 大文件处理

CodeMirror 6 使用虚拟滚动（virtual scrolling）技术，天然支持大文件的流畅渲染，无需额外实现虚拟化。但为确保性能：

1. **避免一次性全量高亮**：CodeMirror 6 的解析是增量和视口驱动的，默认已优化
2. **关闭不必要的扩展**：MVP 阶段不启用代码折叠、自动补全等可能增加解析负担的功能
3. **搜索使用 CodeMirror 内置**：`@codemirror/search` 提供高效的文档内搜索

---

## 3. 接口定义

### 3.1 SourceEditor.vue Props / Emits

```typescript
// components/editor/SourceEditor.vue
interface SourceEditorProps {
  /** Markdown 原始文本内容 */
  content: string
  /** 是否只读（MVP 默认 true） */
  readonly?: boolean
}

// 无 Emits（只读模式下不输出事件）
```

### 3.2 useCodeMirror Composable 接口

```typescript
// composables/useCodeMirror.ts
export interface CodeMirrorOptions {
  /** 是否只读 */
  readonly?: boolean
  /** 是否暗色主题 */
  dark?: boolean
  /** 是否显示行号 */
  lineNumbers?: boolean
  /** 初始内容 */
  content?: string
}

export interface UseCodeMirrorReturn {
  /** CodeMirror EditorView 实例 */
  view: Ref<EditorView | null>
  /** 初始化编辑器 */
  init: (content?: string) => void
  /** 销毁编辑器 */
  destroy: () => void
  /** 设置内容（不破坏编辑器状态） */
  setContent: (content: string) => void
  /** 切换主题 */
  setTheme: (dark: boolean) => void
}
```

### 3.3 依赖的 npm 包

```json
{
  "dependencies": {
    "@codemirror/view": "^6.28.0",
    "@codemirror/state": "^6.4.0",
    "@codemirror/lang-markdown": "^6.2.0",
    "@codemirror/language-data": "^6.5.0",
    "@codemirror/commands": "^6.5.0",
    "@codemirror/search": "^6.5.0",
    "@codemirror/theme-one-dark": "^6.1.0",
    "@lezer/highlight": "^1.2.0"
  }
}
```

---

## 4. 数据结构

### 4.1 Editor 状态类型

```typescript
// types/editor.ts

/** 编辑器光标位置 */
export interface EditorCursor {
  line: number
  column: number
  offset: number
}

/** 编辑器配置 */
export interface EditorConfig {
  readonly: boolean
  showLineNumbers: boolean
  tabSize: number
  wordWrap: boolean
}
```

### 4.2 SourceEditor 组件内部状态

```typescript
// SourceEditor.vue 内部
const state = {
  containerRef: Ref<HTMLElement>,     // 编辑器挂载容器
  view: EditorView | null,            // CodeMirror 实例
  currentContent: string,             // 当前显示的文本
  currentTheme: 'light' | 'dark',     // 当前主题
}
```

### 4.3 CSS 变量在 CodeMirror 中的应用

```css
/* CodeMirror 使用应用 CSS 变量实现主题跟随 */
.cm-editor {
  --cm-bg: var(--bg-primary);
  --cm-fg: var(--text-primary);
  --cm-gutter-fg: var(--text-muted);
  --cm-cursor: var(--accent);
  --cm-selection: color-mix(in srgb, var(--accent) 25%, transparent);
  --cm-active-line: color-mix(in srgb, var(--accent) 5%, transparent);

  background: var(--cm-bg);
  color: var(--cm-fg);
}
```

---

## 5. 依赖关系

| 依赖模块 | 特性 | 说明 |
|---------|------|------|
| M01 | F01-02 前端基础配置 | npm 包依赖管理、Vite 配置 |
| M05 | F05-01 单文件展示 | 接收 currentContent 作为显示内容 |
| M08 | F08-01 CSS 变量主题系统 | CodeMirror 主题需跟随应用主题 |
| M08 | F08-02 主题切换功能 | 监听主题变化动态切换编辑器主题 |
| M03 | F03-01 CSS Grid 布局 | SourceEditor 需嵌入 ContentArea |

**被依赖**：
- M07 F07-02 模式切换（Source 模式展示 SourceEditor）
- M07 F07-05 分屏模式（左侧源码使用 SourceEditor）

---

## 6. 测试要点

### 6.1 单元测试

| 测试项 | 输入 | 预期结果 |
|--------|------|---------|
| 初始化编辑器 | content = "# Hello" | CodeMirror 实例创建，内容正确显示 |
| 内容更新 | setContent("新内容") | 编辑器内容替换为"新内容"，不销毁重建 |
| 主题切换 | setTheme(true) | 编辑器背景/文字颜色变为暗色主题 |
| 只读模式 | readonly = true | 用户无法编辑文本 |
| 大文件加载 | 5000 行 Markdown | 滚动流畅，无卡顿 |

### 6.2 视觉测试

1. **语法高亮**：H1-H6 标题显示红色，`\`\`\` 代码块标记显示绿色，链接显示蓝色
2. **行号**：左侧显示行号，颜色为 `--text-muted`
3. **暗色主题**：切换暗色后编辑器背景变为 `#0D1117`，文字变为 `#E6EDF3`
4. **选中高亮**：选中文本时背景色为半透 accent 色
5. **当前行高亮**：光标所在行有轻微背景色差异

### 6.3 性能测试

| 指标 | 目标 |
|------|------|
| 初始化 1000 行文件 | < 100ms |
| 初始化 5000 行文件 | < 300ms |
| 滚动 5000 行文件 | 60fps，无掉帧 |
| 内存占用（只读模式） | 单文件 < 10MB |

### 6.4 跨平台测试

- macOS：Cmd+F 搜索正常工作，字体渲染清晰
- Windows：Ctrl+F 搜索正常工作，字体使用 JetBrains Mono / Fira Code
