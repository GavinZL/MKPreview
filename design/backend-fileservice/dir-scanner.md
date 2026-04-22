# F02-01 目录扫描服务

## 1. 功能描述与目标

实现 `scan_directory` Tauri Command，递归扫描用户指定的根目录，构建仅包含 Markdown 文件的目录树结构，返回给前端用于文件树展示。

**核心目标**：
- 递归扫描目录，仅保留 `.md` 文件和包含 `.md` 文件的目录（过滤空目录和非 Markdown 文件）
- 支持数字前缀自然排序（如 `01_xxx` < `02_xxx` < `10_xxx`）
- 忽略隐藏/无关目录（`.git`、`node_modules`、`.DS_Store` 等）
- 性能目标：250 文件 / 100 目录的树构建 < 200ms
- 安全目标：防止路径遍历攻击，限制在已授权的 FS Scope 内

**关联需求**：FR-001、FR-001.3、FR-001.4、FR-001.5

---

## 2. 技术实现方案

### 2.1 Rust 模块组织

```
src-tauri/src/
├── commands/
│   └── file_system.rs       # #[tauri::command] pub fn scan_directory
├── services/
│   └── dir_scanner.rs       # 扫描核心逻辑
└── models/
    └── file_tree.rs         # FileTreeNode 定义
```

### 2.2 核心扫描流程

1. **路径校验**：规范化输入路径，验证其在 Tauri FS Scope 内
2. **递归遍历**：使用 `walkdir` 递归遍历目录
3. **过滤规则**：跳过隐藏/无关目录；仅保留 `.md` 文件和含 `.md` 子项的目录
4. **排序**：对每个目录下的子项进行自然排序（数字感知）
5. **计数**：递归计算每个目录下的 `.md` 文件总数
6. **序列化**：通过 `serde` 序列化为 JSON 返回前端

### 2.3 安全策略

| 安全层面 | 策略 |
|---------|------|
| 路径遍历防护 | 拒绝包含 `..` 的原始输入；`canonicalize` 后再次校验 |
| Scope 校验 | 校验规范化后的路径在已授权的 Tauri FS Scope 内 |
| 符号链接过滤 | `walkdir` 配置 `follow_links(false)`，防止逃逸出用户目录 |
| 目录逃逸防护 | 拒绝绝对路径指向系统敏感目录（如 `/System`、`C:\Windows`） |

### 2.4 错误处理策略

定义自定义错误枚举 `DirScannerError`，统一转换为 Tauri 的 `Result<T, String>`：

- `InvalidPath` — 路径包含非法字符或路径遍历序列
- `PathNotInScope` — 路径不在已授权的 FS Scope 内
- `IoError` — 底层 IO 错误（权限不足、目录不存在等）
- `NotADirectory` — 传入路径不是目录

---

## 3. 接口定义

### 3.1 Tauri IPC Command

**Rust 端**：

```rust
#[tauri::command]
pub async fn scan_directory(
    app: tauri::AppHandle,
    path: String,
) -> Result<Vec<FileTreeNode>, DirScannerError>;
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `path` | `String` | 用户选择的根目录绝对路径 |

| 返回 | 类型 | 说明 |
|------|------|------|
| 成功 | `Vec<FileTreeNode>` | 目录树根节点数组（通常只有一个根节点） |
| 失败 | `DirScannerError` | 错误信息字符串化后返回前端 |

**TypeScript 前端调用**：

```typescript
import { invoke } from '@tauri-apps/api/core';

const treeNodes: FileTreeNode[] = await invoke('scan_directory', {
  path: '/Users/xxx/Knowledge/learn'
});
```

### 3.2 前端事件

本特性不主动推送事件，扫描结果通过 `invoke` 同步返回。

---

## 4. 数据结构

### 4.1 Rust Struct 定义

```rust
// src-tauri/src/models/file_tree.rs

use serde::{Deserialize, Serialize};

