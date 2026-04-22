# F01-04 数据流架构 (Data Flow Architecture)

> 模块：scaffold | 优先级：P0-MVP | 类型：架构文档

## 1. 功能描述与目标

定义 MKPreview 应用中所有数据流动的路径和模式，确保前后端通信、状态管理、事件处理的一致性。

**核心目标**：
- 统一三层架构（Vue 组件层 → Pinia Store 层 → Tauri IPC → Rust 后端）的数据流转规范
- 明确每个核心用户场景的数据流路径，消除状态管理中的灰色地带
- 对齐各模块文档中的 IPC 接口定义，确保前后端契约一致
- 规范事件监听的生命周期，防止内存泄漏和事件重复注册

**关联需求**：FR-001 ~ FR-008、NFR-001 ~ NFR-006

---

## 2. 技术实现方案

### 2.1 三层架构数据流总览

```
用户交互 → Vue 组件 → Pinia Store → Tauri IPC (invoke) → Rust Command → 文件系统
                                                                              ↓
UI 刷新 ← Vue 响应式 ← Store 更新 ← Tauri Event (listen) ← Rust Event emit ←┘
```

**三层职责划分**：

| 层 | 职责 | 关键模块 |
|---|---|---|
| **Vue 组件层** | 渲染 UI、捕获用户交互、触发 Store Action | FileTree、Toolbar、MarkdownPreview、SourceEditor |
| **Pinia Store 层** | 持有应用状态、执行业务逻辑、发起 IPC 调用 | fileTreeStore、tabStore、uiStore、settingsStore |
| **Tauri IPC 层** | 前后端通信桥梁：invoke 请求 / event 推送 | `tauriCommands.ts`、`tauriEvents.ts` |
| **Rust 后端层** | 文件系统操作、目录监控、配置持久化 | `commands/`、`services/`、`models/` |

---

### 2.2 核心数据流场景（逐一详细描述）

对每个场景给出完整的数据流路径：**组件 → Store → IPC → Rust → 返回 → Store → UI**

#### 场景 1：打开目录

```
用户点击工具栏「打开目录」按钮
    │
    ▼
Toolbar.vue ──────────────────────────────────────────────────────────────►
    │                                                                      │
    ▼                                                                      │
fileTreeStore.loadDirectory()                                            │
    │  ├─ 调用 @tauri-apps/plugin-dialog open() 获取目录路径              │
    │  └─ 或接收拖拽目录路径（tree-interaction.md 2.4）                  │
    │                                                                      │
    ▼                                                                      │
tauriCommands.ts: scanDirectory(path) ───────────────────────────────────►
    │                                                                      │
    ▼                                                                      │
Rust: #[tauri::command] scan_directory()                                 │
    │  ├─ services/dir_scanner.rs 递归遍历目录                           │
    │  ├─ 过滤：仅保留 .md 文件 + 含 .md 的目录                         │
    │  ├─ 自然排序（数字前缀感知）                                        │
    │  └─ 计算每个目录的 fileCount                                        │
    │                                                                      │
    ▼                                                                      │
返回 Vec<FileTreeNode> (JSON)                                            │
    │                                                                      │
    ▼                                                                      │
fileTreeStore.rootNodes = tree                                           │
fileTreeStore.rootPath = targetPath                                      │
默认展开第一层目录（expandedPaths 填充）                                 │
    │                                                                      │
    ▼                                                                      │
Vue 响应式：FileTree.vue / TreeNode.vue 递归渲染 ────────────────────────►
    │                                                                      │
    ▼                                                                      │
调用 tauriCommands.ts: startWatching(rootPath) ──────────────────────────►
    │                                                                      │
    ▼                                                                      │
Rust: #[tauri::command] start_watching() 启动 notify 监控              │
```

**关键数据**：`FileTreeNode[]`（tree-core.md §4、dir-scanner.md §4）

**错误路径**：`InvalidPath` / `PathNotInScope` / `IoError` → 前端提示用户

---

#### 场景 2：选择文件

