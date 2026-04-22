# F07-04 文件保存与冲突检测 [Phase 2]

## 1. 功能描述与目标

**功能描述**：Phase 2 阶段实现 Markdown 文件的编辑保存功能，包括手动保存（快捷键）、可配置自动保存、以及外部修改冲突检测。当文件在外部被修改，且用户本地也有未保存修改时，弹出冲突处理对话框。

**目标**：
- 手动保存：Cmd/Ctrl+S 快捷键调用 Rust `write_file` 写入磁盘
- 自动保存：可配置间隔（默认 3 秒无操作后自动保存，或禁用仅手动）
- 保存成功后清除 tab 的修改标记（橙色圆点消失）
- 外部修改冲突检测：文件被外部程序修改且本地有未保存修改时弹出对话框
- 冲突处理选项：保留本地 / 加载外部 / 查看 diff
- Undo/Redo 状态在保存后保持不变

**PRD 关联**：FR-005（文件编辑与保存）、FR-006（文件系统实时监控）

---

## 2. 技术实现方案

### 2.1 保存流程总览

```
用户按下 Cmd+S / 自动保存触发
    │
    ▼
获取当前 tab 的 content
    │
    ▼
调用 Rust write_file(path, content)
    │
    ├──► 成功 → 更新 tab.isModified = false
    │           → 更新文件元信息（修改时间）
    │           → 显示"已保存"状态提示
    │
    └──► 失败 → 显示错误提示
```

### 2.2 手动保存实现

```typescript
// composables/useFileSave.ts
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useTabStore } from '@/stores/tabStore'
import { useEditorStore } from '@/stores/editorStore'

export interface SaveResult {
  success: boolean
  error?: string
}

export function useFileSave() {
  const tabStore = useTabStore()
  const editorStore = useEditorStore()
  const isSaving = ref(false)
  const lastSavedAt = ref<Date | null>(null)

  /** 手动保存当前活动文件 */
  async function saveCurrentFile(): Promise<SaveResult> {
    const activeTab = tabStore.activeTab
    if (!activeTab) {
      return { success: false, error: 'No active file' }
    }

    if (!activeTab.isModified) {
      return { success: true } // 无需保存
    }

    isSaving.value = true
    try {
      await invoke('write_file', {
        path: activeTab.path,
        content: activeTab.content,
      })

      // 保存成功
      tabStore.markSaved(activeTab.id)
      editorStore.setModified(false)
      lastSavedAt.value = new Date()

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message }
    } finally {
      isSaving.value = false
    }
  }

  /** 保存指定文件（用于批量保存等场景） */
  async function saveFile(tabId: string): Promise<SaveResult> {
    const tab = tabStore.tabs.find(t => t.id === tabId)
    if (!tab) {
      return { success: false, error: 'Tab not found' }
    }

    isSaving.value = true
    try {
      await invoke('write_file', {
        path: tab.path,
        content: tab.content,
      })

      tabStore.markSaved(tabId)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message }
    } finally {
      isSaving.value = false
    }
  }

  /** 保存所有修改过的文件 */
  async function saveAllFiles(): Promise<{ saved: number; errors: string[] }> {
    const modifiedTabs = tabStore.tabs.filter(t => t.isModified)
    const errors: string[] = []
    let saved = 0

    for (const tab of modifiedTabs) {
      const result = await saveFile(tab.id)
      if (result.success) {
        saved++
      } else {
        errors.push(`${tab.name}: ${result.error}`)
      }
    }

    return { saved, errors }
  }

  return {
    isSaving,
    lastSavedAt,
    saveCurrentFile,
    saveFile,
    saveAllFiles,
  }
}
```

### 2.3 Rust write_file 命令

```rust
// src-tauri/src/commands/file_system.rs
use std::fs;

#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    // 1. 路径安全校验
    let canonical = fs::canonicalize(&path)
        .map_err(|e| format!("Invalid path: {}", e))?;

    // 2. 校验路径在授权 Scope 内（Tauri 2.0 自动处理）
    // 确保目录存在
    if let Some(parent) = canonical.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // 3. 原子写入：先写入临时文件，再重命名
    let temp_path = canonical.with_extension("tmp");
    fs::write(&temp_path, content)
        .map_err(|e| format!("Write failed: {}", e))?;

    fs::rename(&temp_path, &canonical)
        .map_err(|e| format!("Rename failed: {}", e))?;

    Ok(())
}
```

