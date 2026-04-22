# F01-01 Tauri + Vue 项目初始化

## 1. 功能描述与目标

本特性完成 MKPreview 桌面应用的底层项目骨架搭建，包含 Rust 后端（Tauri 2.0）和前端（Vue 3 + TypeScript + Pinia）两个部分的初始化。目标是建立一个可运行的最小 Tauri 应用，具备正确的窗口配置、安全权限模型和前端渲染能力，为后续所有功能模块提供基础运行环境。

**达成目标**：
- 执行 `npm run tauri dev` 可成功启动开发环境，显示空白应用窗口
- Rust 后端编译通过，Tauri IPC 通道就绪
- 前端 Vue 3 应用正确挂载，Pinia 状态管理可用
- 安全权限按最小原则配置，FS Scope 限定用户选择目录

## 2. 技术实现方案

### 2.1 初始化步骤

**前置条件**：已安装 Node.js (>=18)、Rust (>=1.70)、Cargo。

**工具链版本锁定**：

```bash
# .nvmrc — 锁定 Node 20 LTS
echo "20" > .nvmrc

# rust-toolchain.toml — 锁定 Rust stable 1.75+
cat > src-tauri/rust-toolchain.toml << 'EOF'
[toolchain]
channel = "stable"
components = ["rustfmt", "clippy"]
targets = ["aarch64-apple-darwin", "x86_64-apple-darwin", "x86_64-pc-windows-msvc"]
EOF
```

> **说明**：
> - `.nvmrc` 确保团队成员和 CI 使用一致的 Node 版本（20 LTS）
> - `rust-toolchain.toml` 确保 Rust 编译器版本一致（stable 1.75+），并预装 `rustfmt` / `clippy`
> - Tauri 2.0 要求 Rust >= 1.70，推荐使用 1.75+ 以获得更好性能

**Step 1 — 创建项目目录结构**

```bash
# 项目根目录
mkdir mkpreview && cd mkpreview

# 创建核心目录
mkdir -p src-tauri/src/commands
mkdir -p src-tauri/src/services
mkdir -p src-tauri/src/models
mkdir -p src-tauri/capabilities
mkdir -p src/assets/styles/themes
mkdir -p src/assets/styles/markdown
mkdir -p src/components/layout
mkdir -p src/components/file-tree
mkdir -p src/components/tabs
mkdir -p src/components/editor
mkdir -p src/components/preview
mkdir -p src/components/split
mkdir -p src/components/search
mkdir -p src/components/settings
mkdir -p src/composables
mkdir -p src/stores
mkdir -p src/services
mkdir -p src/lib
mkdir -p src/types
```

**Step 2 — 初始化前端 npm 项目**

```bash
npm init -y
```

安装核心依赖：
```bash
npm install vue@3 pinia @tauri-apps/api
npm install -D vite @vitejs/plugin-vue typescript vue-tsc @types/node
npm install -D tailwindcss postcss autoprefixer
npm install -D eslint prettier eslint-plugin-vue @vue/eslint-config-typescript
```

**Step 3 — 初始化 Tauri Rust 项目**

```bash
cargo init --name mkpreview src-tauri
```

在 `src-tauri/` 下创建 Tauri 配置文件（详见下方文件清单）。

### 2.2 需要创建的文件清单

| 文件路径 | 说明 |
|---------|------|
| `package.json` | npm 项目配置与脚本 |
| `index.html` | 前端入口 HTML |
| `vite.config.ts` | Vite 构建配置 |
| `tsconfig.json` | TypeScript 编译配置 |
| `tailwind.config.ts` | Tailwind CSS 配置 |
| `env.d.ts` | Vite 环境类型声明 |
| `src/main.ts` | Vue 应用入口 |
| `src/App.vue` | 根组件（初始为空骨架） |
| `src-tauri/Cargo.toml` | Rust 依赖与包信息 |
| `src-tauri/tauri.conf.json` | Tauri 应用核心配置 |
| `src-tauri/capabilities/default.json` | Tauri 2.0 权限声明 |
| `src-tauri/src/main.rs` | Rust 后端入口 |
| `src-tauri/src/lib.rs` | Rust 库模块注册 |
| `src-tauri/src/commands/mod.rs` | IPC 命令模块入口 |
| `src-tauri/src/services/mod.rs` | 业务服务模块入口 |
| `src-tauri/src/models/mod.rs` | 数据结构模块入口 |

### 2.3 各配置文件详细内容

#### 2.3.1 `package.json`

