# F04-04 文件树实时更新

## 1. 功能描述与目标

实现文件树的实时更新能力，监听外部文件系统变更并自动同步到 UI：

- **监听事件**：文件创建、删除、修改、重命名
- **创建处理**：新 .md 文件或新目录自动添加到对应位置
- **删除处理**：文件或目录从树中移除
- **重命名处理**：更新节点名称和路径，保持子树结构
- **修改处理**：文件内容变更时，若该文件已在标签页中打开且无本地编辑，自动刷新内容
- **防抖合并**：多次快速变更 300ms 防抖合并为单次更新
- **忽略规则**：忽略 `.git`、`node_modules`、`.DS_Store` 等非 Markdown 路径

**核心目标**：
- 外部文件操作后 300ms 内 UI 同步完成
- 保持用户当前的展开状态和选中状态不变
- 不阻塞主线程，更新过程流畅无卡顿

## 2. 技术实现方案

### 2.1 事件监听封装

```typescript
// services/tauriEvents.ts
import { listen } from '@tauri-apps/api/event'

export interface FsChangeEvent {
  type: 'create' | 'delete' | 'modify' | 'rename'
  path: string
  oldPath?: string    // rename 时使用
}

export function onFsChange(callback: (event: FsChangeEvent) => void) {
  return listen<FsChangeEvent>('fs:change', (event) => {
    callback(event.payload)
  })
}

export function onFsError(callback: (message: string) => void) {
  return listen<{ message: string }>('fs:error', (event) => {
    callback(event.payload.message)
  })
}
```

### 2.2 Store 中的实时更新逻辑

```typescript
// stores/fileTreeStore.ts —— 追加内容
import { onFsChange } from '@/services/tauriEvents'
import { useDebounceFn } from '@/composables/useDebounce'

// 在 store 初始化时监听
let unlistenFsChange: (() => void) | null = null

// 待处理的变更队列
const pendingChanges = ref<FsChangeEvent[]>([])

// 防抖处理队列
const processChanges = useDebounceFn(() => {
  const changes = [...pendingChanges.value]
  pendingChanges.value = []

  for (const change of changes) {
    handleFsChange(change)
  }
}, 300)

export function startWatching() {
  if (unlistenFsChange) return

  unlistenFsChange = onFsChange((event) => {
    // 忽略非 .md 和非目录变更
    if (!shouldProcessPath(event.path)) return

    pendingChanges.value.push(event)
    processChanges()
  })
}

export function stopWatching() {
  unlistenFsChange?.()
  unlistenFsChange = null
}

function shouldProcessPath(path: string): boolean {
  const ignored = ['.git', 'node_modules', '.DS_Store', '__pycache__']
  return !ignored.some(name => path.includes(`/${name}/`) || path.endsWith(`/${name}`))
}

function handleFsChange(event: FsChangeEvent) {
  switch (event.type) {
    case 'create':
      handleCreate(event.path)
      break
    case 'delete':
      handleDelete(event.path)
      break
    case 'rename':
      handleRename(event.oldPath!, event.path)
      break
    case 'modify':
      handleModify(event.path)
      break
  }
}
```

### 2.3 各类变更处理函数

