# F01-05 错误处理规范 (Error Handling Strategy)

> 模块：scaffold | 优先级：P0-MVP | 类型：规范文档

## 1. 功能描述与目标

定义 MKPreview 应用的统一错误处理体系，将分散在各后端模块中的自定义错误类型整合为统一的 `AppError`，确保 Rust 后端和 Vue 前端之间的错误传播一致、用户体验友好、开发调试高效。

**核心目标**：
- 统一后端错误类型，消除 `DirScannerError`、`FileServiceError`、`ConfigError`、`SearchError` 等分散定义
- 定义结构化错误码体系，前端可根据错误码执行精确的分支处理
- 建立前端错误分级策略，不同严重程度的错误对应不同的用户提示方式
- 确保 IPC 通信层的错误能完整、无损地传递到前端
- 提供清晰的日志策略，兼顾开发调试和生产问题排查

**关联需求**：FR-001、FR-002、FR-006、FR-008、NFR-004（安全性）

---

## 2. 技术实现方案

### 2.1 Rust 后端统一错误类型

设计统一的 `AppError` enum 替代各模块分散的错误类型。`AppError` 涵盖所有业务模块可能产生的错误，并通过 `thiserror` 自动实现 `Display` 和错误链转换。

```rust
// src-tauri/src/models/error.rs

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// 应用统一错误类型
///
/// 替代原有的 DirScannerError、FileServiceError、ConfigError、SearchError，
/// 作为所有 Tauri Command 的统一返回错误类型。
#[derive(Debug, Error)]
pub enum AppError {
    // ── 文件系统相关 (FS_*) ──
    #[error("IO错误: {0}")]
    Io(#[from] std::io::Error),

    #[error("文件不存在: {path}")]
    FileNotFound { path: String },

    #[error("路径不在允许范围内: {path}")]
    PathNotInScope { path: String },

    #[error("非法路径: {path}")]
    InvalidPath { path: String },

    #[error("不是Markdown文件: {path}")]
    NotAMarkdownFile { path: String },

    #[error("不是目录: {path}")]
    NotADirectory { path: String },

    #[error("写入内容过大: {size} 字节 (限制 10MB)")]
    FileTooLarge { size: usize },

    #[error("权限不足: {path}")]
    PermissionDenied { path: String },

    // ── 配置相关 (CFG_*) ──
    #[error("配置序列化失败: {0}")]
    ConfigSerialize(String),

    #[error("配置反序列化失败: {0}")]
    ConfigDeserialize(String),

    #[error("配置值非法: {0}")]
    InvalidSettings(String),

    #[error("应用数据目录获取失败")]
    AppDataDirNotFound,

    // ── 监控相关 (WATCH_*) ──
    #[error("文件监控启动失败: {0}")]
    WatcherStart(String),

    #[error("文件监控运行时错误: {0}")]
    WatcherRuntime(String),

    #[error("监控路径已不存在: {path}")]
    WatcherPathGone { path: String },

    // ── 搜索相关 (SEARCH_*) ──
    #[error("搜索目录非法: {path}")]
    InvalidSearchDirectory { path: String },

    #[error("搜索超时")]
    SearchTimeout,

    // ── IPC / 通用 ──
    #[error("内部错误: {0}")]
    Internal(String),
}
```

#### 错误码映射

每个 `AppError` 变体对应唯一的错误码，用于前端分支判断：