### 2.4 自动保存实现

```typescript
// composables/useAutoSave.ts
import { ref, watch, onUnmounted } from 'vue'
import { useTabStore } from '@/stores/tabStore'
import { useFileSave } from './useFileSave'

export interface AutoSaveConfig {
  enabled: boolean
  delayMs: number
}

export function useAutoSave(config: AutoSaveConfig = { enabled: true, delayMs: 3000 }) {
  const tabStore = useTabStore()
  const { saveCurrentFile } = useFileSave()
  const autoSaveTimer = ref<ReturnType<typeof setTimeout> | null>(null)
  const isAutoSaving = ref(false)

  function scheduleAutoSave() {
    if (!config.enabled) return
    if (autoSaveTimer.value) {
      clearTimeout(autoSaveTimer.value)
    }

    autoSaveTimer.value = setTimeout(async () => {
      const activeTab = tabStore.activeTab
      if (activeTab?.isModified) {
        isAutoSaving.value = true
        await saveCurrentFile()
        isAutoSaving.value = false
      }
    }, config.delayMs)
  }

  function cancelAutoSave() {
    if (autoSaveTimer.value) {
      clearTimeout(autoSaveTimer.value)
      autoSaveTimer.value = null
    }
  }

  // 监听内容变化，触发自动保存计时
  // 注意：实际使用时需在 SourceEditor 的 change 事件中调用 scheduleAutoSave

  onUnmounted(cancelAutoSave)

  return {
    isAutoSaving,
    scheduleAutoSave,
    cancelAutoSave,
  }
}
```

### 2.5 外部修改冲突检测

```typescript
// composables/useFileConflict.ts
import { ref, onMounted, onUnmounted } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { useTabStore } from '@/stores/tabStore'

export type ConflictResolution = 'keep-local' | 'load-external' | 'show-diff'

export interface FileConflict {
  path: string
  name: string
  localModified: boolean
  externalModifiedAt: number
}

export function useFileConflict() {
  const tabStore = useTabStore()
  const pendingConflict = ref<FileConflict | null>(null)
  let unlisten: (() => void) | null = null

  onMounted(async () => {
    // 监听 Rust 后端文件变更事件
    unlisten = await listen<{ type: string; path: string }>(
      'fs:change',
      async (event) => {
        if (event.payload.type !== 'modify') return

        const changedPath = event.payload.path
        const tab = tabStore.tabs.find(t => t.path === changedPath)
        if (!tab) return

        // 检查本地是否有未保存修改
        if (!tab.isModified) {
          // 本地无修改，直接刷新
          const newContent = await invoke<string>('read_file', { path: changedPath })
          tabStore.updateContent(tab.id, newContent)
          tabStore.markSaved(tab.id)
          return
        }

        // 本地有修改，产生冲突
        const meta = await invoke<{ modified: number }>('get_file_meta', { path: changedPath })
        pendingConflict.value = {
          path: changedPath,
          name: tab.name,
          localModified: tab.isModified,
          externalModifiedAt: meta.modified,
        }
      }
    )
  })

  onUnmounted(() => {
    unlisten?.()
  })

  async function resolveConflict(resolution: ConflictResolution) {
    if (!pendingConflict.value) return

    const { path } = pendingConflict.value
    const tab = tabStore.tabs.find(t => t.path === path)
    if (!tab) return

    switch (resolution) {
      case 'keep-local':
        // 保留本地版本，不做任何操作
        // 可选：记录外部版本的时间戳，下次不再提示
        break

      case 'load-external':
        // 加载外部版本，放弃本地修改
        const externalContent = await invoke<string>('read_file', { path })
        tabStore.updateContent(tab.id, externalContent)
        tabStore.markSaved(tab.id)
        break

      case 'show-diff':
        // Phase 2/3：显示 diff 视图供用户比较后选择
        // 此处预留扩展点
        break
    }

    pendingConflict.value = null
  }

  return {
    pendingConflict,
    resolveConflict,
  }
}
```

