# F04-03 树搜索过滤

## 1. 功能描述与目标

实现文件树顶部的实时搜索过滤功能，帮助用户快速定位文件：

- **搜索框**：位于文件树面板顶部，带搜索图标和清除按钮
- **实时过滤**：输入时即时过滤树节点，匹配文件名和路径中的中英文
- **模糊匹配**：支持拼音前缀匹配、大小写不敏感
- **高亮匹配**：匹配到的文件名中高亮显示匹配字符
- **空状态**：无匹配结果时显示空状态提示
- **防抖**：输入防抖 200ms，避免频繁重渲染

**核心目标**：
- 250+ 文件场景下搜索响应 < 50ms
- 中文文件名和路径正确匹配
- 过滤结果保持树的层级结构（显示匹配的节点及其父级路径）

## 2. 技术实现方案

### 2.1 Vue 3 组件设计

```vue
<!-- TreeSearch.vue -->
<template>
  <div class="tree-search">
    <div class="search-input-wrapper">
      <SearchIcon class="search-icon" />
      <input
        ref="inputRef"
        v-model="searchQuery"
        type="text"
        class="search-input"
        placeholder="搜索文件..."
        @keydown.esc="clearSearch"
      />
      <button
        v-if="searchQuery"
        class="search-clear"
        @click="clearSearch"
      >
        <CloseIcon />
      </button>
    </div>
    <div v-if="searchQuery" class="search-stats">
      {{ filteredCount }} 个结果
    </div>
  </div>
</template>
```

### 2.2 CSS 布局方案

```css
/* TreeSearch.vue <style scoped> */
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
```

### 2.3 搜索过滤 Composable

```typescript
// composables/useTreeSearch.ts
import { ref, computed } from 'vue'
import { useDebounce } from './useDebounce'
import type { FileTreeNode } from '@/types/fileTree'

export interface SearchOptions {
  query: string
  caseSensitive?: boolean
}

export interface FilteredNode extends FileTreeNode {
  isMatch: boolean
  highlightRanges: Array<{ start: number; end: number }>
}

export function useTreeSearch(nodes: Ref<FileTreeNode[]>) {
  const rawQuery = ref('')
  const searchQuery = useDebounce(rawQuery, 200)

  const isSearching = computed(() => searchQuery.value.length > 0)

  // 构建过滤后的树，保留匹配节点的父级路径
  const filteredNodes = computed(() => {
    if (!isSearching.value) return nodes.value.map(n => ({ ...n, isMatch: true, highlightRanges: [] }))

    const query = searchQuery.value.toLowerCase()
    const result: FilteredNode[] = []

    for (const node of nodes.value) {
      const filtered = filterNode(node, query)
      if (filtered) result.push(filtered)
    }

    return result
  })

  const filteredCount = computed(() => {
    let count = 0
    const countMatches = (nodes: FilteredNode[]) => {
      for (const node of nodes) {
        if (node.isMatch) count++
        if (node.children) countMatches(node.children as FilteredNode[])
      }
    }
    countMatches(filteredNodes.value)
    return count
  })

  function filterNode(node: FileTreeNode, query: string): FilteredNode | null {
    const nameLower = node.name.toLowerCase()
    const pathLower = node.path.toLowerCase()
    const nameMatch = nameLower.includes(query)
    const pathMatch = pathLower.includes(query)
    const isMatch = nameMatch || pathMatch

    let children: FilteredNode[] | undefined

    if (node.children) {
      children = []
      for (const child of node.children) {
        const filtered = filterNode(child, query)
        if (filtered) children.push(filtered)
      }
      if (children.length === 0) children = undefined
    }

    // 保留条件：自身匹配 或 有子节点匹配
    if (!isMatch && !children?.length) return null

    const highlightRanges = isMatch
      ? findHighlightRanges(node.name, query)
      : []

    return {
      ...node,
      isMatch,
      highlightRanges,
      children
    }
  }

  function findHighlightRanges(text: string, query: string): Array<{ start: number; end: number }> {
    const ranges: Array<{ start: number; end: number }> = []
    const lowerText = text.toLowerCase()
    const lowerQuery = query.toLowerCase()
    let index = 0

    while ((index = lowerText.indexOf(lowerQuery, index)) !== -1) {
      ranges.push({ start: index, end: index + lowerQuery.length })
      index += lowerQuery.length
    }

    return ranges
  }

  function clearSearch() {
    rawQuery.value = ''
  }

  return {
    rawQuery,
    searchQuery,
    isSearching,
    filteredNodes,
    filteredCount,
    clearSearch
  }
}
```

