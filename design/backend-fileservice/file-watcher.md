# F02-03 文件系统监控

## 1. 功能描述与目标

基于 Rust `notify` crate 实现对已加载目录的文件系统变更监控，将文件创建、删除、修改、重命名事件实时推送给前端，驱动文件树自动更新和内容自动刷新。

**核心目标**：
- 监听 `.md` 文件的创建、删除、修改、重命名事件
- 通过 Tauri Event 实时推送变更通知到前端
- 300ms 防抖合并，避免高频事件风暴
- 仅监控相关路径，忽略 `.git`、`node_modules`、`.DS_Store` 等无关变更
- 支持启动和停止监控的动态控制

**关联需求**：FR-006、FR-006.1 ~ FR-006.5

---

## 2. 技术实现方案

### 2.1 Rust 模块组织

```
src-tauri/src/
├── commands/
│   └── watcher.rs           # start_watching / stop_watching
├── services/
│   └── file_watcher.rs      # notify watcher 封装、事件处理、防抖逻辑
└── models/
    └── file_tree.rs         # FsChangeEvent / FsChangeType 定义
```

### 2.2 监控服务架构

```
┌─────────────────────────────────────────┐
│  Frontend (Vue 3)                        │
│  ┌─────────────────────────────────────┐│
│  │ 监听 tauriEvents.ts                 ││
│  │ `fs:change` / `fs:error`            ││
│  └─────────────────────────────────────┘│
└─────────────────┬───────────────────────┘
                  │ Tauri Event
┌─────────────────▼───────────────────────┐
│  Rust Backend                            │
│  ┌─────────────────────────────────────┐│
│  │ FileWatcherService                  ││
│  │  ┌───────────────────────────────┐  ││
│  │  │ notify::RecommendedWatcher    │  ││
│  │  │ (debounced, 300ms)            │  ││
│  │  └──────────────┬────────────────┘  ││
│  │                 │ 原始 fs 事件        ││
│  │  ┌──────────────▼────────────────┐  ││
│  │  │ 事件过滤器                     │  ││
│  │  │ · 仅 .md 文件                 │  ││
│  │  │ · 忽略隐藏目录                │  ││
│  │  │ · 合并同一文件多次变更        │  ││
│  │  └──────────────┬────────────────┘  ││
│  │                 │ 过滤后事件          ││
│  │  ┌──────────────▼────────────────┐  ││
│  │  │ 事件处理器                     │  ││
│  │  │ · 转换为 FsChangeEvent        │  ││
│  │  │ · emit 到前端                 │  ││
│  │  └───────────────────────────────┘  ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

### 2.3 核心实现逻辑

#### Watcher 管理

使用 `std::sync::Mutex<Option<notify::RecommendedWatcher>>` 持有 watcher 实例，支持动态启停：

```rust
pub struct FileWatcherService {
    watcher: Arc<Mutex<Option<RecommendedWatcher>>>,
    app_handle: AppHandle,
    debounce_ms: u64,
}
```

#### 防抖实现

使用 `notify_debouncer_full`（notify 6.x 配套 debouncer crate）或自建防抖：

- 收到事件时放入缓冲队列
- 启动 300ms 定时器
- 定时器触发时，合并队列中同一文件的所有事件，取最新状态
- 一次性推送合并后的事件列表

#### 事件过滤规则

| 规则 | 处理方式 |
|------|---------|
| 文件扩展名不是 `.md` | 忽略 |
| 路径包含 `.git` / `node_modules` / `.DS_Store` | 忽略 |
| 隐藏文件（以 `.` 开头） | 忽略 |
| 同一文件在 300ms 内多次 modify | 合并为单次 modify |
| 快速 rename（同一文件改名） | 合并为 rename 事件，保留新旧路径 |

### 2.4 错误处理策略

- **Watcher 创建失败**（如目录权限不足）：emit `fs:error` 事件到前端
- **运行时 watcher 断开**：自动尝试重建，失败则 emit 错误事件
- **路径不再存在**（根目录被删除）：停止 watcher，emit 错误事件

---

## 3. 接口定义

### 3.1 Tauri IPC Command

**Rust 端签名**：

```rust
/// 启动目录监控
#[tauri::command]
pub async fn start_watching(
    app: tauri::AppHandle,
    path: String,
) -> Result<(), WatcherError>;

/// 停止目录监控
#[tauri::command]
pub async fn stop_watching(
    app: tauri::AppHandle,
) -> Result<(), WatcherError>;
```

**TypeScript 前端调用**：

```typescript
import { invoke } from '@tauri-apps/api/core';

// 启动监控
await invoke('start_watching', {
  path: '/Users/xxx/Knowledge/learn'
});