| AppError 变体 | 错误码 | 说明 |
|--------------|--------|------|
| `Io` | `FS_IO_ERROR` | 底层 IO 错误（权限不足、磁盘满等） |
| `FileNotFound` | `FS_NOT_FOUND` | 文件不存在 |
| `PathNotInScope` | `FS_OUT_OF_SCOPE` | 路径不在 Tauri FS Scope 内 |
| `InvalidPath` | `FS_INVALID_PATH` | 路径包含非法字符或遍历序列 |
| `NotAMarkdownFile` | `FS_NOT_MD` | 扩展名不是 `.md` |
| `NotADirectory` | `FS_NOT_DIR` | 期望目录但传入的是文件 |
| `FileTooLarge` | `FS_TOO_LARGE` | 写入内容超过 10MB |
| `PermissionDenied` | `FS_NO_PERMISSION` | 文件系统权限不足 |
| `ConfigSerialize` | `CFG_SERIALIZE` | 配置 JSON 序列化失败 |
| `ConfigDeserialize` | `CFG_DESERIALIZE` | 配置 JSON 反序列化失败 |
| `InvalidSettings` | `CFG_INVALID_VALUE` | 配置值超出合法范围 |
| `AppDataDirNotFound` | `CFG_NO_DATA_DIR` | 无法获取应用数据目录 |
| `WatcherStart` | `WATCH_START_FAIL` | notify watcher 创建失败 |
| `WatcherRuntime` | `WATCH_RUNTIME` | watcher 运行中异常断开 |
| `WatcherPathGone` | `WATCH_PATH_GONE` | 被监控的根目录被删除 |
| `InvalidSearchDirectory` | `SEARCH_INVALID_DIR` | 搜索目标目录非法 |
| `SearchTimeout` | `SEARCH_TIMEOUT` | 搜索超过 10s 超时 |
| `Internal` | `INTERNAL` | 未预料的内部错误 |

#### Tauri IPC 错误转换

`AppError` 实现自定义序列化，转换为 Tauri 前端可解析的结构化错误：

```rust
// src-tauri/src/models/error.rs

/// 统一错误响应结构（序列化后传给前端）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorResponse {
    /// 错误码（前端分支判断依据）
    pub code: String,
    /// 用户友好的错误消息（中文）
    pub message: String,
    /// 额外细节（如路径、大小等）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl From<AppError> for ErrorResponse {
    fn from(err: AppError) -> Self {
        let code = err.error_code().to_string();
        let message = err.to_string();
        let details = err.details();
        ErrorResponse { code, message, details }
    }
}

impl AppError {
    /// 获取错误码
    pub fn error_code(&self) -> &'static str {
        use AppError::*;
        match self {
            Io(_) => "FS_IO_ERROR",
            FileNotFound { .. } => "FS_NOT_FOUND",
            PathNotInScope { .. } => "FS_OUT_OF_SCOPE",
            InvalidPath { .. } => "FS_INVALID_PATH",
            NotAMarkdownFile { .. } => "FS_NOT_MD",
            NotADirectory { .. } => "FS_NOT_DIR",
            FileTooLarge { .. } => "FS_TOO_LARGE",
            PermissionDenied { .. } => "FS_NO_PERMISSION",
            ConfigSerialize(_) => "CFG_SERIALIZE",
            ConfigDeserialize(_) => "CFG_DESERIALIZE",
            InvalidSettings(_) => "CFG_INVALID_VALUE",
            AppDataDirNotFound => "CFG_NO_DATA_DIR",
            WatcherStart(_) => "WATCH_START_FAIL",
            WatcherRuntime(_) => "WATCH_RUNTIME",
            WatcherPathGone { .. } => "WATCH_PATH_GONE",
            InvalidSearchDirectory { .. } => "SEARCH_INVALID_DIR",
            SearchTimeout => "SEARCH_TIMEOUT",
            Internal(_) => "INTERNAL",
        }
    }

    /// 获取额外细节信息
    pub fn details(&self) -> Option<serde_json::Value> {
        use AppError::*;
        match self {
            FileNotFound { path } => json!({"path": path}),
            PathNotInScope { path } => json!({"path": path}),
            InvalidPath { path } => json!({"path": path}),
            NotAMarkdownFile { path } => json!({"path": path}),
            NotADirectory { path } => json!({"path": path}),
            FileTooLarge { size } => json!({"size": size, "limit": 10 * 1024 * 1024}),
            PermissionDenied { path } => json!({"path": path}),
            WatcherPathGone { path } => json!({"path": path}),
            InvalidSearchDirectory { path } => json!({"path": path}),
            _ => None,
        }
        .map(|v| v)
    }
}
```

在 Tauri Command 中返回 `Result<T, AppError>`，通过自定义响应处理器转换为前端可解析的 JSON：

```rust
// src-tauri/src/lib.rs 或 commands/mod.rs

/// 统一包装 Command 返回值，将 AppError 序列化为结构化 JSON
pub fn ipc_result<T: Serialize>(
    result: Result<T, AppError>,
) -> Result<T, tauri::ipc::InvokeError> {
    match result {
        Ok(val) => Ok(val),
        Err(err) => {
            let resp: ErrorResponse = err.into();
            // 通过 InvokeError 的自定义序列化将 ErrorResponse 传给前端
            Err(tauri::ipc::InvokeError::from(
                serde_json::to_string(&resp).unwrap_or_else(|_| "未知错误".into())
            ))
        }
    }
}
```

