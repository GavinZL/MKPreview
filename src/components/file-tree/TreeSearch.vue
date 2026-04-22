<template>
  <div class="tree-search">
    <div class="search-input-wrapper">
      <svg class="search-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        ref="inputRef"
        v-model="searchInput"
        type="text"
        class="search-input"
        placeholder="搜索文件..."
        @keydown.esc="clearSearch"
      />
      <button
        v-if="searchInput"
        class="search-clear"
        @click="clearSearch"
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div v-if="searchInput" class="search-stats">
      {{ filteredCount }} 个结果
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useFileTreeStore } from '@/stores/fileTreeStore'
import { useDebounce } from '@/composables/useDebounce'
import type { FileTreeNode } from '@/types'

const fileTreeStore = useFileTreeStore()
const inputRef = ref<HTMLInputElement>()
const searchInput = ref('')
const debouncedInput = useDebounce(searchInput, 200)

watch(debouncedInput, (val) => {
  fileTreeStore.setSearchKeyword(val)
})

function clearSearch() {
  searchInput.value = ''
  fileTreeStore.setSearchKeyword('')
  inputRef.value?.focus()
}

function countFileNodes(nodes: FileTreeNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (!node.isDir) {
      count++
    }
    if (node.children) {
      count += countFileNodes(node.children)
    }
  }
  return count
}

const filteredCount = computed(() => countFileNodes(fileTreeStore.filteredRootNodes))
</script>

<style scoped>
.tree-search {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
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

.search-clear svg {
  width: 12px;
  height: 12px;
}

.search-stats {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-muted);
}
</style>