// 停止监控
await invoke('stop_watching');
```

### 3.2 事件定义（Rust → Frontend）

**`fs:change` 事件**：

```rust
// Rust 端 emit
app_handle.emit("fs:change", FsChangeEvent { ... });
```

**TypeScript 前端监听**：

```typescript
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen<FsChangeEvent>('fs:change', (event) => {
  const { changeType, path, oldPath } = event.payload;
  // 更新文件树 / 刷新标签页内容
});
```

**`fs:error` 事件**：

```typescript
await listen<FsErrorEvent>('fs:error', (event) => {
  console.error('File watcher error:', event.payload.message);
});
```

---

## 4. 数据结构

### 4.1 Rust Struct 定义

```rust
// src-tauri/src/models/file_tree.rs

use serde::{Deserialize, Serialize};

/// 文件系统变更类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FsChangeType {
    Created,
    Modified,
    Deleted,
    Renamed,
}

/// 文件系统变更事件（推送到前端）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsChangeEvent {
    /// 变更类型
    pub change_type: FsChangeType,
    /// 当前文件/目录路径
    pub path: String,
    /// 重命名时的旧路径（仅 Rename 有效）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_path: Option<String>,
    /// 是否为目录
    pub is_dir: bool,
}

/// 文件系统错误事件
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsErrorEvent {
    pub message: String,
    /// 事件时间戳（Unix 毫秒时间戳，Rust u64 ↔ TS number）
    /// 注：JS number 精度足够表示毫秒时间戳（2^53 范围内）
    pub timestamp: u64,
}
```

### 4.2 TypeScript Interface

```typescript
// src/types/fileTree.ts

export type FsChangeType = 'created' | 'modified' | 'deleted' | 'renamed';

export interface FsChangeEvent {
  changeType: FsChangeType;
  path: string;
  oldPath?: string;
  isDir: boolean;
}

export interface FsErrorEvent {
  message: string;
  timestamp: number;
}
```

---

## 5. 依赖关系

### 5.1 Cargo.toml 依赖

```toml
[dependencies]
tauri = { version = "2.0", features = [] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# 文件系统监控
notify = "6.1"
notify-debouncer-full = "0.3"

# 异步运行时（Tauri 已依赖 tokio）
# tokio = { version = "1", features = ["time"] }
```

> **notify 6.x + debouncer 版本对应关系**：
> - `notify = "6.1"` 对应 `notify-debouncer-full = "0.3"`
> - debouncer 提供 `new_debouncer` 函数，内置定时器防抖

### 5.2 前置/后置 Feature 依赖

| 关系 | Feature | 说明 |
|------|---------|------|
| 前置依赖 | F01-01（项目初始化） | Tauri Command 和 Event 基础设施 |
| 前置依赖 | F02-01（目录扫描） | 需要已扫描的根目录路径作为监控目标 |
| 后置被依赖 | F04-04（文件树实时更新） | 前端监听 `fs:change` 更新文件树 |
| 后置被依赖 | F05-01（单文件展示） | 外部修改时自动刷新打开的文件内容 |
| 后置被依赖 | F07-04（文件保存） | 外部修改冲突检测依赖 watcher 事件 |

---

## 6. 测试要点

### 6.1 功能测试

| 场景 | 预期结果 |
|------|---------|
| 在监控目录下新建 `.md` 文件 | 前端收到 `fs:change`（Created） |
| 修改已存在的 `.md` 文件 | 前端收到 `fs:change`（Modified） |
| 删除 `.md` 文件 | 前端收到 `fs:change`（Deleted） |
| 重命名 `.md` 文件 | 前端收到 `fs:change`（Renamed，含 oldPath） |
| 新建 `.txt` 文件 | 被过滤，不推送事件 |
| 在 `.git` 目录下操作 | 被过滤，不推送事件 |
| 1 秒内快速修改同一文件 5 次 | 合并为 1 次 Modified 事件（300ms 防抖） |

### 6.2 边界条件

| 场景 | 预期结果 |
|------|---------|
| 监控的根目录被删除 | emit `fs:error`，watcher 停止 |
| 监控的根目录权限变更（变为不可读） | emit `fs:error` |
| 调用 `stop_watching` 后再调用 | 幂等，不报错 |
| 切换打开不同目录 | 先 `stop_watching`，再对新目录 `start_watching` |
| 系统休眠恢复后 | watcher 自动恢复监控（notify 底层处理） |

### 6.3 性能测试

| 场景 | 预期结果 |
|------|---------|
| 同时监控 250 文件 / 100 目录 | 内存占用 < 5MB，CPU 开销可忽略 |
| 大量文件同时变更（如 git checkout） | 防抖合并后，单次推送不超过 50 个事件 |
| 事件推送延迟 | 变更发生到前端收到事件 < 500ms（含 300ms 防抖） |

### 6.4 跨平台测试

| 场景 | macOS | Windows |
|------|-------|---------|
| 基础监控 | FSEvents | ReadDirectoryChangesW |
| 重命名事件 | 原生支持 | 原生支持 |
| 符号链接目录 | 监控链接指向的目录 | 监控链接指向的目录 |
| 网络文件系统 | 可能不支持 | 可能不支持 |