### 2.4 防抖 Composable

```typescript
// composables/useDebounce.ts
import { ref, watch, type Ref } from 'vue'

export function useDebounce<T>(source: Ref<T>, delay: number): Ref<T> {
  const debounced = ref(source.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout>

  watch(source, (val) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      debounced.value = val
    }, delay)
  })

  return debounced
}
```

### 2.5 高亮渲染

```vue
<!-- TreeNode.vue 中搜索高亮 -->
<template>
  <span class="node-label">
    <template v-if="highlightRanges.length">
      <template v-for="(part, i) in highlightedParts" :key="i">
        <mark v-if="part.highlight" class="search-highlight">{{ part.text }}</mark>
        <template v-else>{{ part.text }}</template>
      </template>
    </template>
    <template v-else>{{ displayName }}</template>
  </span>
</template>
```

```css
.search-highlight {
  background: color-mix(in srgb, var(--accent) 25%, transparent);
  color: var(--accent);
  border-radius: 2px;
  padding: 0 1px;
}
```

## 3. 接口定义

### TreeSearch.vue Props/Emits

```typescript
interface TreeSearchProps {
  modelValue?: string
}

interface TreeSearchEmits {
  (e: 'update:modelValue', value: string): void
  (e: 'search', query: string): void
  (e: 'clear'): void
}
```

### useTreeSearch 导出

| 导出 | 类型 | 说明 |
|------|------|------|
| `rawQuery` | `Ref<string>` | 原始输入（无防抖） |
| `searchQuery` | `Ref<string>` | 防抖后的搜索词 |
| `isSearching` | `Ref<boolean>` | 是否处于搜索状态 |
| `filteredNodes` | `ComputedRef<FilteredNode[]>` | 过滤后的树节点 |
| `filteredCount` | `ComputedRef<number>` | 匹配结果数量 |
| `clearSearch()` | `() => void` | 清空搜索 |

## 4. 数据结构

```typescript
// types/treeSearch.ts
export interface FilteredNode extends FileTreeNode {
  isMatch: boolean
  highlightRanges: Array<{ start: number; end: number }>
}

export interface TreeSearchState {
  query: string
  isSearching: boolean
  filteredCount: number
  filteredNodes: FilteredNode[]
}
```

## 5. 依赖关系

| 依赖模块 | 说明 |
|---------|------|
| F04-01 文件树核心组件 | 搜索基于 fileTreeStore.rootNodes 过滤 |
| F04-02 树节点交互 | TreeNode 需要支持搜索高亮显示 |
| useDebounce.ts | 输入防抖 200ms |

## 6. 测试要点

1. **防抖**：快速输入时是否 200ms 后才触发过滤
2. **中文匹配**：搜索"指针"是否能匹配"指针基础.md"
3. **大小写不敏感**：搜索"cpp"是否能匹配"Cpp_Language"
4. **路径匹配**：搜索"01_"是否能匹配路径中包含"01_"的节点
5. **父级保留**：子节点匹配时父目录是否仍显示（即使父目录名不匹配）
6. **高亮渲染**：匹配字符是否正确以蓝色背景高亮
7. **结果计数**：搜索结果数是否正确显示
8. **清空按钮**：有输入时是否显示清空按钮，点击后是否正确清空
9. **Esc 快捷键**：按 Esc 是否清空搜索框
10. **空状态**：无匹配时是否显示"无结果"提示
11. **性能**：250+ 文件搜索过滤时间 < 50ms