/// 文件树节点
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileTreeNode {
    /// 文件或目录名称
    pub name: String,
    /// 绝对路径
    pub path: String,
    /// 是否为目录
    pub is_dir: bool,
    /// 子节点列表（仅目录有效）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileTreeNode>>,
    /// 目录下递归统计的 .md 文件数量（仅目录有效）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_count: Option<u32>,
}

/// 扫描请求参数
#[derive(Debug, Deserialize)]
pub struct ScanDirectoryRequest {
    pub path: String,
}
```

### 4.2 TypeScript Interface

```typescript
// src/types/fileTree.ts

export interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileTreeNode[];
  fileCount?: number;
}
```

### 4.3 Serde 配置说明

- `#[serde(rename_all = "camelCase")]`：所有 IPC 返回的 JSON 字段名使用 camelCase，与 TypeScript interface 对应（如 `is_dir` → `isDir`、`file_count` → `fileCount`）
- `skip_serializing_if = "Option::is_none"`：减少 JSON 体积，叶子节点的 `children` 和 `fileCount` 不序列化
- 数值类型：`file_count` 使用 `u32`（与 TS `number` 对应），避免 `usize` 在跨平台（64位/32位）序列化时不一致

---

## 5. 依赖关系

### 5.1 Cargo.toml 依赖

```toml
[dependencies]
tauri = { version = "2.0", features = [] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
walkdir = "2.5"

# 自然排序
normpath = "1.1"  # 或手写自然排序算法
```

> **注**：自然排序逻辑较简单（提取数字段逐段比较），可在 `services/dir_scanner.rs` 中手写实现，无需额外 crate。

### 5.2 前置/后置 Feature 依赖

| 关系 | Feature | 说明 |
|------|---------|------|
| 前置依赖 | F01-01（项目初始化） | 需要 Tauri 项目脚手架和 `tauri::command` 基础设施 |
| 前置依赖 | F01-01（Capabilities 配置） | FS Scope 权限声明（`fs:allow-read`、`dialog:allow-open`） |
| 后置被依赖 | F02-03（文件系统监控） | 监控服务需要知道已扫描的根目录路径 |
| 后置被依赖 | F04-01（文件树核心组件） | 前端文件树组件调用 `scan_directory` 获取数据 |

---

## 6. 测试要点

### 6.1 功能测试

| 场景 | 预期结果 |
|------|---------|
| 扫描包含 250 文件 / 100 目录的知识库 | 返回完整树结构，耗时 < 200ms |
| 目录下存在空子目录 | 空子目录被过滤，不返回 |
| 目录下仅有非 .md 文件 | 该目录被过滤，不返回 |
| 文件名含数字前缀（`01_`、`10_`、`2_`） | 按自然排序：`01_` < `02_` < `10_` |
| 中文文件名 | 正确编码，无乱码 |
| 深层嵌套目录（>5 层） | 正确递归，不栈溢出 |

### 6.2 安全测试

| 场景 | 预期结果 |
|------|---------|
| 传入路径含 `../` | 拒绝，返回 `InvalidPath` |
| 传入路径为符号链接指向 Scope 外 | `follow_links(false)`，按链接本身处理或跳过 |
| 传入路径不在已授权 FS Scope 内 | 拒绝，返回 `PathNotInScope` |
| 传入文件路径而非目录 | 拒绝，返回 `NotADirectory` |
| 传入不存在的路径 | 拒绝，返回 `IoError` |

### 6.3 边界条件

| 场景 | 预期结果 |
|------|---------|
| 根目录下没有任何 .md 文件 | 返回空数组 `[]` |
| 单个超大目录（1000+ 子项） | 正常完成，关注内存占用 |
| 目录权限不足 | 优雅报错，不崩溃 |
| 文件名含特殊字符（emoji、空格） | 正确处理 |

### 6.4 性能指标

| 指标 | 目标值 | 测试方法 |
|------|--------|---------|
| 扫描 250 文件 / 100 目录 | < 200ms | `std::time::Instant` 计时 |
| 序列化后 JSON 大小 | < 500KB | 估算节点元数据体积 |
| 内存峰值 | < 10MB | 扫描过程临时数据结构 |
