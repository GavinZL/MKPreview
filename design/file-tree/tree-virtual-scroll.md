# F04-05 虚拟滚动 [Phase 3]

## 1. 功能描述与目标

实现文件树虚拟滚动机制，应对大规模目录场景（>500 节点）下的渲染性能问题：

- **节点扁平化**：将递归树结构展开为线性列表，每项包含缩进层级和可见性信息
- **可视区域计算**：根据容器滚动位置和节点高度，仅渲染可见范围内的节点
- **占位高度**：通过未渲染节点的总高度占位，保持滚动条尺寸和位置准确
- **动态展开/折叠**：展开/折叠目录时动态更新扁平列表，回收/复用 DOM 节点
- **交互兼容**：虚拟滚动下保持键盘导航、搜索过滤、选中高亮等交互功能正常

**核心目标**：
- 1000+ 节点场景下滚动保持 60fps
- 首屏渲染节点数 < 30 个，DOM 节点总量可控
- 滚动体验与完整渲染无差异（无跳动、无白屏）

## 2. 技术实现方案

### 2.1 扁平化树数据结构

```typescript
// types/virtualTree.ts
export interface FlatTreeNode {
  id: string              // 唯一标识，使用 path
  node: FileTreeNode      // 原始节点数据
  depth: number           // 缩进层级
  visible: boolean        // 是否可见（受父级展开状态影响）
  index: number           // 在扁平列表中的索引
}

export interface VirtualScrollState {
  flatNodes: FlatTreeNode[]
  visibleNodes: FlatTreeNode[]
  startIndex: number      // 可视区域起始索引
  endIndex: number        // 可视区域结束索引
  scrollTop: number
  containerHeight: number
}
```

### 2.2 Vue 3 组件设计

```vue
<!-- VirtualFileTree.vue -->
<template>
  <div
    ref="containerRef"
    class="virtual-file-tree"
    @scroll="handleScroll"
  >
    <!-- 总高度占位 -->
    <div class="virtual-scroll-spacer" :style="{ height: `${totalHeight}px` }">
      <!-- 可视区域偏移 -->
      <div :style="{ transform: `translateY(${offsetY}px)` }">
        <VirtualTreeNode
          v-for="item in visibleItems"
          :key="item.id"
          :flat-node="item"
          @toggle="handleToggle"
          @select="handleSelect"
        />
      </div>
    </div>
  </div>
</template>
```

```vue
<!-- VirtualTreeNode.vue -->
<template>
  <div
    class="tree-node virtual-tree-node"
    :class="{ active: isActive }"
    :style="nodeStyle"
    :data-index="flatNode.index"
    @click="handleClick"
  >
    <!-- 展开箭头 -->
    <span v-if="flatNode.node.isDir" class="node-chevron" :class="{ collapsed: !isExpanded }">
      <ChevronDownIcon />
    </span>
    <span v-else class="node-spacer" />

    <!-- 图标 -->
    <span class="node-icon" :class="{ folder: flatNode.node.isDir }">
      <FolderIcon v-if="flatNode.node.isDir" />
      <FileTextIcon v-else />
    </span>

    <!-- 名称（支持搜索高亮） -->
    <span class="node-label">{{ flatNode.node.name }}</span>

    <!-- 文件数量角标 -->
    <span v-if="flatNode.node.isDir && flatNode.node.fileCount" class="node-badge">
      {{ flatNode.node.fileCount }}
    </span>
  </div>
</template>
```

### 2.3 CSS 布局方案

```css
/* VirtualFileTree.vue <style scoped> */
.virtual-file-tree {
  flex: 1;
  overflow-y: auto;
  position: relative;
  contain: layout style;   /* 性能优化：限制布局和样式计算范围 */
}

.virtual-scroll-spacer {
  position: relative;
}

.virtual-tree-node {
  height: 28px;           /* 固定高度是关键 */
  box-sizing: border-box;
}
```

### 2.4 Composable: useVirtualTree

