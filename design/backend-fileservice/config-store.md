# F02-05 配置持久化服务

## 1. 功能描述与目标

实现 `get_settings` / `save_settings` Tauri Command，将用户配置（主题偏好、最近目录、窗口状态等）以 JSON 格式持久化存储到系统应用数据目录，支持应用重启后恢复用户偏好。

**核心目标**：
- `get_settings`：读取已保存的用户配置，首次启动时返回默认值
- `save_settings`：将用户配置原子写入 JSON 文件
- 配置存储位置：系统应用数据目录（macOS: `~/Library/Application Support/MKPreview/`，Windows: `%APPDATA%\MKPreview\`）
- 配置格式：JSON，便于人工查看和调试
- 读写安全：原子写入防止配置损坏，JSON 解析失败时回退到默认值

**关联需求**：FR-001.7（记住上次打开的目录）、FR-007（主题与外观）、FR-008.3（配置持久化）

---

## 2. 技术实现方案

### 2.1 Rust 模块组织

```
src-tauri/src/
├── commands/
│   └── settings.rs          # get_settings / save_settings
├── services/
│   └── config_store.rs      # JSON 文件读写、默认值管理
└── models/
    └── settings.rs          # Settings struct 定义
```

### 2.2 存储路径设计

| 平台 | 配置目录 | 配置文件 |
|------|---------|---------|
| macOS | `~/Library/Application Support/com.mkpreview.app/` | `settings.json` |
| Windows | `%APPDATA%\MKPreview\` | `settings.json` |
| Linux | `~/.config/MKPreview/` | `settings.json` |

使用 `tauri::api::path::app_data_dir` 或 `dirs` crate 获取平台适配的应用数据目录。

### 2.3 读写策略

#### `get_settings`

1. 获取应用数据目录
2. 检查 `settings.json` 是否存在
   - 不存在：创建默认配置并保存，返回默认值
   - 存在：读取文件内容，解析 JSON
3. JSON 解析失败时：记录错误日志，返回默认值（不删除原文件，保留供调试）
4. 字段缺失时：使用默认值填充（向前兼容旧版本配置）

#### `save_settings`

1. 校验传入的 `Settings` 结构合法性（如主题值在枚举范围内）
2. 获取应用数据目录
3. **原子写入**：
   ```rust
   let config_dir = app_data_dir();
   let temp_path = config_dir.join("settings.json.tmp");
   let final_path = config_dir.join("settings.json");
   
   let json = serde_json::to_string_pretty(&settings)?;
   std::fs::write(&temp_path, json)?;
   std::fs::rename(&temp_path, &final_path)?;
   ```
4. 确保目录存在（`create_dir_all`）

### 2.4 安全策略

| 安全层面 | 策略 |
|---------|------|
| 目录隔离 | 配置仅存储在应用数据目录，不读写其他位置 |
| 权限最小化 | 使用 Tauri `fs:allow-read` / `fs:allow-write`，Scope 限定 `$APPDATA` |
| 配置校验 | 反序列化时校验字段范围（如主题只能是 `light`/`dark`/`system`） |
| 原子写入 | 临时文件 + rename，防止写入中断导致配置损坏 |
| 大小限制 | 序列化后 JSON 不超过 1MB |

### 2.5 错误处理策略

定义 `ConfigError`：

```rust
pub enum ConfigError {
    IoError(String),           // 文件读写失败
    SerializeError(String),    // JSON 序列化失败
    DeserializeError(String),  // JSON 反序列化失败
    InvalidSettings(String),   // 配置值非法
    DirNotFound(String),       // 应用数据目录获取失败
}
```

`get_settings` 对非致命错误（如文件不存在、解析失败）返回默认值而非错误，保证应用始终可启动。

---

## 3. 接口定义

### 3.1 Tauri IPC Command

**Rust 端签名**：

```rust
/// 读取用户配置
#[tauri::command]
pub async fn get_settings(
    app: tauri::AppHandle,
) -> Result<Settings, ConfigError>;

/// 保存用户配置
#[tauri::command]
pub async fn save_settings(
    app: tauri::AppHandle,
    settings: Settings,
) -> Result<(), ConfigError>;
```

**TypeScript 前端调用**：

```typescript
import { invoke } from '@tauri-apps/api/core';

// 读取配置
const settings: Settings = await invoke('get_settings');

// 保存配置
await invoke('save_settings', {
  settings: {
    theme: 'dark',
    fontSize: 16,
    recentDirectories: ['/Users/xxx/Knowledge/learn'],
    // ...
  }
});
```

---

## 4. 数据结构

### 4.1 Rust Struct 定义

```rust
// src-tauri/src/models/settings.rs

use serde::{Deserialize, Serialize};

/// 主题偏好
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ThemePreference {
    #[default]
    System,
    Light,
    Dark,
}

/// 窗口状态
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowState {
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub maximized: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            width: 1200,
            height: 800,
            x: 0,
            y: 0,
            maximized: false,
        }
    }
}