```typescript
// stores/fileTreeStore.ts —— 追加 handlers

function handleCreate(path: string) {
  const parentPath = getParentPath(path)
  const parentNode = findNodeByPath(rootNodes.value, parentPath)

  if (!parentNode) {
    // 如果父节点不在树中，可能是新的根级目录，重新扫描
    if (!parentPath || parentPath === rootPath.value) {
      reloadDirectory()
    }
    return
  }

  // 异步获取新节点信息
  getFileMeta(path).then(meta => {
    const newNode: FileTreeNode = {
      name: getFileName(path),
      path,
      isDir: meta.isDir,
      children: meta.isDir ? [] : undefined,
      fileCount: meta.isDir ? 0 : undefined
    }

    if (!parentNode.children) parentNode.children = []
    parentNode.children.push(newNode)
    parentNode.children = sortNodes(parentNode.children)

    // 更新父级 fileCount
    updateFileCount(parentNode)
  })
}

function handleDelete(path: string) {
  const parentPath = getParentPath(path)
  const parentNode = findNodeByPath(rootNodes.value, parentPath)

  if (!parentNode || !parentNode.children) return

  const index = parentNode.children.findIndex(n => n.path === path)
  if (index !== -1) {
    // 如果删除的是当前选中节点，清除选中
    if (selectedPath.value === path) {
      selectedPath.value = ''
    }
    // 从展开状态中移除
    expandedPaths.value.delete(path)

    parentNode.children.splice(index, 1)
    updateFileCount(parentNode)
  }
}

function handleRename(oldPath: string, newPath: string) {
  const node = findNodeByPath(rootNodes.value, oldPath)
  if (!node) return

  // 更新自身
  node.name = getFileName(newPath)
  node.path = newPath

  // 递归更新所有子节点的路径前缀
  if (node.children) {
    updateChildPaths(node.children, oldPath, newPath)
  }

  // 更新选中路径
  if (selectedPath.value === oldPath) {
    selectedPath.value = newPath
  }

  // 更新展开状态
  if (expandedPaths.value.has(oldPath)) {
    expandedPaths.value.delete(oldPath)
    expandedPaths.value.add(newPath)
  }
}

function updateChildPaths(children: FileTreeNode[], oldPrefix: string, newPrefix: string) {
  for (const child of children) {
    child.path = child.path.replace(oldPrefix, newPrefix)
    if (child.children) {
      updateChildPaths(child.children, oldPrefix, newPrefix)
    }
  }
}

function handleModify(path: string) {
  // 通知 tabStore 刷新已打开的文件内容
  const tabStore = useTabStore()
  tabStore.refreshFileIfOpen(path)
}

function updateFileCount(node: FileTreeNode) {
  if (!node.isDir || !node.children) return

  let count = 0
  const countFiles = (nodes: FileTreeNode[]) => {
    for (const n of nodes) {
      if (n.isDir && n.children) {
        countFiles(n.children)
      } else {
        count++
      }
    }
  }
  countFiles(node.children)
  node.fileCount = count

  // 递归更新父级
  const parent = findParentNode(rootNodes.value, node.path)
  if (parent) updateFileCount(parent)
}
```

### 2.4 工具函数

```typescript
// lib/pathUtils.ts
export function getParentPath(path: string): string {
  const lastSep = path.lastIndexOf('/')
  return lastSep > 0 ? path.slice(0, lastSep) : ''
}

export function getFileName(path: string): string {
  const lastSep = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return lastSep >= 0 ? path.slice(lastSep + 1) : path
}

export function findParentNode(nodes: FileTreeNode[], childPath: string): FileTreeNode | null {
  const parentPath = getParentPath(childPath)
  return findNodeByPath(nodes, parentPath)
}
```

## 3. 接口定义

### fileTreeStore 追加 Actions

```typescript
interface FileTreeStoreActions {
  startWatching(): void      // 启动文件系统监听
  stopWatching(): void       // 停止监听
  reloadDirectory(): Promise<void>  // 重新扫描当前目录
}
```

### tauriEvents 导出

| 导出 | 类型 | 说明 |
|------|------|------|
| `onFsChange(callback)` | `(FsChangeEvent => void) => UnlistenFn` | 监听文件变更 |
| `onFsError(callback)` | `(string => void) => UnlistenFn` | 监听文件错误 |

## 4. 数据结构

```typescript
// types/fileTree.ts —— 追加
export type FsChangeType = 'create' | 'delete' | 'modify' | 'rename'

export interface FsChangeEvent {
  type: FsChangeType
  path: string
  oldPath?: string
}

export interface FileMeta {
  path: string
  isDir: boolean
  size: number
  modified: number
}
```

## 5. 依赖关系

| 依赖模块 | 说明 |
|---------|------|
| F02-03 文件系统监控 | Rust 后端 notify crate 发送 fs:change 事件 |
| F04-01 文件树核心组件 | 基于 fileTreeStore 的树结构进行增删改 |
| F05-02 多标签页管理 | handleModify 通知 tabStore 刷新文件内容 |
| F02-02 文件读写命令 | getFileMeta 调用 Rust `get_file_meta` |
| useDebounce.ts | 300ms 防抖合并多次变更 |

## 6. 测试要点

1. **创建文件**：外部创建 .md 文件后 300ms 内树中是否出现新节点
2. **创建目录**：外部创建目录后是否正确显示为可展开文件夹
3. **删除文件**：外部删除 .md 文件后节点是否移除，选中状态是否清除
4. **删除目录**：外部删除目录后整棵子树是否移除
5. **重命名**：外部重命名文件后节点名和路径是否正确更新
6. **重命名目录**：重命名目录后所有子节点路径是否正确更新
7. **修改内容**：外部修改已打开文件后内容是否自动刷新
8. **未保存不刷新**：本地有未保存修改时，外部修改是否弹出冲突提示
9. **防抖**：1 秒内连续创建 5 个文件，是否合并为单次更新
10. **忽略规则**：.git/node_modules 内变更是否被忽略
11. **fileCount 更新**：增删文件后父目录角标数是否正确更新
12. **展开状态保持**：更新过程中用户的展开/折叠状态是否保持不变
