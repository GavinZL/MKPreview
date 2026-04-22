# F02-02 文件读写命令

## 1. 功能描述与目标

实现 `read_file`、`write_file`、`get_file_meta` 三个 Tauri Command，提供安全、高效的文件读写和元信息查询能力。

**核心目标**：
- `read_file`：读取 `.md` 文件原始 UTF-8 文本内容，返回给前端渲染
- `write_file`：将前端编辑后的内容原子写入磁盘（Phase 2 启用）
- `get_file_meta`：获取文件大小、修改时间、创建时间等元信息
- 所有操作支持中文路径，兼容 macOS `/` 和 Windows `\` 路径分隔符
- 大文件（> 5000 行，~216KB）读取不阻塞 UI

**关联需求**：FR-002、FR-002.1、FR-002.2、FR-005.4

---

## 2. 技术实现方案

### 2.1 Rust 模块组织

```
src-tauri/src/
├── commands/
│   └── file_system.rs       # read_file / write_file / get_file_meta
├── services/
│   └── file_service.rs      # 文件读写核心逻辑（可选封装层）
└── models/
    └── file_tree.rs         # FileMeta 定义
```

### 2.2 各命令实现要点

#### `read_file`

1. **路径校验**：规范化 + Scope 校验 + 路径遍历防护
2. **编码检测**：默认 UTF-8，遇到非法序列时尝试 `lossy` 替换（替换为 `U+FFFD`）
3. **大文件处理**：使用 `std::fs::read_to_string` 一次性读取（250 文件总 14MB，单文件最大 216KB，均在内存可承受范围）
4. **返回**：文件原始文本字符串

#### `write_file`（Phase 2）

1. **路径校验**：与 `read_file` 同样严格的校验流程
2. **原子写入**：使用临时文件 + `rename` 实现原子写入，避免写入过程中断电导致文件损坏
   ```rust
   let temp_path = path.with_extension("tmp");
   std::fs::write(&temp_path, content)?;
   std::fs::rename(&temp_path, path)?;
   ```
3. **权限校验**：确认 Tauri Capabilities 已声明 `fs:allow-write`
4. **返回**：`Ok(())` 或错误

#### `get_file_meta`

1. **路径校验**：同上
2. **元信息获取**：使用 `std::fs::metadata()` 获取 `len`、`modified`、`created`
3. **时间戳转换**：`SystemTime` → Unix 毫秒时间戳（`u64`），便于前端直接消费

### 2.3 安全策略

| 安全层面 | 策略 |
|---------|------|
| 路径遍历防护 | 拒绝含 `..` 的输入；`canonicalize` 后二次校验 |
| Scope 校验 | 校验目标文件路径在已授权 FS Scope 内 |
| 写入权限隔离 | `write_file` 仅在 Phase 2 启用，需追加 `fs:allow-write` Capability |
| 文件类型限制 | 校验目标文件扩展名为 `.md`，拒绝读写其他类型文件 |
| 大小限制 | 单次写入内容大小限制为 10MB，防止恶意超大写入 |

### 2.4 错误处理策略

定义自定义错误枚举 `FileServiceError`：

```rust
pub enum FileServiceError {
    InvalidPath(String),       // 路径包含非法序列
    PathNotInScope(String),    // 路径不在 FS Scope 内
    NotAMarkdownFile(String),  // 扩展名不是 .md
    FileNotFound(String),      // 文件不存在
    ReadError(String),         // IO 读取错误
    WriteError(String),        // IO 写入错误
    PermissionDenied(String),  // 权限不足
    FileTooLarge(String),      // 写入内容超过 10MB
}
```

统一实现 `std::fmt::Display`，Tauri 自动转换为前端可接收的字符串错误。

---

## 3. 接口定义

### 3.1 Tauri IPC Command

**Rust 端签名**：

```rust
/// 读取文件 UTF-8 内容
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, FileServiceError>;

/// 写入文件内容（Phase 2）
#[tauri::command]
pub async fn write_file(
    path: String,
    content: String,
) -> Result<(), FileServiceError>;

/// 获取文件元信息
#[tauri::command]
pub async fn get_file_meta(path: String) -> Result<FileMeta, FileServiceError>;
```

**TypeScript 前端调用**：

```typescript
import { invoke } from '@tauri-apps/api/core';

// 读取文件
const content: string = await invoke('read_file', {
  path: '/Users/xxx/Knowledge/learn/Cpp_Language/01_类型系统/01_基础类型.md'
});

// 写入文件（Phase 2）
await invoke('write_file', {
  path: '/Users/xxx/Knowledge/learn/Cpp_Language/01_类型系统/01_基础类型.md',
  content: '# 更新后的内容\n\n...'
});