### 2.6 冲突对话框组件

```vue
<!-- components/common/ConflictDialog.vue -->
<template>
  <Modal v-if="conflict" @close="$emit('dismiss')">
    <div class="conflict-dialog">
      <div class="conflict-header">
        <AlertTriangleIcon class="conflict-icon" />
        <h3>文件已被外部修改</h3>
      </div>
      <p class="conflict-desc">
        文件 "{{ conflict.name }}" 在外部被修改，同时您也有未保存的本地修改。
      </p>
      <div class="conflict-actions">
        <button class="btn btn-primary" @click="$emit('resolve', 'keep-local')">
          保留本地版本
        </button>
        <button class="btn btn-secondary" @click="$emit('resolve', 'load-external')">
          加载外部版本
        </button>
        <button class="btn btn-text" @click="$emit('resolve', 'show-diff')">
          查看差异
        </button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import type { FileConflict, ConflictResolution } from '@/composables/useFileConflict'
import Modal from '@/components/common/Modal.vue'
import AlertTriangleIcon from '@/components/icons/AlertTriangleIcon.vue'

interface Props {
  conflict: FileConflict | null
}

defineProps<Props>()
defineEmits<{
  resolve: [resolution: ConflictResolution]
  dismiss: []
}>()
</script>
```

### 2.7 状态栏保存状态显示

```vue
<!-- components/layout/StatusBar.vue (保存状态部分) -->
<template>
  <footer class="statusbar">
    <div class="status-left">
      <span>UTF-8</span>
      <span class="status-sep">|</span>
      <span>Markdown</span>
      <span class="status-sep">|</span>
      <span>{{ lineCount }} 行</span>
    </div>
    <div class="status-right">
      <span v-if="isSaving" class="status-saving">保存中...</span>
      <span v-else-if="isModified" class="status-modified">已修改</span>
      <span v-else class="status-saved">已保存</span>
      <span v-if="lastSavedAt" class="status-time">
        {{ formatTime(lastSavedAt) }}
      </span>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTabStore } from '@/stores/tabStore'
import { useFileSave } from '@/composables/useFileSave'

const tabStore = useTabStore()
const { isSaving, lastSavedAt } = useFileSave()

const isModified = computed(() => tabStore.activeTab?.isModified ?? false)
const lineCount = computed(() => {
  const content = tabStore.activeTab?.content ?? ''
  return content.split('\n').length
})

function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
</script>
```

---

## 3. 接口定义

### 3.1 Rust IPC 命令

```rust
// src-tauri/src/commands/file_system.rs

/// 写入文件（原子写入）
#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String>

/// 获取文件元信息（用于冲突检测）
#[tauri::command]
pub async fn get_file_meta(path: String) -> Result<FileMeta, String>

/// 文件元信息结构
#[derive(Debug, Serialize)]
pub struct FileMeta {
    pub path: String,
    pub size: u64,
    pub modified: u64,  // Unix 时间戳（秒）
    pub created: u64,
}
```

### 3.2 useFileSave Composable 接口

```typescript
export interface UseFileSaveReturn {
  isSaving: Ref<boolean>
  lastSavedAt: Ref<Date | null>
  saveCurrentFile: () => Promise<SaveResult>
  saveFile: (tabId: string) => Promise<SaveResult>
  saveAllFiles: () => Promise<{ saved: number; errors: string[] }>
}
```

### 3.3 useAutoSave Composable 接口

```typescript
export interface AutoSaveConfig {
  enabled: boolean
  delayMs: number
}

export interface UseAutoSaveReturn {
  isAutoSaving: Ref<boolean>
  scheduleAutoSave: () => void
  cancelAutoSave: () => void
}
```

### 3.4 useFileConflict Composable 接口