> **Tauri 2.0 兼容性说明**：Tauri 的 `invoke` 返回错误时，前端捕获的是字符串。为传递结构化数据，后端将 `ErrorResponse` 序列化为 JSON 字符串放入 `InvokeError`，前端捕获后反序列化 JSON 提取 `code`、`message`、`details`。

### 2.2 错误序列化格式

前端通过 `invoke` 调用后端 Command 时，错误统一以如下 JSON 结构传递：

```json
{
  "code": "FS_NOT_FOUND",
  "message": "文件不存在: /path/to/file.md",
  "details": {
    "path": "/path/to/file.md"
  }
}
```

#### 错误码分类表

| 前缀 | 分类 | 覆盖模块 |
|------|------|---------|
| `FS_*` | 文件系统相关 | dir-scanner、file-readwrite、file-watcher |
| `CFG_*` | 配置相关 | config-store |
| `WATCH_*` | 文件监控相关 | file-watcher |
| `SEARCH_*` | 搜索相关 | full-text-search |
| `INTERNAL` | 未分类内部错误 | 全局兜底 |

#### 各模块错误映射迁移

| 原模块 | 原错误类型 | 原变体 | 映射到 AppError |
|--------|-----------|--------|----------------|
| dir-scanner | `DirScannerError` | `InvalidPath` | `AppError::InvalidPath` |
| dir-scanner | `DirScannerError` | `PathNotInScope` | `AppError::PathNotInScope` |
| dir-scanner | `DirScannerError` | `IoError` | `AppError::Io` |
| dir-scanner | `DirScannerError` | `NotADirectory` | `AppError::NotADirectory` |
| file-readwrite | `FileServiceError` | `InvalidPath` | `AppError::InvalidPath` |
| file-readwrite | `FileServiceError` | `PathNotInScope` | `AppError::PathNotInScope` |
| file-readwrite | `FileServiceError` | `NotAMarkdownFile` | `AppError::NotAMarkdownFile` |
| file-readwrite | `FileServiceError` | `FileNotFound` | `AppError::FileNotFound` |
| file-readwrite | `FileServiceError` | `ReadError` | `AppError::Io` |
| file-readwrite | `FileServiceError` | `WriteError` | `AppError::Io` |
| file-readwrite | `FileServiceError` | `PermissionDenied` | `AppError::PermissionDenied` |
| file-readwrite | `FileServiceError` | `FileTooLarge` | `AppError::FileTooLarge` |
| file-watcher | `WatcherError`（隐式） | 创建失败 | `AppError::WatcherStart` |
| file-watcher | `WatcherError`（隐式） | 运行时断开 | `AppError::WatcherRuntime` |
| file-watcher | `WatcherError`（隐式） | 路径被删除 | `AppError::WatcherPathGone` |
| config-store | `ConfigError` | `IoError` | `AppError::Io` |
| config-store | `ConfigError` | `SerializeError` | `AppError::ConfigSerialize` |
| config-store | `ConfigError` | `DeserializeError` | `AppError::ConfigDeserialize` |
| config-store | `ConfigError` | `InvalidSettings` | `AppError::InvalidSettings` |
| config-store | `ConfigError` | `DirNotFound` | `AppError::AppDataDirNotFound` |
| full-text-search | `SearchError` | `InvalidDirectory` | `AppError::InvalidSearchDirectory` |
| full-text-search | `SearchError` | `DirectoryNotInScope` | `AppError::PathNotInScope` |
| full-text-search | `SearchError` | `IoError` | `AppError::Io` |
| full-text-search | `SearchError` | `Timeout` | `AppError::SearchTimeout` |

### 2.3 前端错误处理

#### IPC 调用统一封装

前端所有 Tauri `invoke` 调用通过统一封装函数执行，确保错误被一致捕获和解析：

