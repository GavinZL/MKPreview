# F02-04 全文搜索服务 [Phase 2]

## 1. 功能描述与目标

实现 `search_files` Tauri Command，在已加载的知识库目录中同时支持**文件名模糊匹配**和**全文内容搜索**，返回带有上下文摘要的搜索结果列表。

**核心目标**：
- 文件名搜索：模糊匹配文件路径和名称（支持中英文）
- 全文搜索：递归读取所有 `.md` 文件内容，匹配搜索关键词
- 搜索结果展示：文件路径 + 匹配行号 + 上下文摘要（匹配行前后各 2 行）
- 支持中文搜索（按字符匹配，无需分词）
- 性能目标：250 文件 / 14MB 数据搜索 < 2s

**关联需求**：FR-008、FR-008.1 ~ FR-008.5

---

## 2. 技术实现方案

### 2.1 Rust 模块组织

```
src-tauri/src/
├── commands/
│   └── search.rs            # #[tauri::command] pub fn search_files
├── services/
│   └── search_engine.rs     # 搜索核心逻辑
└── models/
    └── search_result.rs     # SearchResult / SearchOptions 定义
```

### 2.2 搜索算法设计

#### 文件名搜索

- 将搜索关键词和文件名均转为小写（Unicode-aware `to_lowercase`）
- 使用 `contains` 进行子串匹配（模糊匹配）
- 同时匹配文件名和完整路径（用户可能记得部分路径）

#### 全文内容搜索

- 遍历目录下所有 `.md` 文件
- 逐行读取文件内容（`BufReader` 按行读取，避免大文件全量加载）
- 将行内容和搜索关键词均转为小写后匹配
- 命中时提取：行号 + 当前行内容 + 前后各 2 行上下文

#### 优化策略

| 优化点 | 实现方式 |
|--------|---------|
| 避免重复扫描目录 | 复用 `scan_directory` 结果缓存的文件列表 |
| 大文件处理 | 按行流式读取，不一次性加载大文件到内存 |
| 提前终止 | 单文件匹配数达到上限（如 10 条）后停止该文件搜索 |
| 并发搜索 | 使用 `rayon` 并行搜索多个文件（CPU 密集型） |
| 结果去重 | 同一文件的多个匹配行分别展示，不合并 |

### 2.3 安全策略

| 安全层面 | 策略 |
|---------|------|
| 路径遍历防护 | 搜索目录路径经 `canonicalize` + Scope 校验 |
| 搜索范围限制 | 仅搜索 `.md` 文件，不读取其他类型文件 |
| 搜索深度限制 | 递归深度不超过 10 层，防止符号链接循环 |
| 超时保护 | 单次搜索超时 10s，超时返回已收集结果 |

### 2.4 错误处理策略

定义 `SearchError`：

```rust
pub enum SearchError {
    InvalidDirectory(String),
    DirectoryNotInScope(String),
    IoError(String),
    Timeout,
}
```

---

## 3. 接口定义

### 3.1 Tauri IPC Command

**Rust 端签名**：

```rust
#[tauri::command]
pub async fn search_files(
    dir: String,
    query: String,
) -> Result<Vec<SearchResult>, SearchError>;
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `dir` | `String` | 搜索根目录绝对路径 |
| `query` | `String` | 搜索关键词（支持中英文） |

| 返回 | 类型 | 说明 |
|------|------|------|
| 成功 | `Vec<SearchResult>` | 搜索结果列表（按相关性排序） |
| 失败 | `SearchError` | 错误信息 |

**TypeScript 前端调用**：

```typescript
import { invoke } from '@tauri-apps/api/core';

const results: SearchResult[] = await invoke('search_files', {
  dir: '/Users/xxx/Knowledge/learn',
  query: '生命周期'
});
```

### 3.2 排序策略

结果按以下优先级排序：

1. **文件名完全匹配** > **文件名包含** > **全文内容匹配**
2. 相同类型下按文件路径字母顺序排列
3. 同一文件内的多个匹配按行号升序排列

---

## 4. 数据结构

### 4.1 Rust Struct 定义

```rust
// src-tauri/src/models/search_result.rs

use serde::{Deserialize, Serialize};