```json
{
  "name": "mkpreview",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "lint": "eslint . --ext .vue,.ts,.tsx --fix",
    "format": "prettier --write \"src/**/*.{ts,vue,css}\""
  },
  "dependencies": {
    "vue": "^3.4.0",
    "pinia": "^2.1.0",
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-dialog": "^2.0.0",
    "@tauri-apps/plugin-fs": "^2.0.0",
    "@tauri-apps/plugin-shell": "^2.0.0",
    "markdown-it": "^14.0.0",
    "@types/markdown-it": "^14.0.0",
    "markdown-it-anchor": "^9.0.0",
    "markdown-it-task-lists": "^2.1.0",
    "highlight.js": "^11.9.0",
    "codemirror": "^6.0.0",
    "@codemirror/view": "^6.28.0",
    "@codemirror/state": "^6.4.0",
    "@codemirror/lang-markdown": "^6.2.0",
    "@codemirror/language-data": "^6.5.0",
    "@codemirror/commands": "^6.5.0",
    "@codemirror/search": "^6.5.0",
    "@codemirror/theme-one-dark": "^6.1.0",
    "@lezer/highlight": "^1.2.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-vue": "^5.0.0",
    "typescript": "^5.3.0",
    "vue-tsc": "^1.8.0",
    "@types/node": "^20.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.57.0",
    "prettier": "^3.2.0",
    "eslint-plugin-vue": "^9.20.0",
    "@vue/eslint-config-typescript": "^12.0.0",
    "@tauri-apps/cli": "^2.0.0"
  }
}
```

#### 2.3.2 `index.html`

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MKPreview</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

#### 2.3.3 `src/main.ts`

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/styles/global.css'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
```

#### 2.3.4 `src/App.vue`

```vue
<template>
  <div class="app-container">
    <!-- MVP Phase 1 初始为空骨架，后续由 AppLayout.vue 填充 -->
    <h1>MKPreview</h1>
    <p>应用初始化完成</p>
  </div>
</template>

<script setup lang="ts">
// 根组件，后续将替换为 AppLayout 布局骨架
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  font-family: var(--font-ui, sans-serif);
}
</style>
```

#### 2.3.5 `src-tauri/Cargo.toml`

```toml
[package]
name = "mkpreview"
version = "0.1.0"
description = "跨平台 Markdown 知识库精美渲染与浏览桌面应用"
authors = ["MKPreview Team"]
edition = "2021"
rust-version = "1.70"

[lib]
name = "mkpreview_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[[bin]]
name = "mkpreview"
path = "src/main.rs"

[build-dependencies]
tauri-build = { version = "2.0.0", features = [] }

[dependencies]
tauri = { version = "2.0.0", features = [] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
walkdir = "2.5"
notify = "6.1"
notify-debouncer-full = "0.3"

# Tauri 插件
tauri-plugin-dialog = "2.0.0"
tauri-plugin-fs = "2.0.0"
tauri-plugin-shell = "2.0.0"
```

#### 2.3.6 `src-tauri/tauri.conf.json`

```json
{
  "$schema": "../node_modules/@tauri-apps/cli/config.schema.json",
  "productName": "MKPreview",
  "version": "0.1.0",
  "identifier": "com.mkpreview.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173"
  },
  "app": {
    "windows": [
      {
        "title": "MKPreview",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "center": true,
        "resizable": true,
        "fullscreen": false,
        "decorations": true,
        "transparent": false,
        "visible": true
      }
    ],
    "security": {
      "csp": {
        "default-src": "'self'",
        "script-src": "'self'",
        "style-src": "'self' 'unsafe-inline'",
        "img-src": "'self' asset: https:",
        "font-src": "'self' data:",
        "connect-src": "'self' ipc: http://ipc.localhost"
      },
      "capabilities": ["default"]
    }
  },
  "bundle": {
    "active": true,
    "targets": ["dmg", "msi", "nsis"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "macOS": {
      "frameworks": [],
      "minimumSystemVersion": "10.13",
      "signingIdentity": null,
      "entitlements": null
    },
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": ""
    }
  }
}
```

> **CSP 策略说明**：
> - `default-src 'self'`：默认仅允许同源资源
> - `script-src 'self'`：禁止 eval 和外部脚本，防范 XSS
> - `style-src 'self' 'unsafe-inline'`：允许 Tailwind 生成的内联样式和 CSS 变量
> - `img-src 'self' asset: https:`：允许本地 asset 协议图片和 HTTPS 图片
> - `font-src 'self' data:`：允许本地字体和 data URI 字体
> - `connect-src`：允许 Tauri IPC 通信

#### 2.3.7 `src-tauri/capabilities/default.json`

```json
{
  "identifier": "default",
  "description": "MKPreview 默认能力集合 — MVP 阶段最小权限",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:allow-open",
    "fs:allow-read",
    "fs:allow-read-dir",
    {
      "identifier": "fs:scope",
      "allow": [
        { "path": "$APPDATA" },
        { "path": "$APPDATA/**" }
      ]
    },
    "shell:allow-open"
  ]
}
```

> **权限说明**：
> - `core:default`：Tauri 2.0 基础 IPC 通信能力
> - `dialog:allow-open`：系统目录选择对话框（FR-001.1）
> - `fs:allow-read` / `fs:allow-read-dir`：文件读取和目录遍历（FR-001, FR-002）
> - `fs:scope`：默认仅允许访问 `$APPDATA` 配置目录；用户通过对话框选择的目录将在运行时动态追加到 scope
> - `shell:allow-open`：外部链接在系统浏览器中打开（FR-004, NFR-004）
> 
> **Phase 2 追加权限**：`fs:allow-write`（文件保存）、`fs:allow-write-file`（写入文件）

#### 2.3.8 `src-tauri/src/main.rs`

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    mkpreview_lib::run();
}
```