```
用户点击文件树中的 .md 文件节点
    │
    ▼
TreeNode.vue @click="handleClick"
    │  ├─ fileTreeStore.selectNode(path)     // 更新选中状态
    │  └─ tabStore.openFile(path, name)      // 打开文件
    │
    ▼
tabStore.openFile(path, name)
    │  ├─ isLoading = true
    │  ├─ 保存当前滚动位置（Phase 2 扩展）
    │  └─ tauriCommands.ts: readFile(path)
    │
    ▼
Rust: #[tauri::command] read_file(path)
    │  ├─ 路径校验 + Scope 校验
    │  ├─ UTF-8 读取（大文件一次性读入）
    │  └─ 返回 String
    │
    ▼
tabStore.currentContent = content
tabStore.activeFile = { path, name }
tabStore.isLoading = false
    │
    ▼
Vue 响应式：根据 settingsStore.displayMode 条件渲染
    │
    ├──► Preview 模式 ──► MarkdownPreview.vue
    │                       :content="tabStore.currentContent"
    │                       :filePath="tabStore.activeFile.path"
    │                       └──► 四阶段渲染管线（preview-component.md §2.2）
    │
    └──► Source 模式 ───► SourceEditor.vue
                            :content="tabStore.currentContent"
                            └──► CodeMirror 6 实例 setContent()
```

**关键数据**：`string`（原始 Markdown 文本）

**性能约束**：普通文件 < 100ms，大文件（5000+ 行）< 500ms（single-file-view.md §6.4）

---

#### 场景 3：文件外部变更

```
外部程序修改已监控目录中的 .md 文件
    │
    ▼
Rust notify watcher 检测变更
    │  ├─ notify_debouncer_full 300ms 防抖合并
    │  ├─ 事件过滤（仅 .md / 忽略 .git / 忽略隐藏文件）
    │  └─ 转换为 FsChangeEvent
    │
    ▼
Rust: app_handle.emit("fs:change", FsChangeEvent)
    │
    ▼
前端 tauriEvents.ts: listen("fs:change")
    │  ├─ unlisten 句柄在组件卸载时注销
    │  └─ 回调分发到 fileTreeStore.handleFsChange()
    │
    ▼
fileTreeStore.handleFsChange(event)
    │
    ├──► changeType = "created" ──► handleCreate(path)
    │                                 ├─ 查找父节点
    │                                 ├─ getFileMeta(path) 获取元信息
    │                                 ├─ 插入新节点并排序
    │                                 └─ updateFileCount(父节点)
    │
    ├──► changeType = "deleted" ──► handleDelete(path)
    │                                 ├─ 从父节点 children 中移除
    │                                 ├─ 清除选中状态（如被选中）
    │                                 └─ updateFileCount(父节点)
    │
    ├──► changeType = "renamed" ──► handleRename(oldPath, newPath)
    │                                 ├─ 更新节点 name / path
    │                                 ├─ 递归更新子节点路径前缀
    │                                 └─ 同步 expandedPaths / selectedPath
    │
    └──► changeType = "modified" ──► handleModify(path)
                                      ├─ 检查该文件是否为当前打开文件
                                      ├─ 检查是否有未保存本地修改
                                      │     ├─ 无 ──► tabStore.refreshFileIfOpen(path)
                                      │     │           └─ 重新 read_file → 更新 currentContent
                                      │     └─ 有 ──► 弹出冲突对话框（Phase 2）
                                      └─ 触发 MarkdownPreview 重新渲染
```

**关键数据**：`FsChangeEvent`（file-watcher.md §4、tree-live-update.md §4）

**防抖策略**：Rust 层 300ms debounce + 前端层 300ms debounce 双保险

---

#### 场景 4：主题切换

```
用户点击工具栏主题按钮（或 Cmd/Ctrl+Shift+T）
    │
    ▼
Toolbar.vue @click / useKeyboard.ts 快捷键回调
    │
    ▼
useTheme.ts: toggleTheme()
    │
    ▼
settingsStore.setTheme(preference)        // 更新 Pinia 状态
    │
    ▼
document.documentElement.setAttribute('data-theme', resolvedTheme)
    │  ├─ CSS 变量即时生效（300ms 渐变过渡）
    │  └─ 触发 mkpreview:themechange 自定义事件
    │
    ▼
Vue 响应式：所有使用 var(--*) 的组件自动更新
    │
    ├──► SourceEditor.vue 监听 mkpreview:themechange
    │      └─ CodeMirror.setTheme(isDark)  // 重建编辑器实例
    │
    └──► MarkdownPreview.vue 组件
           └─ highlight.js / Mermaid 主题跟随（Phase 2）
    │
    ▼
settingsStore watch ──► debounce ──► tauriCommands.ts: saveSettings()
    │                                      // 持久化到 settings.json
    ▼
Rust: #[tauri::command] save_settings(settings)
    └─ 原子写入应用数据目录 settings.json
```