```typescript
// src/services/errorHandler.ts

import { invoke as tauriInvoke } from '@tauri-apps/api/core';

export interface AppException {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * 解析 Tauri IPC 错误字符串为结构化 AppException
 */
function parseError(err: unknown): AppException {
  if (typeof err === 'string') {
    try {
      const parsed = JSON.parse(err);
      if (parsed.code && parsed.message) {
        return parsed as AppException;
      }
    } catch {
      // 非 JSON 字符串，降级处理
    }
    return { code: 'UNKNOWN', message: err };
  }
  if (err instanceof Error) {
    return { code: 'UNKNOWN', message: err.message };
  }
  return { code: 'UNKNOWN', message: String(err) };
}

/**
 * 统一 IPC 调用封装
 * 自动捕获错误并转换为 AppException
 */
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await tauriInvoke<T>(cmd, args);
  } catch (err) {
    const appErr = parseError(err);
    handleError(appErr);
    throw appErr; // 继续抛出，供调用方做业务级处理
  }
}

/**
 * 带默认值的 IPC 调用 — 错误时返回默认值而非抛出
 */
export async function invokeWithDefault<T>(
  cmd: string,
  args: Record<string, unknown> | undefined,
  defaultValue: T
): Promise<T> {
  try {
    return await tauriInvoke<T>(cmd, args);
  } catch (err) {
    const appErr = parseError(err);
    handleError(appErr);
    return defaultValue;
  }
}
```

#### 错误分级策略

| 级别 | 定义 | 用户提示方式 | 适用错误码 |
|------|------|------------|-----------|
| **Fatal** | 应用无法继续运行 | 全屏错误页面，提供「重新加载」按钮 | `INTERNAL`（启动期） |
| **Error** | 操作失败，用户预期被打断 | Toast 通知（5s 自动消失）+ 控制台日志 | `FS_NOT_FOUND`, `FS_OUT_OF_SCOPE`, `FS_NO_PERMISSION`, `WATCH_START_FAIL`, `SEARCH_TIMEOUT` |
| **Warning** | 非关键失败，可降级继续 | 状态栏左侧警告图标 + 悬停提示 | `WATCH_RUNTIME`, `WATCH_PATH_GONE`, `CFG_INVALID_VALUE` |
| **Silent** | 自动降级，用户无感知 | 仅记录日志，不展示 UI | `CFG_DESERIALIZE`, `CFG_NO_DATA_DIR`（启动时回退默认值） |

#### 各场景错误处理策略

| 场景 | 触发错误码 | 处理策略 | 级别 |
|------|-----------|---------|------|
| 文件读取失败 | `FS_NOT_FOUND`, `FS_IO_ERROR` | Toast 提示「文件读取失败：{message}」，关闭对应标签页 | Error |
| 目录扫描失败 | `FS_OUT_OF_SCOPE`, `FS_NOT_DIR`, `FS_IO_ERROR` | Toast 提示「目录加载失败：{message}」，清空文件树，状态栏显示「未加载目录」 | Error |
| 配置加载失败 | `CFG_DESERIALIZE`, `CFG_NO_DATA_DIR` | 静默使用 `Settings::default()`，不打扰用户 | Silent |
| 配置保存失败 | `CFG_SERIALIZE`, `FS_IO_ERROR` | Toast 提示「设置保存失败，下次启动可能丢失」 | Error |
| Watcher 创建失败 | `WATCH_START_FAIL` | 状态栏显示「实时更新已禁用」（橙色警告图标），文件树不再自动刷新 | Warning |
| Watcher 运行时断开 | `WATCH_RUNTIME` | 状态栏显示「文件监控异常」，自动尝试重建一次，失败则保持 Warning | Warning |
| 监控路径被删除 | `WATCH_PATH_GONE` | 状态栏显示「目录已不存在」，停止 watcher，文件树置空 | Warning |
| 搜索失败 | `SEARCH_TIMEOUT`, `SEARCH_INVALID_DIR`, `FS_IO_ERROR` | Toast 提示「搜索失败：{message}」，清空搜索结果面板 | Error |
| 保存文件失败 | `FS_IO_ERROR`, `FS_NO_PERMISSION`, `FS_TOO_LARGE` | Toast 提示「保存失败：{message}」，标签页保持修改状态（显示圆点） | Error |
| 路径遍历攻击检测 | `FS_INVALID_PATH` | Toast 提示「非法路径请求已阻止」（不暴露细节），记录安全日志 | Error |