#### 2.3.9 `src-tauri/src/lib.rs`

```rust
pub mod commands;
pub mod models;
pub mod services;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // 应用启动初始化钩子
            // Phase 3: 恢复窗口状态、加载用户配置
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // MVP Phase 1 注册的 IPC 命令
            // F02-01: commands::file_system::scan_directory,
            // F02-02: commands::file_system::read_file,
            // F02-03: commands::watcher::start_watching,
            // F02-03: commands::watcher::stop_watching,
            // F02-05: commands::settings::get_settings,
            // F02-05: commands::settings::save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MKPreview application");
}
```

#### 2.3.10 `src-tauri/src/commands/mod.rs`

```rust
pub mod file_system;
pub mod watcher;
pub mod search;
pub mod settings;
```

#### 2.3.11 `src-tauri/src/services/mod.rs`

```rust
pub mod dir_scanner;
pub mod file_watcher;
pub mod config_store;
```

#### 2.3.12 `src-tauri/src/models/mod.rs`

```rust
pub mod file_tree;
pub mod search_result;
pub mod settings;
```

#### 2.3.13 `src-tauri/build.rs`

```rust
fn main() {
    tauri_build::build();
}
```

### 2.4 动态 FS Scope 运行时扩展机制

MVP 阶段文件系统访问遵循"用户主动选择即授权"原则。当用户通过 `dialog:open` 选择目录后，Tauri 2.0 的 `fs` 插件会自动将该路径追加到 FS Scope 中。后端所有文件操作命令在接收到路径参数后，必须执行以下安全检查：

1. **路径规范化**：使用 `std::fs::canonicalize` 解析绝对路径
2. **Scope 校验**：通过 `app.fs_scope().is_allowed(&path)` 验证路径在授权范围内
3. **路径遍历防护**：拒绝包含 `..` 的输入路径，过滤符号链接（`follow_links(false)`）

具体实现将在 F02-01 / F02-02 中展开。

## 3. 接口定义

### 3.1 Rust 对外暴露的 IPC 命令（注册入口）

所有 IPC 命令在 `src-tauri/src/lib.rs` 中通过 `invoke_handler` 统一注册。当前 F01-01 阶段仅建立注册框架，命令实现在后续 F02 系列特性中完成。

```rust
.invoke_handler(tauri::generate_handler![
    commands::file_system::scan_directory,
    commands::file_system::read_file,
    commands::file_system::write_file,      // Phase 2
    commands::file_system::get_file_meta,
    commands::watcher::start_watching,
    commands::watcher::stop_watching,
    commands::search::search_files,         // Phase 2
    commands::settings::get_settings,
    commands::settings::save_settings,
])
```

### 3.2 Tauri 事件通道（Rust → Frontend）

```rust
// 文件系统变更事件
app.emit("fs:change", FsChangeEvent { change_type, path });

// 文件系统错误事件
app.emit("fs:error", FsErrorEvent { message });
```

### 3.3 前端 Tauri API 封装（services/tauriCommands.ts 预留）

```typescript
// F01-01 阶段建立文件框架，接口实现在 F02 阶段填充
import { invoke } from '@tauri-apps/api/core'

export async function scanDirectory(path: string): Promise<FileTreeNode[]> {
  return invoke('scan_directory', { path })
}

export async function readFile(path: string): Promise<string> {
  return invoke('read_file', { path })
}
```

## 4. 数据结构

### 4.1 Rust — FileTreeNode

```rust
// src-tauri/src/models/file_tree.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileTreeNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileTreeNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_count: Option<u32>,
}
```

### 4.2 Rust — FileMeta

