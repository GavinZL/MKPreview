<template>
  <div class="single-file-view">
    <!-- 加载中 -->
    <div v-if="tabStore.isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <span>正在加载文件...</span>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!tabStore.hasActiveFile" class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      </div>
      <p class="empty-title">请选择一个 Markdown 文件</p>
      <p class="empty-desc">从左侧文件树中选择文件开始预览</p>
    </div>

    <!-- 有文件时显示内容 -->
    <template v-else>
      <!-- 预览模式 -->
      <MarkdownPreview
        v-if="settingsStore.displayMode === 'preview'"
        :content="tabStore.activeContent"
        :file-path="tabStore.filePath"
      />

      <!-- 源码模式（可编辑） -->
      <SourceEditor
        v-else-if="settingsStore.displayMode === 'source'"
        :content="tabStore.activeContent"
        :readonly="false"
        @change="onContentChange"
        @cursorChange="onCursorChange"
      />

      <!-- 分屏模式 -->
      <SplitView
        v-else-if="settingsStore.displayMode === 'split'"
        :content="tabStore.activeContent"
        :file-path="tabStore.filePath"
        @change="onContentChange"
        @cursorChange="onCursorChange"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { useTabStore } from '@/stores/tabStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useEditorStore } from '@/stores/editorStore'
import MarkdownPreview from '@/components/preview/MarkdownPreview.vue'
import SourceEditor from '@/components/editor/SourceEditor.vue'
import SplitView from '@/components/split/SplitView.vue'

const tabStore = useTabStore()
const settingsStore = useSettingsStore()
const editorStore = useEditorStore()

// basePath computed removed — SplitView uses filePath prop directly

function onContentChange(content: string) {
  if (tabStore.activeTabId) {
    tabStore.updateContent(tabStore.activeTabId, content)
  }
}

function onCursorChange(pos: { line: number; ch: number }) {
  editorStore.setCursorPosition(pos.line, pos.ch)
}
</script>

<style scoped>
.single-file-view {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: var(--text-secondary);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
  color: var(--text-muted);
}

.empty-icon {
  width: 48px;
  height: 48px;
  color: var(--text-muted);
  opacity: 0.5;
}

.empty-icon svg {
  width: 100%;
  height: 100%;
}

.empty-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-secondary);
}

.empty-desc {
  font-size: 13px;
}

.mode-fade-enter-active,
.mode-fade-leave-active {
  transition: opacity 150ms ease;
}

.mode-fade-enter-from,
.mode-fade-leave-to {
  opacity: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