#### 状态栏错误显示规范

状态栏左侧区域用于展示 Warning 级别错误（持续显示，错误恢复后自动清除）：

```
┌────────────────────────────────────────────────────────────────────┐
│ ⚠️ 实时更新已禁用           UTF-8 │ Markdown │ 5190 行 │  light  │
└────────────────────────────────────────────────────────────────────┘
```

- 图标颜色：`--accent-amber`（橙色）
- 文本颜色：`--text-secondary`
- 点击图标可展开完整错误信息浮层
- 错误恢复后（如重新成功启动 watcher），图标和文本自动消失

### 2.4 日志策略

#### 开发环境

| 层级 | Rust 后端 | 前端 |
|------|----------|------|
| Error | `tracing::error!`（含错误码 + 完整上下文） | `console.error('[AppError]', code, message, details)` |
| Warning | `tracing::warn!` | `console.warn('[AppWarn]', ...)` |
| Info | `tracing::info!` | `console.info`（可选） |

开发时启用 Tauri 的 `--verbose` 模式，Rust `tracing` 输出到终端，便于实时观察错误流。

#### 生产环境

- **Rust 后端**：使用 `tracing-appender` 将日志写入本地日志文件
  - macOS: `~/Library/Logs/com.mkpreview.app/mkpreview.log`
  - Windows: `%APPDATA%\MKPreview\logs\mkpreview.log`
  - 日志保留 7 天，按天轮转，单文件上限 10MB
- **前端**：生产环境关闭 `console.error`，仅通过 IPC 将关键错误上报到 Rust 日志系统

#### 日志内容规范

每条错误日志必须包含：
1. 时间戳（ISO 8601）
2. 错误码
3. 错误消息
4. 触发错误的 Command / 操作名
5. 相关路径或文件（如有）

```
2026-04-21T14:32:10+08:00 ERROR [FS_NOT_FOUND] 文件不存在: /Users/xxx/Knowledge/learn/deleted.md | command=read_file path=/Users/xxx/Knowledge/learn/deleted.md
```

---

## 3. 接口定义

### 3.1 错误传播接口

**后端 → 前端**：所有 Tauri Command 统一返回 `Result<T, AppError>`，通过 `ipc_result` 包装为 `Result<T, InvokeError>`。

| Command | 原返回错误 | 统一后返回 |
|---------|-----------|-----------|
| `scan_directory` | `DirScannerError` | `Result<Vec<FileTreeNode>, AppError>` |
| `read_file` | `FileServiceError` | `Result<String, AppError>` |
| `write_file` | `FileServiceError` | `Result<(), AppError>` |
| `get_file_meta` | `FileServiceError` | `Result<FileMeta, AppError>` |
| `start_watching` | `WatcherError` | `Result<(), AppError>` |
| `stop_watching` | `WatcherError` | `Result<(), AppError>` |
| `search_files` | `SearchError` | `Result<Vec<SearchResult>, AppError>` |
| `get_settings` | `ConfigError` | `Result<Settings, AppError>` |
| `save_settings` | `ConfigError` | `Result<(), AppError>` |

**后端事件中的错误**：`fs:error` 事件的载荷从简单的 `{"message": "..."}` 升级为 `ErrorResponse` 结构：

```rust
// file-watcher 中 emit 错误事件
app_handle.emit("fs:error", ErrorResponse {
    code: "WATCH_PATH_GONE".into(),
    message: format!("监控路径已不存在: {}", path),
    details: Some(json!({"path": path})),
});
```

### 3.2 前端错误处理接口

```typescript
// src/services/errorHandler.ts

export type ErrorLevel = 'fatal' | 'error' | 'warning' | 'silent';

/**
 * 根据错误码判断错误级别
 */
export function getErrorLevel(code: string): ErrorLevel;

/**
 * 统一错误处理入口
 * 根据级别决定展示方式
 */
export function handleError(err: AppException): void;

/**
 * 显示 Toast 通知（Error 级别）
 */
export function showToast(message: string, type: 'error' | 'success' | 'info'): void;

/**
 * 设置/清除状态栏警告（Warning 级别）
 */
export function setStatusBarWarning(id: string, message: string | null): void;

/**
 * 全屏错误页面（Fatal 级别）
 */
export function showFatalError(message: string, retry?: () => void): void;
```