```typescript
// composables/useVirtualTree.ts
import { ref, computed, watch, nextTick } from 'vue'
import type { FileTreeNode, FlatTreeNode } from '@/types'

const NODE_HEIGHT = 28       // 每个节点固定高度
const BUFFER_SIZE = 5        // 上下缓冲节点数

export function useVirtualTree(
  rootNodes: Ref<FileTreeNode[]>,
  expandedPaths: Ref<Set<string>>
) {
  const containerRef = ref<HTMLElement | null>(null)
  const scrollTop = ref(0)
  const containerHeight = ref(0)

  // ===== 扁平化树 =====
  const flatNodes = computed<FlatTreeNode[]>(() => {
    const result: FlatTreeNode[] = []
    let index = 0

    const flatten = (nodes: FileTreeNode[], depth: number) => {
      for (const node of nodes) {
        const isExpanded = expandedPaths.value.has(node.path)
        const hasChildren = node.isDir && node.children && node.children.length > 0

        result.push({
          id: node.path,
          node,
          depth,
          visible: true,
          index: index++
        })

        // 递归展开子节点（仅当目录展开时）
        if (hasChildren && isExpanded) {
          flatten(node.children!, depth + 1)
        }
      }
    }

    flatten(rootNodes.value, 0)
    return result
  })

  // ===== 可视区域计算 =====
  const totalHeight = computed(() => flatNodes.value.length * NODE_HEIGHT)

  const visibleRange = computed(() => {
    const start = Math.max(0, Math.floor(scrollTop.value / NODE_HEIGHT) - BUFFER_SIZE)
    const end = Math.min(
      flatNodes.value.length,
      Math.ceil((scrollTop.value + containerHeight.value) / NODE_HEIGHT) + BUFFER_SIZE
    )
    return { start, end }
  })

  const visibleItems = computed(() => {
    const { start, end } = visibleRange.value
    return flatNodes.value.slice(start, end)
  })

  const offsetY = computed(() => {
    return visibleRange.value.start * NODE_HEIGHT
  })

  // ===== 滚动处理 =====
  function handleScroll() {
    if (!containerRef.value) return
    scrollTop.value = containerRef.value.scrollTop
  }

  function updateContainerHeight() {
    if (containerRef.value) {
      containerHeight.value = containerRef.value.clientHeight
    }
  }

  // ResizeObserver 监听容器高度变化
  let resizeObserver: ResizeObserver | null = null

  function initObserver() {
    if (!containerRef.value) return
    updateContainerHeight()
    resizeObserver = new ResizeObserver(() => {
      updateContainerHeight()
    })
    resizeObserver.observe(containerRef.value)
  }

  function destroyObserver() {
    resizeObserver?.disconnect()
    resizeObserver = null
  }

  // 滚动到指定节点
  async function scrollToNode(path: string) {
    await nextTick()
    const index = flatNodes.value.findIndex(n => n.id === path)
    if (index === -1 || !containerRef.value) return

    const targetScrollTop = index * NODE_HEIGHT
    containerRef.value.scrollTo({
      top: targetScrollTop - containerHeight.value / 2 + NODE_HEIGHT / 2,
      behavior: 'smooth'
    })
  }

  // 展开路径到可见（递归展开父级）
  function ensureVisible(path: string) {
    // 从根节点递归查找路径的所有父级并展开
    // 具体实现依赖 fileTreeStore.expandPath()
  }

  return {
    containerRef,
    flatNodes,
    totalHeight,
    visibleItems,
    offsetY,
    handleScroll,
    initObserver,
    destroyObserver,
    scrollToNode,
    ensureVisible
  }
}
```

### 2.5 与搜索过滤集成

```typescript
// 搜索模式下也使用虚拟滚动
const filteredFlatNodes = computed(() => {
  if (!isSearching.value) return flatNodes.value

  // 过滤后的扁平列表（保留父级路径节点）
  const visibleSet = new Set<string>()

  for (const item of flatNodes.value) {
    if (item.node.name.toLowerCase().includes(searchQuery.value.toLowerCase())) {
      // 标记自身和所有父级为可见
      let current = item.node.path
      while (current) {
        visibleSet.add(current)
        current = getParentPath(current)
      }
    }
  }

  return flatNodes.value.filter(item => visibleSet.has(item.node.path))
})
```

### 2.6 Pinia Store 集成