**关键数据**：`ThemePreference = 'system' | 'light' | 'dark'`（theme-toggle.md §4、config-store.md §4）

---

#### 场景 5：配置保存

```
settingsStore 任意配置字段变更
    │
    ▼
settingsStore 内部 watch（或 composable 层监听）
    │
    ▼
debounce(500ms) 防抖                          // 避免频繁写入
    │
    ▼
tauriCommands.ts: saveSettings(settings)
    │
    ▼
Rust: #[tauri::command] save_settings(settings)
    │  ├─ 校验 Settings 结构合法性
    │  ├─ 获取 app_data_dir()
    │  ├─ 序列化为带缩进的 JSON
    │  ├─ 原子写入：settings.json.tmp → rename → settings.json
    │  └─ 返回 Ok(())
    │
    ▼
前端：无需更新 UI（配置已在前端生效）
```

**关键数据**：`Settings` 结构（config-store.md §4）

**持久化字段**：theme、fontSize、recentDirectories、lastDirectory、treeExpandedState、windowState、sidebarWidth、showLineNumbers、autoSave、autoSaveInterval

---

#### 场景 6：显示模式切换

```
用户点击工具栏 Preview / Source / Split 按钮（或 Cmd/Ctrl+1/2/3）
    │
    ▼
Toolbar.vue 模式按钮组 @click / useKeyboard.ts 快捷键
    │
    ▼
settingsStore.setDisplayMode(mode)
    │  ├─ MVP 阶段：仅支持 'preview' / 'source'
    │  └─ Phase 2 启用 'split'
    │
    ▼
Vue 响应式：ModeSwitch.vue / ContentArea.vue 条件渲染
    │
    ├──► mode = 'preview' ──► <MarkdownPreview :content="currentContent" />
    │
    ├──► mode = 'source' ───► <SourceEditor :content="currentContent" />
    │
    └──► mode = 'split' ───► <SplitView>
                              ├─ 左侧：<SourceEditor />
                              └─ 右侧：<MarkdownPreview />
    │
    ▼
模式切换时滚动位置保持（mode-switch.md §2.6）
    ├─ Preview → Source：预览滚动百分比 → 映射到源码行号
    └─ Source → Preview：源码行号百分比 → 映射到预览像素位置
```

**关键数据**：`DisplayMode = 'preview' | 'source' | 'split'`（mode-switch.md §4）

---

#### 场景 7：搜索文件树

```
用户在文件树搜索框输入关键词
    │
    ▼
TreeSearch.vue @input
    │
    ▼
fileTreeStore.setSearchKeyword(keyword)
    │  ├─ searchKeyword = keyword
    │  └─ 触发展开所有目录（确保过滤结果可见）
    │
    ▼
Vue computed: filteredRootNodes
    │  ├─ 递归遍历 rootNodes
    │  ├─ 模糊匹配文件名（中英文支持）
    │  └─ 父目录匹配时保留其子树
    │
    ▼
Vue 响应式：TreeNode.vue 重新渲染
    │  ├─ 匹配节点：正常显示
    │  └─ 不匹配节点：display: none 或从 children 中过滤
```

**注意**：文件树搜索为纯前端过滤，不涉及 IPC 调用。全局全文搜索（Phase 2）将调用 `search_files` Command。

---

### 2.3 Pinia Store 全景图

| Store | 职责 | 核心 State | 依赖的 Store / Service |
|-------|------|-----------|----------------------|
| **fileTreeStore** | 文件树状态：目录结构、展开/折叠、选中节点、搜索过滤 | `rootPath`, `rootNodes`, `expandedPaths`, `selectedPath`, `searchKeyword`, `isLoading` | 依赖 `tauriCommands.ts`（scanDirectory, startWatching, getFileMeta）；被 `tabStore`、`uiStore` 间接引用 |
| **tabStore** | 当前打开文件/标签：活动文件、内容、加载状态 | `activeFile`, `currentContent`, `isLoading`, `scrollPosition` | 依赖 `tauriCommands.ts`（readFile）；被 `settingsStore` 间接引用（通过组件层） |
| **uiStore** | UI 布局状态：侧边栏宽度、分屏比例 | `sidebarWidth`, `sidebarCollapsed`, `splitRatio` | 无 IPC 依赖；被 AppLayout、GridResizer 使用 |
| **settingsStore** | 用户配置：主题、显示模式、字体等 | `theme`, `displayMode`, `fontSize`, `sidebarWidth` 等 | 依赖 `tauriCommands.ts`（getSettings, saveSettings）；被几乎所有组件引用 |