```rust
// src-tauri/src/models/file_tree.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMeta {
    pub path: String,
    pub size: u64,
    pub modified: u64,
    pub created: u64,
}
```

### 4.3 Rust — Settings

```rust
// src-tauri/src/models/settings.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub theme: String,        // "system" | "light" | "dark"
    pub font_body: String,
    pub font_code: String,
    pub font_size: u8,
    pub auto_save: bool,
    pub auto_save_interval: u16,
    pub show_line_numbers: bool,
    pub recent_dirs: Vec<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            font_body: "Noto Serif SC".to_string(),
            font_code: "JetBrains Mono".to_string(),
            font_size: 16,
            auto_save: true,
            auto_save_interval: 3,
            show_line_numbers: true,
            recent_dirs: vec![],
        }
    }
}
```

### 4.4 TypeScript — FileTreeNode（前端镜像类型）

```typescript
// src/types/fileTree.ts
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
```

## 5. 依赖关系

### 5.1 前置依赖

| 依赖项 | 说明 |
|--------|------|
| Node.js >= 18 | 前端运行时 |
| Rust >= 1.70 | Rust 编译器 |
| Cargo | Rust 包管理器 |

### 5.2 被哪些特性依赖

| 特性编号 | 特性名 | 说明 |
|---------|--------|------|
| F01-02 | 前端基础配置 | 依赖本特性建立的项目结构 |
| F02-01 | 目录扫描服务 | 依赖 Tauri IPC 框架 |
| F02-02 | 文件读写命令 | 依赖 Tauri FS 插件和 Scope 机制 |
| F02-03 | 文件系统监控 | 依赖 Tauri Event 通道 |
| F02-05 | 配置持久化服务 | 依赖 Tauri APPDATA 路径 |
| F03-01 | CSS Grid 整体布局 | 依赖 Vue 3 运行时 |
| F08-01 | CSS 变量主题系统 | 依赖 Pinia Store |
| F09-01 | Tauri 构建配置 | 依赖本特性的 tauri.conf.json |

### 5.3 第三方库

**Rust (Cargo)**：
| Crate | 版本 | 用途 |
|-------|------|------|
| `tauri` | 2.0.x | 应用框架 |
| `tauri-build` | 2.0.x | 构建脚本 |
| `tauri-plugin-dialog` | 2.0.x | 系统对话框 |
| `tauri-plugin-fs` | 2.0.x | 文件系统访问 |
| `tauri-plugin-shell` | 2.0.x | 外部链接打开 |
| `serde` / `serde_json` | 1.x | 序列化 |
| `walkdir` | 2.5.x | 目录遍历（F02-01 使用） |
| `notify` | 6.1.x | 文件监控（F02-03 使用） |

**前端 (npm)**：
| Package | 版本 | 用途 |
|---------|------|------|
| `vue` | 3.4.x | UI 框架 |
| `pinia` | 2.1.x | 状态管理 |
| `@tauri-apps/api` | 2.0.x | Tauri 前端 API |
| `@tauri-apps/cli` | 2.0.x | Tauri CLI 工具 |
| `vite` | 5.0.x | 构建工具 |
| `@vitejs/plugin-vue` | 5.0.x | Vue Vite 插件 |
| `typescript` | 5.3.x | 类型系统 |
| `vue-tsc` | 1.8.x | Vue TypeScript 检查 |

## 6. 测试要点

### 6.1 验收标准

- [ ] `cargo check` 在 `src-tauri/` 下执行通过，无编译错误
- [ ] `npm install` 成功安装所有依赖
- [ ] `npm run tauri:dev` 启动后，应用窗口正确显示（1200x800），标题为 "MKPreview"
- [ ] 窗口可正常调整大小，最小尺寸限制为 800x600
- [ ] 前端 Vue 3 应用正确挂载，控制台无 Vue 警告
- [ ] Pinia DevTools 可检测到 Store 实例
- [ ] 尝试访问未授权路径时，Tauri FS 插件拒绝访问

### 6.2 安全验证

- [ ] CSP 策略正确加载：在 DevTools Network 面板中验证响应头包含 `Content-Security-Policy`
- [ ] `tauri.conf.json` 中的 CSP 禁止 `eval()` 执行
- [ ] `capabilities/default.json` 仅声明最小权限集合，无 `fs:allow-write`（MVP 阶段）
- [ ] 动态 Scope 机制：通过对话框选择目录后，该目录下的文件可被读取；未选择目录时读取被拒绝

### 6.3 性能基准

- [ ] `cargo build --release` 成功，生成可执行文件
- [ ] 冷启动到窗口可见 < 1.5s（开发模式下允许稍慢）
- [ ] 最终安装包体积目标 < 15MB（在 F09 阶段验证）
