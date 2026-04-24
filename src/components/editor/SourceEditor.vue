<template>
  <div ref="editorContainer" class="source-editor" />
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { useEditorStore } from '@/stores/editorStore'
import { useCodeMirror } from '@/composables/useCodeMirror'

interface Props {
  content: string
  readonly?: boolean
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
const isDark = computed(() => settingsStore.isDark)

const { setContent, setTheme, getContent, getCursorPosition } = useCodeMirror(editorContainer, {
  readonly: props.readonly,
  dark: isDark.value,
  lineNumbers: settingsStore.showLineNumbers,
  content: props.content,
  onContentChange: (newContent) => {
    if (!props.readonly) {
      emit('change', newContent)
      editorStore.setModified(true)
    }
  },
  onCursorChange: (pos) => {
    emit('cursorChange', pos)
    editorStore.setCursorPosition(pos.line, pos.ch)
  },
})

// 只在外部内容变化时同步（非编辑导致的变化）
watch(() => props.content, (val) => {
  const currentContent = getContent()
  if (val !== currentContent) {
    setContent(val)
  }
})

// 主题切换
watch(isDark, (dark) => setTheme(dark))

// 暴露方法供父组件调用
defineExpose({
  getContent,
  getCursorPosition,
})
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
  font-family: var(--font-code, var(--font-mono, monospace));
  font-size: var(--code-font-size, 14px);
  line-height: 1.6;
}
</style>