```typescript
export type ConflictResolution = 'keep-local' | 'load-external' | 'show-diff'

export interface FileConflict {
  path: string
  name: string
  localModified: boolean
  externalModifiedAt: number
}

export interface UseFileConflictReturn {
  pendingConflict: Ref<FileConflict | null>
  resolveConflict: (resolution: ConflictResolution) => Promise<void>
}
```

---

## 4. 数据结构

### 4.1 SaveResult 类型

```typescript
// types/fileSave.ts
export interface SaveResult {
  success: boolean
  error?: string
}

export interface BatchSaveResult {
  saved: number
  errors: string[]
}
```

### 4.2 自动保存配置

```typescript
// types/settings.ts
export interface AutoSaveSettings {
  enabled: boolean
  /** 无操作后自动保存延迟（毫秒） */
  delayMs: number
  /** 可选：'afterDelay' | 'onFocusChange' | 'off' */
  mode: 'afterDelay' | 'onFocusChange' | 'off'
}
```

### 4.3 状态栏状态类型

```typescript
export type SaveStatus = 'saved' | 'modified' | 'saving'

export interface StatusBarState {
  encoding: string
  fileType: string
  lineCount: number
  saveStatus: SaveStatus
  lastSavedAt: Date | null
}
```

---

## 5. 依赖关系

| 依赖模块 | 特性 | 说明 |
|---------|------|------|
| M07 | F07-03 CodeMirror 可编辑模式 | 编辑后产生内容变化，触发保存 |
| M05 | F05-02 多标签页管理 | 保存后清除 tab.isModified |
| M02 | F02-02 文件读写命令 | 依赖 Rust `write_file` 命令 |
| M02 | F02-03 文件系统监控 | 监听外部修改事件 |
| M08 | F08-03 设置面板 | 自动保存开关和间隔配置 |

**被依赖**：
- M03 F03-03 状态栏（显示保存状态）
- M08 F08-04 配置持久化（自动保存配置持久化）

---

## 6. 测试要点

### 6.1 单元测试

| 测试项 | 操作 | 预期结果 |
|--------|------|---------|
| 手动保存 | saveCurrentFile() | 调用 write_file，成功返回 true |
| 保存未修改文件 | 文件未编辑时保存 | 跳过保存，直接返回 success |
| 保存失败 | 磁盘满/权限不足 | 返回 error 信息 |
| 自动保存触发 | 编辑后等待 3 秒 | 自动调用 saveCurrentFile |
| 自动保存取消 | 在 3 秒内继续编辑 | 重新计时 |
| 批量保存 | 3 个文件有修改 | saveAllFiles 返回 saved=3 |
| 外部修改无冲突 | 本地无修改时外部修改 | 自动刷新内容，无提示 |
| 外部修改有冲突 | 本地有修改时外部修改 | pendingConflict 有值 |
| 冲突解决-保留本地 | resolveConflict('keep-local') | 保留当前内容 |
| 冲突解决-加载外部 | resolveConflict('load-external') | 内容替换为外部版本 |

### 6.2 集成测试

1. **编辑 → 保存完整链路**：编辑文本 → Cmd+S → 文件写入磁盘 → 状态栏显示"已保存"
2. **自动保存链路**：编辑 → 等待 → 自动保存 → 修改标记消失
3. **冲突检测链路**：外部修改文件 → 前端收到 fs:change 事件 → 检测到本地有修改 → 弹出冲突对话框

### 6.3 E2E 测试

- 使用 VSCode 在外部修改已打开的文件，验证冲突检测
- 网络磁盘/同步盘（如 Dropbox）场景下的冲突处理
- 大文件（5000 行）保存性能

### 6.4 安全测试

| 测试项 | 输入 | 预期 |
|--------|------|------|
| 路径遍历 | path = "../../../etc/passwd" | Rust 后端拒绝，返回错误 |
| 写入未授权目录 | 选择目录外的路径 | Tauri Scope 拒绝 |
| 空内容写入 | content = "" | 正常写入空文件 |
| Unicode 内容 | 包含中文/Emoji 的 Markdown | 正确保存，无乱码 |