**Store 引用关系图**：

```
settingsStore ◄────── 所有组件 + 其他 Store
      │
      ├─ theme ──────► useTheme.ts ──────► DOM data-theme
      ├─ displayMode ─► ModeSwitch.vue ──► 条件渲染
      └─ sidebarWidth ─► uiStore（可选同步）

fileTreeStore ◄────── FileTree.vue / TreeNode.vue
      │
      ├─ 调用 scanDirectory() ──► Rust
      ├─ 监听 fs:change ───────► 自动更新树
      └─ selectNode() ─────────► tabStore.openFile()

tabStore ◄────────── SingleFileView.vue / MarkdownPreview.vue / SourceEditor.vue
      │
      ├─ openFile() ───────────► read_file() ──► Rust
      └─ currentContent ───────► 渲染管线输入

uiStore ◄─────────── AppLayout.vue / GridResizer.vue
      │
      └─ sidebarWidth ─────────► CSS Grid 布局
```

---

### 2.4 Tauri IPC 完整清单

#### Commands（前端 invoke → Rust 处理）

| Command 名 | 参数 | 返回 | 来源模块 |
|---|---|---|---|
| `scan_directory` | `path: string` | `FileTreeNode[]` | F02-01 dir-scanner.md §3.1 |
| `read_file` | `path: string` | `string` | F02-02 file-readwrite.md §3.1 |
| `write_file` | `path: string, content: string` | `()` | F02-02 file-readwrite.md §3.1 (Phase 2) |
| `get_file_meta` | `path: string` | `FileMeta` | F02-02 file-readwrite.md §3.1 |
| `start_watching` | `path: string` | `()` | F02-03 file-watcher.md §3.1 |
| `stop_watching` | `()` | `()` | F02-03 file-watcher.md §3.1 |
| `search_files` | `dir: string, query: string` | `SearchResult[]` | PRD §5.3 (Phase 2) |
| `open_directory_dialog` | `()` | `Option<string>` | PRD §5.3（通过 dialog plugin） |
| `get_settings` | `()` | `Settings` | F02-05 config-store.md §3.1 |
| `save_settings` | `settings: Settings` | `()` | F02-05 config-store.md §3.1 |

#### Events（Rust emit → 前端 listen）

| Event 名 | payload 类型 | 来源模块 |
|---|---|---|
| `fs:change` | `FsChangeEvent { changeType, path, oldPath?, isDir }` | F02-03 file-watcher.md §3.2 |
| `fs:error` | `FsErrorEvent { message, timestamp }` | F02-03 file-watcher.md §3.2 |

---

### 2.5 数据流规范

#### IPC 调用的统一封装方式

所有 `invoke` 调用必须封装在 `src/services/tauriCommands.ts` 中，禁止组件直接调用 `invoke`：

```typescript
// src/services/tauriCommands.ts
import { invoke } from '@tauri-apps/api/core'
import type { FileTreeNode, FileMeta, Settings, FsChangeEvent } from '@/types'

export const tauriCommands = {
  scanDirectory: (path: string): Promise<FileTreeNode[]> =>
    invoke('scan_directory', { path }),

  readFile: (path: string): Promise<string> =>
    invoke('read_file', { path }),

  writeFile: (path: string, content: string): Promise<void> =>
    invoke('write_file', { path, content }),

  getFileMeta: (path: string): Promise<FileMeta> =>
    invoke('get_file_meta', { path }),

  startWatching: (path: string): Promise<void> =>
    invoke('start_watching', { path }),

  stopWatching: (): Promise<void> =>
    invoke('stop_watching'),

  getSettings: (): Promise<Settings> =>
    invoke('get_settings'),

  saveSettings: (settings: Settings): Promise<void> =>
    invoke('save_settings', { settings }),
}
```

#### 错误传播路径

```
Rust 错误枚举
    │
    ├──► 序列化为 String（Tauri 自动转换）
    │
    ▼
前端 invoke 返回 rejected Promise
    │
    ▼
tauriCommands.ts 可选包装为 typed error
    │
    ▼
Store Action 中 try/catch 捕获
    │
    ├──► 设置 error state（如 fileTreeStore.loadError）
    ├──► 控制台输出详细错误信息
    └──► UI 层通过 toast / 状态栏提示用户
```

