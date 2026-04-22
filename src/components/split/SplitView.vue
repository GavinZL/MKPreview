<template>
  <div class="split-view" ref="splitRef">
    <div class="split-source" :style="{ flex: `0 0 ${splitPercent}%` }" ref="sourcePane">
      <SourceEditor
        :content="content"
        :readonly="false"
        @change="onContentChange"
        @cursorChange="onCursorChange"
      />
    </div>
    <div
      class="split-divider"
      :class="{ 'is-dragging': isDragging }"
      @mousedown="startDrag"
      @dblclick="resetSplit"
    />
    <div class="split-preview" ref="previewPane">
      <MarkdownPreview
        :content="previewContent"
        :file-path="filePath"
        @rendered="onPreviewRendered"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import SourceEditor from '@/components/editor/SourceEditor.vue'
import MarkdownPreview from '@/components/preview/MarkdownPreview.vue'
import { useScrollSync } from '@/composables/useScrollSync'

interface Props {
  content: string
  filePath: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  change: [content: string]
  cursorChange: [pos: { line: number; ch: number }]
}>()

// ========== DOM Refs ==========
const splitRef = ref<HTMLElement>()
const sourcePane = ref<HTMLElement>()
const previewPane = ref<HTMLElement>()

// ========== 分割比例 ==========
const splitPercent = ref(50)
const isDragging = ref(false)

// ========== 实时预览（300ms 防抖） ==========
const previewContent = ref(props.content)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function onContentChange(content: string) {
  emit('change', content)
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    previewContent.value = content
  }, 300)
}

// 外部内容变化 → 立即更新预览
watch(() => props.content, (newContent) => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  previewContent.value = newContent
})

// ========== 拖拽分割条 ==========
function startDrag(e: MouseEvent) {
  e.preventDefault()
  isDragging.value = true

  const container = splitRef.value!
  const rect = container.getBoundingClientRect()

  // 拖拽期间暂停同步滚动
  disableSync()

  // 防止拖拽时选中文本
  document.body.style.userSelect = 'none'

  function onMouseMove(e: MouseEvent) {
    const x = e.clientX - rect.left
    const percent = Math.max(30, Math.min(70, (x / rect.width) * 100))
    splitPercent.value = percent
  }

  function onMouseUp() {
    isDragging.value = false
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    // 拖拽结束后恢复同步
    enableSync()
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

/** 双击恢复 50:50 */
function resetSplit() {
  splitPercent.value = 50
}

// ========== 同步滚动 ==========
const sourceScrollEl = ref<HTMLElement>()
const previewScrollEl = ref<HTMLElement>()

const {
  rebuildMappings,
  enableSync,
  disableSync,
} = useScrollSync(sourceScrollEl, previewScrollEl)

// 预览内容变化后重建映射表
watch(previewContent, () => {
  rebuildMappings()
})

// MarkdownPreview 渲染完成后重建映射表
function onPreviewRendered() {
  rebuildMappings()
}

// ========== 生命周期 ==========
onMounted(async () => {
  await nextTick()
  // 获取 CodeMirror 的内部滚动容器
  if (sourcePane.value) {
    sourceScrollEl.value = (sourcePane.value.querySelector('.cm-scroller') as HTMLElement) ?? undefined
  }
  // 获取 MarkdownPreview 的滚动容器
  if (previewPane.value) {
    previewScrollEl.value = (previewPane.value.querySelector('.markdown-preview') as HTMLElement) ?? undefined
  }
  // 容器就绪后启用同步
  enableSync()
})

onUnmounted(() => {
  disableSync()
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
})
</script>

<style scoped>
.split-view {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.split-source {
  overflow: hidden;
  min-width: 200px;
}

.split-divider {
  width: 4px;
  cursor: col-resize;
  background: var(--border);
  flex-shrink: 0;
  transition: background 0.15s;
}

.split-divider:hover,
.split-divider.is-dragging {
  background: var(--accent);
}

.split-preview {
  flex: 1;
  overflow: auto;
  min-width: 200px;
}
</style>