/// 搜索结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    /// 文件绝对路径
    pub path: String,
    /// 匹配行号（1-based）
    pub line_number: u32,
    /// 匹配上下文摘要（包含当前行及前后各 2 行）
    pub context: String,
    /// 是否为文件名匹配（true = 文件名匹配，false = 内容匹配）
    pub is_file_name_match: bool,
}

/// 搜索选项（未来扩展）
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchOptions {
    pub query: String,
    pub case_sensitive: Option<bool>,
    pub max_results: Option<u32>,
}
```

### 4.2 TypeScript Interface

```typescript
// src/types/search.ts

export interface SearchResult {
  path: string;
  lineNumber: number;
  context: string;
  isFileNameMatch: boolean;
}

export interface SearchOptions {
  query: string;
  caseSensitive?: boolean;
  maxResults?: number;
}
```

### 4.3 上下文格式

```
上下文摘要格式（5 行，当前行以 >>> 标记）：

上一行内容
当前行内容 >>> 匹配关键词在此处
下一行内容
```

实际存储为纯文本字符串，前端展示时高亮匹配关键词。

---

## 5. 依赖关系

### 5.1 Cargo.toml 依赖

```toml
[dependencies]
tauri = { version = "2.0", features = [] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
walkdir = "2.5"

# 并行搜索（可选优化）
rayon = "1.10"

# 可选：更高级的文本搜索
# regex = "1.10"  # 如需正则搜索支持
```

### 5.2 前置/后置 Feature 依赖

| 关系 | Feature | 说明 |
|------|---------|------|
| 前置依赖 | F01-01（项目初始化） | Tauri Command 基础设施 |
| 前置依赖 | F02-01（目录扫描） | 复用目录遍历逻辑获取文件列表 |
| 前置依赖 | F02-02（文件读写） | 复用文件读取逻辑和安全校验 |
| 后置被依赖 | F04-03（树搜索过滤） | 文件名搜索可为前端树过滤提供后端加速 |
| 后置被依赖 | F04-05（全局搜索面板） | 前端全局搜索 UI 调用 `search_files` |

---

## 6. 测试要点

### 6.1 功能测试

| 场景 | 预期结果 |
|------|---------|
| 搜索文件名中的关键词 | 返回文件名匹配结果，`isFileNameMatch = true` |
| 搜索文件内容中的关键词 | 返回内容匹配结果，含正确行号和上下文 |
| 搜索中文关键词 | 正确匹配中文内容 |
| 搜索大小写混合关键词 | 默认不区分大小写，均匹配 |
| 关键词为空字符串 | 返回空数组 `[]` |
| 搜索无结果的关键词 | 返回空数组 `[]` |

### 6.2 边界条件

| 场景 | 预期结果 |
|------|---------|
| 搜索目录下无 .md 文件 | 返回空数组 |
| 搜索超大文件（216KB / 5190 行） | 流式读取，不OOM，正常返回匹配 |
| 关键词匹配文件首行 / 末行 | 上下文不足时仅返回可用行 |
| 同一文件多处匹配 | 每处匹配独立返回一条结果 |
| 搜索结果超过 100 条 | 返回前 100 条，前端提示"结果过多" |
| 搜索过程中目录被删除 | 优雅处理，返回已收集结果 |

### 6.3 性能测试

| 场景 | 目标值 | 测试方法 |
|------|--------|---------|
| 250 文件 / 14MB 全文搜索 | < 2s | 冷启动搜索 |
| 相同关键词二次搜索 | < 500ms | 复用文件列表缓存 |
| 单个大文件（216KB）搜索 | < 200ms | 单独测试 |
| 并发搜索内存占用 | < 50MB | `rayon` 线程池 + BufReader |
| 搜索超时保护 | 10s 后返回部分结果 | 模拟超大目录 |

### 6.4 安全测试

| 场景 | 预期结果 |
|------|---------|
| 搜索目录含 `../` | 拒绝，返回 `InvalidDirectory` |
| 搜索目录不在 Scope 内 | 拒绝，返回 `DirectoryNotInScope` |
| 搜索结果包含文件内容 | 仅返回匹配上下文，不泄露完整文件内容 |
| 搜索符号链接循环目录 | 深度限制 10 层，防止无限递归 |