Rust 各模块的错误类型（映射到前端为字符串）：
- `DirScannerError` → `InvalidPath` / `PathNotInScope` / `IoError` / `NotADirectory`
- `FileServiceError` → `InvalidPath` / `PathNotInScope` / `NotAMarkdownFile` / `FileNotFound` / `ReadError` / `WriteError` / `PermissionDenied` / `FileTooLarge`
- `ConfigError` → `IoError` / `SerializeError` / `DeserializeError` / `InvalidSettings` / `DirNotFound`

#### 事件监听的注册/注销时机

| 事件 | 注册时机 | 注销时机 | 负责模块 |
|------|---------|---------|---------|
| `fs:change` | fileTreeStore.loadDirectory() 成功后 | 加载新目录前 / 应用关闭 | `tree-live-update.md` §2.2 |
| `fs:error` | fileTreeStore 初始化时 | 应用关闭 | `tauriEvents.ts` |
| `mkpreview:themechange` | SourceEditor.vue onMounted | SourceEditor.vue onUnmounted | `theme-toggle.md` §2.5 |

**规范**：所有 `listen()` 返回的 `unlisten` 函数必须在组件卸载或对应作用域销毁时调用，防止事件重复监听和内存泄漏。

---

## 3. 接口定义

### 3.1 IPC Command 接口（Rust ↔ Frontend）

```rust
// Rust 端签名汇总
#[tauri::command]
pub async fn scan_directory(path: String) -> Result<Vec<FileTreeNode>, DirScannerError>;

#[tauri::command]
pub async fn read_file(path: String) -> Result<String, FileServiceError>;

#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), FileServiceError>;

#[tauri::command]
pub async fn get_file_meta(path: String) -> Result<FileMeta, FileServiceError>;

#[tauri::command]
pub async fn start_watching(path: String) -> Result<(), WatcherError>;

#[tauri::command]
pub async fn stop_watching() -> Result<(), WatcherError>;

#[tauri::command]
pub async fn get_settings() -> Result<Settings, ConfigError>;

#[tauri::command]
pub async fn save_settings(settings: Settings) -> Result<(), ConfigError>;
```

```typescript
// 前端封装接口（tauriCommands.ts）
interface TauriCommands {
  scanDirectory(path: string): Promise<FileTreeNode[]>
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  getFileMeta(path: string): Promise<FileMeta>
  startWatching(path: string): Promise<void>
  stopWatching(): Promise<void>
  getSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<void>
}
```

### 3.2 IPC Event 接口（Rust → Frontend）

```rust
// Rust 端 emit
app_handle.emit("fs:change", FsChangeEvent { change_type, path, old_path, is_dir });
app_handle.emit("fs:error", FsErrorEvent { message, timestamp });
```

```typescript
// 前端监听封装（tauriEvents.ts）
interface TauriEvents {
  onFsChange(callback: (event: FsChangeEvent) => void): Promise<UnlistenFn>
  onFsError(callback: (message: string) => void): Promise<UnlistenFn>
}
```

---

## 4. 数据结构

### 4.1 跨模块共享数据结构汇总表

| 结构名 | 定义位置 | 传输方向 | 说明 |
|--------|---------|---------|------|
| **FileTreeNode** | `types/fileTree.ts` | Rust → Frontend | 文件树节点：name, path, isDir, children?, fileCount? |
| **FileMeta** | `types/fileTree.ts` | Rust ↔ Frontend | 文件元信息：path, size, modified, created |
| **FileTab** | `types/tab.ts` | Frontend 内部 | MVP 单文件标签：path, name |
| **FsChangeEvent** | `types/fileTree.ts` | Rust → Frontend | 文件变更：changeType, path, oldPath?, isDir |
| **FsErrorEvent** | `types/fileTree.ts` | Rust → Frontend | 监控错误：message, timestamp |
| **Settings** | `types/settings.ts` | Rust ↔ Frontend | 用户配置：theme, fontSize, recentDirectories 等 |
| **ThemePreference** | `types/settings.ts` | Frontend 内部 | `'system' \| 'light' \| 'dark'` |
| **DisplayMode** | `types/settings.ts` | Frontend 内部 | `'preview' \| 'source' \| 'split'` |
| **TocHeading** | `types/markdown.ts` | Frontend 内部 | TOC 数据：level, text, id, offsetTop |
| **SearchResult** | `types/search.ts` | Rust → Frontend (P2) | 搜索结果：path, lineNumber, context |