// 获取元信息
const meta: FileMeta = await invoke('get_file_meta', {
  path: '/Users/xxx/Knowledge/learn/Cpp_Language/01_类型系统/01_基础类型.md'
});
```

### 3.2 接口参数与返回类型

| Command | 参数 | 返回类型 |
|---------|------|---------|
| `read_file` | `path: String` | `String`（文件 UTF-8 内容） |
| `write_file` | `path: String, content: String` | `()` |
| `get_file_meta` | `path: String` | `FileMeta` |

---

## 4. 数据结构

### 4.1 Rust Struct 定义

```rust
// src-tauri/src/models/file_tree.rs

use serde::{Deserialize, Serialize};

/// 文件元信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMeta {
    /// 文件绝对路径
    pub path: String,
    /// 文件大小（字节）
    pub size: u64,
    /// 最后修改时间（Unix 毫秒时间戳，Rust u64 ↔ TS number）
    /// 注：JS number 为 IEEE 754 双精度浮点，可精确表示整数范围达 2^53（~9e15），
    ///     毫秒时间戳在可精确表示范围内，故 TS 端使用 number 类型
    pub modified: u64,
    /// 创建时间（Unix 毫秒时间戳，Rust u64 ↔ TS number）
    /// 注：JS number 精度足够表示毫秒时间戳（详见 modified 字段说明）
    pub created: u64,
}
```

### 4.2 TypeScript Interface

```typescript
// src/types/fileTree.ts

export interface FileMeta {
  path: string;
  size: number;
  modified: number;
  created: number;
}
```

### 4.3 辅助类型

```rust
/// 写入请求（可选，用于批量写入扩展）
#[derive(Debug, Deserialize)]
pub struct WriteFileRequest {
    pub path: String,
    pub content: String,
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

# 可选：用于更精确的编码检测（如需要支持 GBK 等非 UTF-8 文件）
# encoding_rs = "0.8"
```

### 5.2 前置/后置 Feature 依赖

| 关系 | Feature | 说明 |
|------|---------|------|
| 前置依赖 | F01-01（项目初始化） | Tauri Command 基础设施 |
| 前置依赖 | F01-01（Capabilities） | `fs:allow-read` 权限声明 |
| 前置依赖 | F02-01（目录扫描） | `scan_directory` 返回的文件路径作为本模块输入 |
| 后置被依赖 | F05-01（单文件展示） | 前端调用 `read_file` 加载文件内容 |
| 后置被依赖 | F07-04（文件保存） | Phase 2 编辑功能调用 `write_file` |
| 后置被依赖 | F03-03（状态栏） | 调用 `get_file_meta` 显示文件大小信息 |

### 5.3 Phase 2 追加配置

启用 `write_file` 时，需在 `src-tauri/capabilities/default.json` 追加：

```json
{
  "identifier": "fs:allow-write",
  "allow": [{ "path": "$APPDATA/*" }, { "path": "**/*" }]
}
```

> `**/*` 为动态 Scope，实际运行时仅允许已授权目录下的写入。

---

## 6. 测试要点

### 6.1 功能测试

| 场景 | 预期结果 |
|------|---------|
| 读取正常 UTF-8 编码的 .md 文件 | 返回完整文本内容 |
| 读取含中文路径的文件 | 正确解析路径，返回内容无乱码 |
| 读取含 emoji 的文件 | 正确返回，无编码错误 |
| 读取 5000+ 行大文件 | 正常返回，耗时 < 100ms |
| `get_file_meta` | 返回正确 size、modified、created |
| `write_file` 写入后读取 | 内容一致，文件编码保持 UTF-8 |
| `write_file` 写入过程中进程崩溃 | 原文件保持完整（原子写入保护） |

### 6.2 安全测试

| 场景 | 预期结果 |
|------|---------|
| 传入路径含 `../` | 拒绝，返回 `InvalidPath` |
| 传入路径指向 Scope 外 | 拒绝，返回 `PathNotInScope` |
| 传入 `.txt` / `.exe` 等非 .md 文件 | 拒绝，返回 `NotAMarkdownFile` |
| `write_file` 传入 > 10MB 内容 | 拒绝，返回 `FileTooLarge` |
| 读取不存在的文件 | 返回 `FileNotFound` |
| 写入到只读目录 | 返回 `PermissionDenied` |

### 6.3 边界条件

| 场景 | 预期结果 |
|------|---------|
| 读取空文件 | 返回空字符串 `""` |
| 写入空内容 | 文件被清空 |
| 文件被外部进程锁定 | 返回 `ReadError` / `WriteError`，前端提示用户 |
| 磁盘空间不足 | `write_file` 返回 `WriteError` |
| 路径长度超过系统限制（Windows MAX_PATH） | 返回 `InvalidPath` |

### 6.4 跨平台测试

| 场景 | macOS | Windows |
|------|-------|---------|
| 中文路径 | 支持 | 支持 |
| 长路径（>260 字符） | 支持 | 支持（启用 extended-length path） |
| 路径分隔符 | `/` | `\` 或 `/` 均支持 |
| 权限模型 | Unix rwx | ACL / 只读属性 |