---

## 4. 数据结构

### 4.1 Rust — AppError

```rust
// src-tauri/src/models/error.rs

#[derive(Debug, Error)]
pub enum AppError {
    #[error("IO错误: {0}")]
    Io(#[from] std::io::Error),

    #[error("文件不存在: {path}")]
    FileNotFound { path: String },

    #[error("路径不在允许范围内: {path}")]
    PathNotInScope { path: String },

    #[error("非法路径: {path}")]
    InvalidPath { path: String },

    #[error("不是Markdown文件: {path}")]
    NotAMarkdownFile { path: String },

    #[error("不是目录: {path}")]
    NotADirectory { path: String },

    #[error("写入内容过大: {size} 字节 (限制 10MB)")]
    FileTooLarge { size: usize },

    #[error("权限不足: {path}")]
    PermissionDenied { path: String },

    #[error("配置序列化失败: {0}")]
    ConfigSerialize(String),

    #[error("配置反序列化失败: {0}")]
    ConfigDeserialize(String),

    #[error("配置值非法: {0}")]
    InvalidSettings(String),

    #[error("应用数据目录获取失败")]
    AppDataDirNotFound,

    #[error("文件监控启动失败: {0}")]
    WatcherStart(String),

    #[error("文件监控运行时错误: {0}")]
    WatcherRuntime(String),

    #[error("监控路径已不存在: {path}")]
    WatcherPathGone { path: String },

    #[error("搜索目录非法: {path}")]
    InvalidSearchDirectory { path: String },

    #[error("搜索超时")]
    SearchTimeout,

    #[error("内部错误: {0}")]
    Internal(String),
}
```

### 4.2 Rust — ErrorResponse

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorResponse {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}
```

### 4.3 TypeScript — AppException

```typescript
// src/types/error.ts

export interface AppException {
  /** 错误码，如 FS_NOT_FOUND */
  code: string;
  /** 用户友好的错误消息 */
  message: string;
  /** 额外上下文数据（路径、大小等） */
  details?: Record<string, unknown>;
}
```

### 4.4 TypeScript — 错误码常量

```typescript
// src/types/error.ts