### 4.2 完整 TypeScript 接口定义

```typescript
// types/fileTree.ts
export interface FileTreeNode {
  name: string
  path: string
  isDir: boolean
  children?: FileTreeNode[]
  fileCount?: number
}

export interface FileMeta {
  path: string
  size: number
  modified: number
  created: number
}

export type FsChangeType = 'created' | 'modified' | 'deleted' | 'renamed'

export interface FsChangeEvent {
  changeType: FsChangeType
  path: string
  oldPath?: string
  isDir: boolean
}

export interface FsErrorEvent {
  message: string
  timestamp: number
}
```

```typescript
// types/settings.ts
export type ThemePreference = 'system' | 'light' | 'dark'
export type DisplayMode = 'preview' | 'source' | 'split'

export interface WindowState {
  width: number
  height: number
  x: number
  y: number
  maximized: boolean
}

export interface Settings {
  theme: ThemePreference
  fontSize: number
  codeFontSize: number
  recentDirectories: string[]
  lastDirectory: string | null
  treeExpandedState: Record<string, boolean>
  windowState: WindowState
  sidebarWidth: number
  showLineNumbers: boolean
  autoSave: boolean
  autoSaveInterval: number
}
```

```typescript
// types/tab.ts
export interface FileTab {
  path: string
  name: string
}
```

```typescript
// types/markdown.ts
export interface TocHeading {
  level: number
  text: string
  id: string
  offsetTop: number
}
```

### 4.3 Rust ↔ TypeScript 字段映射

| Rust 字段 | TypeScript 字段 | Serde 配置 |
|-----------|----------------|-----------|
| `is_dir` | `isDir` | `rename_all = "camelCase"` |
| `file_count` | `fileCount` | `rename_all = "camelCase"` |
| `change_type` | `changeType` | `rename_all = "camelCase"` |
| `old_path` | `oldPath` | `rename_all = "camelCase"` |
| `font_size` | `fontSize` | `rename_all = "camelCase"` |
| `recent_directories` | `recentDirectories` | `rename_all = "camelCase"` |
| `tree_expanded_state` | `treeExpandedState` | `rename_all = "camelCase"` |
| `window_state` | `windowState` | `rename_all = "camelCase"` |
| `sidebar_width` | `sidebarWidth` | `rename_all = "camelCase"` |
| `show_line_numbers` | `showLineNumbers` | `rename_all = "camelCase"` |
| `auto_save_interval` | `autoSaveInterval` | `rename_all = "camelCase"` |
| `ThemePreference::System` | `"system"` | `rename_all = "lowercase"` |

---

## 5. 依赖关系

### 5.1 前端服务层依赖

```
src/services/
├── tauriCommands.ts          # 封装所有 invoke 调用
│   ├── 依赖 @tauri-apps/api/core
│   └── 被所有 Store 引用
│
└── tauriEvents.ts            # 封装所有 event 监听
    ├── 依赖 @tauri-apps/api/event
    └── 被 fileTreeStore 引用
```

### 5.2 Store 层依赖

```
stores/
├── fileTreeStore.ts          # 依赖 tauriCommands, tauriEvents, naturalSort
├── tabStore.ts               # 依赖 tauriCommands (readFile)
├── uiStore.ts                # 无 IPC 依赖
└── settingsStore.ts          # 依赖 tauriCommands (getSettings, saveSettings)
```

### 5.3 Rust 后端模块依赖

```
src-tauri/src/
├── commands/
│   ├── file_system.rs        # scan_directory, read_file, write_file, get_file_meta
│   ├── watcher.rs            # start_watching, stop_watching
│   └── settings.rs           # get_settings, save_settings
│
├── services/
│   ├── dir_scanner.rs        # 被 file_system.rs 调用
│   ├── file_watcher.rs       # 被 watcher.rs 调用
│   └── config_store.rs       # 被 settings.rs 调用
│
└── models/
    ├── file_tree.rs          # FileTreeNode, FileMeta, FsChangeEvent, FsErrorEvent
    └── settings.rs           # Settings, ThemePreference, WindowState
```

### 5.4 跨层 Feature 依赖

