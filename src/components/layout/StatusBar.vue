<template>
  <footer class="statusbar">
    <div class="status-left">
      <template v-if="tabStore.hasActiveFile">
        <span v-if="isSaving" class="status-item status-saving">保存中...</span>
        <span v-else-if="isModified" class="status-item status-modified">已修改</span>
        <span v-else class="status-item status-saved">已保存</span>
        <span class="status-sep">|</span>
        <span class="status-item">UTF-8</span>
        <span class="status-sep">|</span>
        <span class="status-item">Markdown</span>
        <span class="status-sep">|</span>
        <span class="status-item">{{ lineCount }} 行</span>
        <span class="status-sep">|</span>
        <span class="status-item">{{ wordCount }} 字</span>
        <span class="status-sep">|</span>
        <span class="status-item">{{ formattedFileSize }}</span>
      </template>
      <template v-else>
        <span class="status-item">就绪</span>
      </template>
    </div>
    <div class="status-right">
      <span v-if="tabStore.hasActiveFile" class="status-item">行 {{ editorStore.cursorLine + 1 }}, 列 {{ editorStore.cursorColumn + 1 }}</span>
      <span class="status-sep">|</span>
      <span class="status-item">{{ modeLabel }}</span>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTabStore } from '@/stores/tabStore'
import { useEditorStore } from '@/stores/editorStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useFileSave } from '@/composables/useFileSave'
import { formatFileSize } from '@/lib/utils'

const tabStore = useTabStore()
const editorStore = useEditorStore()
const settingsStore = useSettingsStore()
const { isSaving } = useFileSave()

const isModified = computed(() => tabStore.activeTab?.isModified ?? false)

const lineCount = computed(() => {
  if (!tabStore.activeContent) return 0
  return tabStore.activeContent.split('\n').length
})

const wordCount = computed(() => {
  if (!tabStore.activeContent) return 0
  const text = tabStore.activeContent
  // 统计中文字符
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  // 统计英文单词（连续的字母数字序列）
  const englishWords = (text.match(/[a-zA-Z0-9]+/g) || []).length
  return chineseChars + englishWords
})

const formattedFileSize = computed(() => {
  if (!tabStore.activeContent) return ''
  const bytes = new TextEncoder().encode(tabStore.activeContent).length
  return formatFileSize(bytes)
})

const modeLabel = computed(() => {
  const map: Record<string, string> = {
    preview: '预览模式',
    source: '源码模式',
    split: '分屏模式'
  }
  return map[settingsStore.displayMode] || '预览模式'
})
</script>

<style scoped>
.statusbar {
  grid-area: status;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-muted);
  height: 24px;
  flex-shrink: 0;
  user-select: none;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-item {
  white-space: nowrap;
}

.status-sep {
  color: var(--border);
  user-select: none;
}

.status-modified {
  color: var(--accent, #f59e0b);
}

.status-saved {
  color: var(--text-muted);
}

.status-saving {
  color: var(--text-muted);
  font-style: italic;
}
</style>