export const ErrorCodes = {
  // 文件系统
  FS_IO_ERROR: 'FS_IO_ERROR',
  FS_NOT_FOUND: 'FS_NOT_FOUND',
  FS_OUT_OF_SCOPE: 'FS_OUT_OF_SCOPE',
  FS_INVALID_PATH: 'FS_INVALID_PATH',
  FS_NOT_MD: 'FS_NOT_MD',
  FS_NOT_DIR: 'FS_NOT_DIR',
  FS_TOO_LARGE: 'FS_TOO_LARGE',
  FS_NO_PERMISSION: 'FS_NO_PERMISSION',

  // 配置
  CFG_SERIALIZE: 'CFG_SERIALIZE',
  CFG_DESERIALIZE: 'CFG_DESERIALIZE',
  CFG_INVALID_VALUE: 'CFG_INVALID_VALUE',
  CFG_NO_DATA_DIR: 'CFG_NO_DATA_DIR',

  // 监控
  WATCH_START_FAIL: 'WATCH_START_FAIL',
  WATCH_RUNTIME: 'WATCH_RUNTIME',
  WATCH_PATH_GONE: 'WATCH_PATH_GONE',

  // 搜索
  SEARCH_INVALID_DIR: 'SEARCH_INVALID_DIR',
  SEARCH_TIMEOUT: 'SEARCH_TIMEOUT',

  // 通用
  INTERNAL: 'INTERNAL',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
```

---

## 5. 依赖关系

### 5.1 Cargo.toml 依赖

```toml
[dependencies]
tauri = { version = "2.0", features = [] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "1.0"

# 日志（开发 + 生产）
tracing = "0.1"
tracing-appender = "0.2"  # 生产环境日志文件写入

# 各业务模块原有依赖保持不变
walkdir = "2.5"
notify = "6.1"
notify-debouncer-full = "0.3"
```

### 5.2 前置/后置依赖

| 关系 | Feature | 说明 |
|------|---------|------|
| 前置依赖 | F01-01（项目初始化） | Tauri Command 和 IPC 基础设施 |
| 前置依赖 | F02-01（目录扫描） | 需要统一错误类型替换 `DirScannerError` |
| 前置依赖 | F02-02（文件读写） | 需要统一错误类型替换 `FileServiceError` |
| 前置依赖 | F02-03（文件监控） | 需要统一错误类型替换 `WatcherError` |
| 前置依赖 | F02-04（全文搜索） | 需要统一错误类型替换 `SearchError` |
| 前置依赖 | F02-05（配置持久化） | 需要统一错误类型替换 `ConfigError` |
| 后置被依赖 | 所有后端/前端模块 | 所有 IPC 调用和事件均依赖本规范定义的错误结构 |

### 5.3 迁移路径

将分散错误类型迁移到 `AppError` 的步骤：

1. 创建 `src-tauri/src/models/error.rs`，定义 `AppError`、`ErrorResponse` 及转换逻辑
2. 各模块逐步替换原有错误枚举：
   - `DirScannerError` → `AppError`
   - `FileServiceError` → `AppError`
   - `ConfigError` → `AppError`
   - `SearchError` → `AppError`
3. Command handler 层统一使用 `ipc_result()` 包装返回值
4. 前端创建 `errorHandler.ts` 和 `types/error.ts`
5. 所有 `invoke` 调用迁移到 `invoke()` 封装函数

> 迁移期间允许新旧错误类型并存，但新增代码必须统一使用 `AppError`。

---

## 6. 测试要点

### 6.1 错误码映射正确性

| 场景 | 预期结果 |
|------|---------|
| `AppError::FileNotFound { path: "/a.md" }.error_code()` | 返回 `"FS_NOT_FOUND"` |
| `AppError::Io(std::io::Error::new(...)).error_code()` | 返回 `"FS_IO_ERROR"` |
| `AppError::SearchTimeout.error_code()` | 返回 `"SEARCH_TIMEOUT"` |
| `AppError::ConfigDeserialize("...".into()).details()` | 返回 `None` |
| `AppError::FileTooLarge { size: 20_000_000 }.details()` | 返回 `{"size": 20000000, "limit": 10485760}` |

### 6.2 前端错误分级正确性

| 错误码 | 预期级别 | 预期 UI 行为 |
|--------|---------|-------------|
| `FS_NOT_FOUND` | Error | Toast 弹出，5s 消失 |
| `CFG_DESERIALIZE` | Silent | 无任何 UI，仅日志 |
| `WATCH_START_FAIL` | Warning | 状态栏显示警告图标和文本 |
| `WATCH_PATH_GONE` | Warning | 状态栏显示警告，文件树置空 |
| `INTERNAL`（启动期） | Fatal | 全屏错误页 |
| `SEARCH_TIMEOUT` | Error | Toast 提示，清空搜索结果 |

### 6.3 错误降级策略有效性

| 场景 | 预期行为 |
|------|---------|
| 配置加载失败（JSON 损坏） | 应用正常启动，使用默认配置，不弹任何提示 |
| Watcher 启动失败 | 文件树仍可手动加载，仅实时更新不生效 |
| 搜索超时 | 已收集的部分结果展示，提示「搜索未完成」 |
| 单个文件读取失败 | 该标签关闭，其他已打开标签不受影响 |
| 目录扫描失败 | 文件树清空，用户可重新选择目录 |

### 6.4 日志输出完整性

| 场景 | 预期日志内容 |
|------|-------------|
| 文件读取失败 | 包含时间戳、ERROR 级别、`FS_NOT_FOUND`、完整路径、`command=read_file` |
| 配置加载失败 | 包含时间戳、WARN 级别、`CFG_DESERIALIZE`、原错误原因、自动回退默认值的提示 |
| Watcher 断开 | 包含时间戳、WARN 级别、`WATCH_RUNTIME`、自动重建尝试次数 |

### 6.5 IPC 错误传递完整性

| 场景 | 预期结果 |
|------|---------|
| Rust 返回 `AppError::FileNotFound` | 前端 `catch` 到的错误字符串可被 `JSON.parse` 为 `ErrorResponse` |
| 错误详情中的中文路径 | 前后端传递无乱码，前端正确显示 |
| 包含 `"` 和 `\` 的路径 | JSON 序列化/反序列化正确，无转义问题 |