| 关系 | 模块 | 说明 |
|------|------|------|
| 前置依赖 | F01-01 项目初始化 | Tauri Command/Event 基础设施 |
| 前置依赖 | F02-01 目录扫描 | scan_directory 是数据流起点 |
| 前置依赖 | F02-02 文件读写 | read_file 是内容展示的数据源 |
| 前置依赖 | F02-03 文件监控 | fs:change 事件驱动实时更新 |
| 前置依赖 | F02-05 配置持久化 | settings 保存/恢复数据流 |
| 后置被依赖 | F04-01 文件树核心 | 使用 fileTreeStore 数据 |
| 后置被依赖 | F05-01 单文件展示 | 使用 tabStore 数据 |
| 后置被依赖 | F06-06 预览组件 | 接收 tabStore.currentContent |
| 后置被依赖 | F07-02 模式切换 | 使用 settingsStore.displayMode |
| 后置被依赖 | F08-02 主题切换 | 使用 settingsStore.theme |

---

## 6. 测试要点

### 6.1 数据流完整性测试

| 测试项 | 数据流路径 | 验证点 |
|--------|-----------|--------|
| 完整打开目录 | 工具栏 → dialog → scan_directory → 树渲染 → start_watching | 每一步状态正确更新，无丢失 |
| 完整打开文件 | 文件树点击 → tabStore.openFile → read_file → 内容渲染 | currentContent 与磁盘一致 |
| 完整外部变更 | 外部修改 → notify → fs:change → Store 更新 → UI 刷新 | 300ms 内 UI 同步 |
| 完整主题切换 | 按钮点击 → settingsStore → DOM → CodeMirror 同步 | 所有组件一致响应 |
| 配置保存链路 | 设置变更 → debounce → save_settings → 文件写入 | settings.json 内容正确 |

### 6.2 事件丢失/重复测试

| 测试项 | 操作 | 预期结果 |
|--------|------|---------|
| 快速切换目录 | 目录 A → 目录 B → 目录 A | 旧 watcher 正确停止，新 watcher 正确启动，无重复事件 |
| 连续创建文件 | 1 秒内创建 5 个 .md 文件 | 防抖合并为 ≤2 次批量更新，无丢失 |
| 组件卸载 | 切换路由/关闭面板 | 所有 listen unlisten 被调用，无内存泄漏 |
| 事件风暴 | git checkout 导致 100+ 文件变更 | 防抖后单次推送 ≤50 个事件 |

### 6.3 Store 竞态条件测试

| 测试项 | 操作 | 预期结果 |
|--------|------|---------|
| 快速切换文件 | 连续点击文件 A、B、C | 最终显示文件 C 内容，无中间状态残留 |
| 渲染取消 | 快速切换文件触发渲染取消 | renderCancelToken 递增，旧渲染终止，无错误 |
| 并发读取 | 同时触发 read_file × 2 | Tauri 串行处理，前端 Promise 独立 resolve |
| 保存冲突 | 外部修改 + 本地修改同时发生 | Phase 2：弹出冲突对话框，不静默覆盖 |

### 6.4 边界条件测试

| 测试项 | 场景 | 预期结果 |
|--------|------|---------|
| 空目录扫描 | 打开不含 .md 的目录 | 返回 `[]`，树显示空状态 |
| 空文件读取 | 读取 0 字节 .md 文件 | currentContent = `""`，渲染空白 |
| 超大文件 | 读取 216KB / 5190 行文件 | loading 状态 → 内容显示，不阻塞 UI |
| 非法路径 | 传入含 `../` 的路径 | Rust 拒绝，前端提示错误 |
| 配置损坏 | settings.json 为非法 JSON | get_settings 返回默认值，应用正常启动 |
| 网络字体失败 | 字体 CDN 不可访问 | 回退到系统字体，无崩溃 |

### 6.5 性能测试

| 指标 | 目标值 | 测试方法 |
|------|--------|---------|
| 目录树加载 | < 200ms | scan_directory 250 文件 / 100 目录 |
| 普通文件打开 | < 100ms | read_file + 渲染 1000 行 |
| 大文件打开 | < 500ms | read_file + 渲染 5000 行 |
| 模式切换 | < 150ms | Preview ↔ Source 切换 |
| 事件推送延迟 | < 500ms | 外部修改 → UI 更新（含 300ms 防抖） |
| 内存占用 | < 200MB | 打开 10 个文件（Phase 2） |
