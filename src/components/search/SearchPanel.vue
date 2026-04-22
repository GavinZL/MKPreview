<template>
  <div v-if="visible" class="search-panel" @keydown.esc="emit('close')">
    <div class="search-header">
      <div class="search-input-wrapper">
        <svg class="search-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref="inputRef"
          v-model="query"
          type="text"
          class="search-input"
          placeholder="搜索文件名或内容..."
          @keydown.esc="emit('close')"
        />
        <button v-if="query" class="search-clear" @click="clearQuery">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <button class="close-btn" @click="emit('close')">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <div class="search-results">
      <!-- Loading -->
      <div v-if="loading" class="search-status">
        <span class="loading-spinner"></span>
        <span>搜索中...</span>
      </div>

      <template v-else-if="hasQuery">
        <!-- Filename matches -->
        <div v-if="filenameResults.length" class="result-group">
          <div class="group-title">文件名匹配</div>
          <div
            v-for="r in filenameResults"
            :key="r.path"
            class="result-item"
            @click="emit('select', r)"
          >
            <span class="result-name" v-html="highlightMatch(r.name, query)"></span>
            <span class="result-path">{{ relativePath(r.path) }}</span>
          </div>
        </div>

        <!-- Content matches -->
        <div v-if="contentResults.length" class="result-group">
          <div class="group-title">内容匹配</div>
          <div
            v-for="r in contentResults"
            :key="`${r.path}:${r.lineNumber}`"
            class="result-item"
            @click="emit('select', r)"
          >
            <div class="result-file-line">
              <span class="result-name">{{ r.name }}</span>
              <span class="result-line">:{{ r.lineNumber }}</span>
            </div>
            <div v-if="r.context" class="result-context" v-html="highlightMatch(r.context, query)"></div>
          </div>
        </div>

        <!-- No results -->
        <div v-if="!filenameResults.length && !contentResults.length && !loading" class="search-empty">
          无结果
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { useDebounce } from '@/composables/useDebounce'
import { tauriCommands } from '@/services/tauriCommands'
import type { SearchResult } from '@/types'

const props = defineProps<{
  visible: boolean
  rootDir: string
}>()

const emit = defineEmits<{
  close: []
  select: [result: SearchResult]
}>()

const query = ref('')
const loading = ref(false)
const results = ref<SearchResult[]>([])
const inputRef = ref<HTMLInputElement>()

const debouncedQuery = useDebounce(query, 300)

const hasQuery = computed(() => debouncedQuery.value.trim().length > 0)

const filenameResults = computed(() =>
  results.value.filter((r) => r.matchType === 'filename')
)

const contentResults = computed(() =>
  results.value.filter((r) => r.matchType === 'content')
)

watch(debouncedQuery, async (val) => {
  const trimmed = val.trim()
  if (!trimmed) {
    results.value = []
    return
  }
  if (!props.rootDir) return

  loading.value = true
  try {
    results.value = await tauriCommands.searchFiles(props.rootDir, trimmed)
  } catch {
    results.value = []
  } finally {
    loading.value = false
  }
})

// Focus input when panel becomes visible
watch(
  () => props.visible,
  (val) => {
    if (val) {
      nextTick(() => inputRef.value?.focus())
    } else {
      query.value = ''
      results.value = []
    }
  }
)

function clearQuery() {
  query.value = ''
  inputRef.value?.focus()
}

function relativePath(fullPath: string): string {
  if (!props.rootDir) return fullPath
  return fullPath.startsWith(props.rootDir)
    ? fullPath.slice(props.rootDir.length).replace(/^\//, '')
    : fullPath
}

function highlightMatch(text: string, search: string): string {
  if (!search.trim()) return escapeHtml(text)
  const escaped = escapeHtml(text)
  const searchEscaped = escapeRegex(search.trim())
  const regex = new RegExp(`(${searchEscaped})`, 'gi')
  return escaped.replace(regex, '<mark>$1</mark>')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
</script>

<style scoped>
.search-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* Header */
.search-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
}

.search-icon {
  position: absolute;
  left: 10px;
  width: 14px;
  height: 14px;
  color: var(--text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 5px 28px 5px 28px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s ease;
}

.search-input:focus {
  border-color: var(--accent);
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-clear {
  position: absolute;
  right: 6px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: 3px;
  cursor: pointer;
  padding: 0;
}

.search-clear:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

/* Results */
.search-results {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.result-group {
  padding: 4px 0;
}

.result-group + .result-group {
  border-top: 1px solid var(--border);
}

.group-title {
  padding: 6px 12px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.result-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background-color 0.1s ease;
}

.result-item:hover {
  background: var(--bg-tertiary);
}

.result-name {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 500;
  word-break: break-all;
}

.result-path {
  font-size: 11px;
  color: var(--text-muted);
  word-break: break-all;
}

.result-file-line {
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.result-line {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  flex-shrink: 0;
}

.result-context {
  font-size: 11px;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  line-height: 1.4;
  word-break: break-all;
  white-space: pre-wrap;
}

/* Highlight mark */
.result-item :deep(mark) {
  background: rgba(88, 166, 255, 0.25);
  color: var(--accent);
  border-radius: 2px;
  padding: 0 1px;
}

/* Status */
.search-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 0;
  font-size: 12px;
  color: var(--text-muted);
}

.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.search-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 0;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