/// 用户配置（完整结构）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    /// 主题偏好：system / light / dark
    #[serde(default)]
    pub theme: ThemePreference,
    /// 正文字号（px）
    #[serde(default = "default_font_size")]
    pub font_size: u8,
    /// 代码字号（px）
    #[serde(default = "default_code_font_size")]
    pub code_font_size: u8,
    /// 最近打开的目录列表（最多 10 个）
    #[serde(default)]
    pub recent_directories: Vec<String>,
    /// 最后打开的目录路径
    #[serde(default)]
    pub last_directory: Option<String>,
    /// 文件树展开状态（路径 -> 是否展开）
    #[serde(default)]
    pub tree_expanded_state: std::collections::HashMap<String, bool>,
    /// 窗口状态
    #[serde(default)]
    pub window_state: WindowState,
    /// 文件树面板宽度（px）
    #[serde(default = "default_sidebar_width")]
    pub sidebar_width: u16,
    /// 是否显示行号
    #[serde(default = "default_true")]
    pub show_line_numbers: bool,
    /// 自动保存开关
    #[serde(default = "default_false")]
    pub auto_save: bool,
    /// 自动保存间隔（秒）
    #[serde(default = "default_auto_save_interval")]
    pub auto_save_interval: u16,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: ThemePreference::default(),
            font_size: default_font_size(),
            code_font_size: default_code_font_size(),
            recent_directories: Vec::new(),
            last_directory: None,
            tree_expanded_state: std::collections::HashMap::new(),
            window_state: WindowState::default(),
            sidebar_width: default_sidebar_width(),
            show_line_numbers: default_true(),
            auto_save: default_false(),
            auto_save_interval: default_auto_save_interval(),
        }
    }
}

// 默认值辅助函数
fn default_font_size() -> u8 { 16 }
fn default_code_font_size() -> u8 { 14 }
fn default_sidebar_width() -> u16 { 260 }
fn default_true() -> bool { true }
fn default_false() -> bool { false }
fn default_auto_save_interval() -> u16 { 3 }
```

### 4.2 TypeScript Interface

```typescript
// src/types/settings.ts

export type ThemePreference = 'system' | 'light' | 'dark';

export interface WindowState {
  width: number;
  height: number;
  x: number;
  y: number;
  maximized: boolean;
}

export interface Settings {
  theme: ThemePreference;
  fontSize: number;
  codeFontSize: number;
  recentDirectories: string[];
  lastDirectory: string | null;
  treeExpandedState: Record<string, boolean>;
  windowState: WindowState;
  sidebarWidth: number;
  showLineNumbers: boolean;
  autoSave: boolean;
  autoSaveInterval: number;
}
```

### 4.3 Serde 配置说明

- `#[serde(default)]`：字段缺失时使用默认值，保证向前兼容
- `#[serde(rename_all = "camelCase")]`：Rust snake_case ↔ TS camelCase
- `#[serde(rename_all = "lowercase")]`：枚举序列化为小写字符串
- `serde_json::to_string_pretty`：生成带缩进的 JSON，便于人工查看

---

## 5. 依赖关系

### 5.1 Cargo.toml 依赖

```toml
[dependencies]
tauri = { version = "2.0", features = [] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# 平台适配目录获取（Tauri 2.0 已内置 path API，可不用额外 crate）
# dirs = "5.0"  # 备选方案
```

### 5.2 前置/后置 Feature 依赖

| 关系 | Feature | 说明 |
|------|---------|------|
| 前置依赖 | F01-01（项目初始化） | Tauri Command 基础设施；Capabilities 中声明 `$APPDATA` 访问权限 |
| 后置被依赖 | F04-01（文件树核心组件） | 启动时通过 `get_settings` 恢复 `last_directory` 和 `tree_expanded_state` |
| 后置被依赖 | F08-02（主题切换） | 主题偏好通过 `get_settings` / `save_settings` 持久化 |
| 后置被依赖 | F08-04（配置持久化与恢复） | 完整的配置恢复方案依赖本服务 |
| 后置被依赖 | F03-01（应用布局） | 窗口尺寸和侧边栏宽度持久化 |

### 5.3 Tauri Capabilities 配置

在 `src-tauri/capabilities/default.json` 中声明：

```json
{
  "identifier": "fs:allow-read",
  "allow": [{ "path": "$APPDATA/*" }]
},
{
  "identifier": "fs:allow-write",
  "allow": [{ "path": "$APPDATA/*" }]
}
```

---

## 6. 测试要点

### 6.1 功能测试

| 场景 | 预期结果 |
|------|---------|
| 首次启动，`settings.json` 不存在 | 返回 `Settings::default()`，并自动创建配置文件 |
| 保存配置后读取 | 返回保存的值，与写入一致 |
| 保存后重启应用再读取 | 正确恢复上次保存的配置 |
| 更新部分字段后保存 | 未修改字段保持原值 |

### 6.2 边界条件

| 场景 | 预期结果 |
|------|---------|
| `settings.json` 被用户手动修改为非法 JSON | 返回默认值，不崩溃，记录错误日志 |
| `settings.json` 缺少部分字段 | 缺失字段使用默认值，保留已有字段 |
| `settings.json` 包含未知字段 | 忽略未知字段，正常解析已知字段 |
| 应用数据目录无写入权限 | 返回 `IoError`，前端提示用户 |
| 保存时磁盘空间不足 | 原子写入失败，返回 `IoError`，原配置不损坏 |
| `recent_directories` 超过 10 个 | 保存时截断为最近 10 个 |
| `settings.json` 大小超过 1MB | 正常读写，但记录警告日志 |

### 6.3 跨平台测试

| 场景 | macOS | Windows |
|------|-------|---------|
| 配置目录位置 | `~/Library/Application Support/` | `%APPDATA%\MKPreview\` |
| 中文路径存储 | 正确序列化/反序列化 | 正确序列化/反序列化 |
| 路径分隔符 | 存储为 `/` | 存储为 `\`（或统一使用 `/`） |

### 6.4 兼容性测试

| 场景 | 预期结果 |
|------|---------|
| 旧版本配置（缺少新字段） | 新字段使用默认值，旧字段保留 |
| 新版本配置在旧版应用读取 | 忽略未知字段，正常启动 |
| 配置字段类型变更（如 `u8` → `u16`） | JSON 数字无精度损失，正常解析 |