```typescript
// stores/fileTreeStore.ts —— 虚拟滚动相关追加
const useVirtualScroll = ref(false)
const VIRTUAL_SCROLL_THRESHOLD = 500   // 超过 500 节点启用虚拟滚动

// 在 loadDirectory 后判断是否启用
function checkVirtualScroll() {
  const count = countAllNodes(rootNodes.value)
  useVirtualScroll.value = count > VIRTUAL_SCROLL_THRESHOLD
}

function countAllNodes(nodes: FileTreeNode[]): number {
  return nodes.reduce((sum, n) => {
    return sum + 1 + (n.children ? countAllNodes(n.children) : 0)
  }, 0)
}
```

## 3. 接口定义

### VirtualFileTree.vue Props/Emits

```typescript
interface VirtualFileTreeProps {
  nodes: FileTreeNode[]
  expandedPaths: Set<string>
  selectedPath: string
  nodeHeight?: number        // 默认 28
  bufferSize?: number        // 默认 5
}

interface VirtualFileTreeEmits {
  (e: 'toggle', path: string): void
  (e: 'select', path: string): void
  (e: 'scroll', scrollTop: number): void
}
```

### useVirtualTree 导出

| 导出 | 类型 | 说明 |
|------|------|------|
| `containerRef` | `Ref<HTMLElement \| null>` | 容器 DOM 引用 |
| `flatNodes` | `ComputedRef<FlatTreeNode[]>` | 完整扁平列表 |
| `totalHeight` | `ComputedRef<number>` | 总占位高度 |
| `visibleItems` | `ComputedRef<FlatTreeNode[]>` | 当前可视节点 |
| `offsetY` | `ComputedRef<number>` | translateY 偏移量 |
| `handleScroll()` | `() => void` | scroll 事件处理 |
| `initObserver()` | `() => void` | 初始化 ResizeObserver |
| `destroyObserver()` | `() => void` | 销毁 ResizeObserver |
| `scrollToNode(path)` | `(string) => Promise<void>` | 滚动到指定节点 |
| `ensureVisible(path)` | `(string) => void` | 确保节点在可视区域内 |

## 4. 数据结构

```typescript
// types/virtualTree.ts
export interface FlatTreeNode {
  id: string
  node: FileTreeNode
  depth: number
  visible: boolean
  index: number
}

export interface VirtualScrollConfig {
  nodeHeight: number
  bufferSize: number
  threshold: number      // 启用虚拟滚动的节点数阈值
}

export const DEFAULT_VIRTUAL_CONFIG: VirtualScrollConfig = {
  nodeHeight: 28,
  bufferSize: 5,
  threshold: 500
}
```

## 5. 依赖关系

| 依赖模块 | 说明 |
|---------|------|
| F04-01 文件树核心组件 | VirtualFileTree 替代 FileTree 作为渲染组件 |
| F04-02 树节点交互 | VirtualTreeNode 继承 TreeNode 的交互逻辑 |
| F04-03 树搜索过滤 | 搜索模式下 flatNodes 需要过滤处理 |
| F04-04 文件树实时更新 | 节点增删时扁平列表需要重新计算 |

## 6. 测试要点

1. **节点数阈值**：501 个节点时是否自动启用虚拟滚动，499 个时是否使用普通渲染
2. **滚动流畅性**：快速滚动 1000 节点树时是否保持 60fps
3. **DOM 数量**：可视区域内 DOM 节点数是否约为 (容器高度 / 28 + 10) 个
4. **总高度**：未滚动到底部时滚动条长度是否正确反映总节点数
5. **展开/折叠**：展开深层目录后滚动条长度是否正确变化
6. **选中可见**：选中不在可视区的节点时是否自动滚动到视野内
7. **键盘导航**：按上下箭头时是否平滑滚动并高亮对应节点
8. **搜索过滤**：搜索模式下虚拟滚动是否正确工作，匹配数少时滚动条是否正确
9. **实时更新**：外部创建/删除节点后虚拟列表是否正确更新
10. **性能基准**：1000 节点树首屏渲染时间 < 50ms
11. **内存占用**：大量滚动后内存是否稳定，无 DOM 节点泄漏
12. **Resize**：调整 Sidebar 宽度后容器高度变化，可视区域是否重新计算
