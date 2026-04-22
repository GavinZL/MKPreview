# F08-04 配置持久化与恢复 [Phase 3]

## 1. 功能描述与目标

**功能描述**：Phase 3 阶段实现用户配置的完整持久化方案。应用启动时从 Rust 后端加载上次保存的配置，运行时配置变更自动保存，应用关闭前确保配置已持久化。

**目标**：
- 启动时通过 Rust `get_settings` 加载用户配置
- 配置变更时通过 Rust `save_settings` 自动保存（防抖 1 秒）
- 持久化内容：主题偏好、显示模式、字体设置、自动保存配置、窗口尺寸位置、文件树展开状态、最近打开目录列表
- 配置存储在系统应用数据目录（`$APPDATA` / `~/Library/Application Support`）
- 配置格式为 JSON，结构清晰、版本化
- 配置损坏时 graceful 降级为默认配置

**PRD 关联**：FR-001.7（记住上次打开的目录路径和树展开状态）、NFR-002（跨平台一致性）

---

## 2. 技术实现方案

### 2.1 配置存储位置

| 平台 | 存储路径 |
|------|---------|
| macOS | `~/Library/Application Support/com.mkpreview.app/settings.json` |
| Windows | `%APPDATA%\MKPreview\settings.json` |
| Linux | `~/.config/MKPreview/settings.json` |

Tauri 提供 `app_data_dir()` API 获取应用数据目录，跨平台统一。

### 2.2 Rust 配置存储服务

```rust
// src-tauri/src/services/config_store.rs
use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::Manager;

/// 配置版本号（用于未来迁移）
const CONFIG_VERSION: u32 = 1;

/// 应用配置结构
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub version: u32,
    pub theme: String,           // "system" | "light" | "dark"
    pub display_mode: String,    // "preview" | "source" | "split"
    pub font_body: String,
    pub font_code: String,
    pub font_size_body: u32,
    pub font_size_code: u32,
    pub show_line_numbers: bool,
    pub auto_save: AutoSaveConfig,
    pub enable_folding: bool,
    pub enable_mermaid: bool,
    pub enable_katex: bool,
    pub window_state: WindowState,
    pub recent_directories: Vec<String>,
    pub file_tree_state: FileTreeState,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AutoSaveConfig {
    pub enabled: bool,
    pub delay_ms: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WindowState {
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub maximized: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileTreeState {
    pub sidebar_width: u32,
    pub sidebar_collapsed: bool,
    pub expanded_paths: Vec<String>,
    pub selected_path: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            version: CONFIG_VERSION,
            theme: "system".to_string(),
            display_mode: "preview".to_string(),
            font_body: "'LXGW WenKai', 'Noto Serif SC', Georgia, serif".to_string(),
            font_code: "'JetBrains Mono', 'Fira Code', Menlo, monospace".to_string(),
            font_size_body: 16,
            font_size_code: 14,
            show_line_numbers: true,
            auto_save: AutoSaveConfig { enabled: true, delay_ms: 3000 },
            enable_folding: true,
            enable_mermaid: true,
            enable_katex: true,
            window_state: WindowState {
                width: 1200,
                height: 800,
                x: 0,
                y: 0,
                maximized: false,
            },
            recent_directories: vec![],
            file_tree_state: FileTreeState {
                sidebar_width: 260,
                sidebar_collapsed: false,
                expanded_paths: vec![],
                selected_path: None,
            },
        }
    }
}

pub struct ConfigStore {
    config_path: PathBuf,
    settings: AppSettings,
}

impl ConfigStore {
    pub fn new(app_handle: &tauri::AppHandle) -> Result<Self, String> {
        let app_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?;

        fs::create_dir_all(&app_dir)
            .map_err(|e| format!("Failed to create app dir: {}", e))?;

        let config_path = app_dir.join("settings.json");
        let settings = Self::load(&config_path)?;

        Ok(Self {
            config_path,
            settings,
        })
    }

    fn load(config_path: &PathBuf) -> Result<AppSettings, String> {
        if !config_path.exists() {
            return Ok(AppSettings::default());
        }

        let content = fs::read_to_string(config_path)
            .map_err(|e| format!("Failed to read config: {}", e))?;

        let settings: AppSettings = serde_json::from_str(&content)
            .map_err(|e| {
                eprintln!("Config parse error ({}), using default", e);
                AppSettings::default()
            })
            .unwrap_or_default();

        Ok(settings)
    }

    pub fn save(&self) -> Result<(), String> {
        let content = serde_json::to_string_pretty(&self.settings)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        fs::write(&self.config_path, content)
            .map_err(|e| format!("Failed to write config: {}", e))?;

        Ok(())
    }

    pub fn get(&self) -> &AppSettings {
        &self.settings
    }

    pub fn set(&mut self, settings: AppSettings) {
        self.settings = settings;
    }

    pub fn update<F>(&mut self, f: F) -> Result<(), String>
    where
        F: FnOnce(&mut AppSettings),
    {
        f(&mut self.settings);
        self.save()
    }
}
```

### 2.3 Rust IPC 命令

```rust
// src-tauri/src/commands/settings.rs
use tauri::State;
use std::sync::Mutex;
use crate::services::config_store::{ConfigStore, AppSettings};

#[tauri::command]
pub fn get_settings(store: State<Mutex<ConfigStore>>) -> Result<AppSettings, String> {
    let store = store.lock().map_err(|e| e.to_string())?;
    Ok(store.get().clone())
}

#[tauri::command]
pub fn save_settings(
    settings: AppSettings,
    store: State<Mutex<ConfigStore>>,
) -> Result<(), String> {
    let mut store = store.lock().map_err(|e| e.to_string())?;
    store.set(settings);
    store.save()
}

#[tauri::command]
pub fn update_window_state(
    window_state: WindowState,
    store: State<Mutex<ConfigStore>>,
) -> Result<(), String> {
    let mut store = store.lock().map_err(|e| e.to_string())?;
    store.update(|s| s.window_state = window_state)
}
```

### 2.4 前端配置持久化 Composable

```typescript
// composables/useConfigPersistence.ts
import { ref, watch, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useDebounceFn } from '@vueuse/core'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUiStore } from '@/stores/uiStore'

export interface PersistedConfig {
  version: number
  theme: string
  displayMode: string
  fontBody: string
  fontCode: string
  fontSizeBody: number
  fontSizeCode: number
  showLineNumbers: boolean
  autoSave: {
    enabled: boolean
    delayMs: number
  }
  enableFolding: boolean
  enableMermaid: boolean
  enableKaTeX: boolean
  windowState: {
    width: number
    height: number
    x: number
    y: number
    maximized: boolean
  }
  recentDirectories: string[]
  fileTreeState: {
    sidebarWidth: number
    sidebarCollapsed: boolean
    expandedPaths: string[]
    selectedPath: string | null
  }
}

export function useConfigPersistence() {
  const settingsStore = useSettingsStore()
  const uiStore = useUiStore()
  const isLoaded = ref(false)
  const isSaving = ref(false)

  /** 加载配置 */
  async function loadConfig() {
    try {
      const config = await invoke<PersistedConfig>('get_settings')
      applyConfig(config)
      isLoaded.value = true
    } catch (error) {
      console.warn('Failed to load settings, using defaults:', error)
      isLoaded.value = true
    }
  }

  /** 应用配置到各 Store */
  function applyConfig(config: PersistedConfig) {
    // 应用主题设置
    if (config.theme) settingsStore.setTheme(config.theme as any)
    if (config.displayMode) settingsStore.setDisplayMode(config.displayMode as any)
    if (config.fontBody) settingsStore.setFontBody(config.fontBody)
    if (config.fontCode) settingsStore.setFontCode(config.fontCode)
    if (config.fontSizeBody) settingsStore.fontSizeBody = config.fontSizeBody
    if (config.fontSizeCode) settingsStore.fontSizeCode = config.fontSizeCode
    if (typeof config.showLineNumbers === 'boolean') {
      settingsStore.showLineNumbers = config.showLineNumbers
    }
    if (config.autoSave) {
      settingsStore.autoSaveEnabled = config.autoSave.enabled
      settingsStore.autoSaveDelay = config.autoSave.delayMs
    }
    if (typeof config.enableFolding === 'boolean') settingsStore.enableFolding = config.enableFolding
    if (typeof config.enableMermaid === 'boolean') settingsStore.enableMermaid = config.enableMermaid
    if (typeof config.enableKaTeX === 'boolean') settingsStore.enableKaTeX = config.enableKaTeX

    // 应用窗口状态
    if (config.windowState) {
      uiStore.windowState = config.windowState
    }

    // 应用文件树状态
    if (config.fileTreeState) {
      uiStore.sidebarWidth = config.fileTreeState.sidebarWidth
      uiStore.sidebarCollapsed = config.fileTreeState.sidebarCollapsed
    }

    // 应用最近目录
    if (config.recentDirectories) {
      uiStore.recentDirectories = config.recentDirectories
    }
  }

  /** 收集当前配置 */
  function collectConfig(): PersistedConfig {
    return {
      version: 1,
      theme: settingsStore.theme,
      displayMode: settingsStore.displayMode,
      fontBody: settingsStore.fontBody,
      fontCode: settingsStore.fontCode,
      fontSizeBody: settingsStore.fontSizeBody,
      fontSizeCode: settingsStore.fontSizeCode,
      showLineNumbers: settingsStore.showLineNumbers,
      autoSave: {
        enabled: settingsStore.autoSaveEnabled,
        delayMs: settingsStore.autoSaveDelay,
      },
      enableFolding: settingsStore.enableFolding,
      enableMermaid: settingsStore.enableMermaid,
      enableKaTeX: settingsStore.enableKaTeX,
      windowState: uiStore.windowState,
      recentDirectories: uiStore.recentDirectories,
      fileTreeState: {
        sidebarWidth: uiStore.sidebarWidth,
        sidebarCollapsed: uiStore.sidebarCollapsed,
        expandedPaths: [], // 从 fileTreeStore 获取
        selectedPath: null,
      },
    }
  }

  /** 保存配置（防抖） */
  const debouncedSave = useDebounceFn(async () => {
    isSaving.value = true
    try {
      const config = collectConfig()
      await invoke('save_settings', { settings: config })
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      isSaving.value = false
    }
  }, 1000) // 1 秒防抖

  /** 立即保存 */
  async function saveNow() {
    debouncedSave.flush()
  }

  // 监听设置变化，自动保存
  watch(
    () => settingsStore.exportSettings(),
    () => {
      if (isLoaded.value) {
        debouncedSave()
      }
    },
    { deep: true }
  )

  // 监听 UI 状态变化
  watch(
    () => uiStore.sidebarWidth,
    () => {
      if (isLoaded.value) {
        debouncedSave()
      }
    }
  )

  onMounted(() => {
    loadConfig()
  })

  return {
    isLoaded,
    isSaving,
    loadConfig,
    saveNow,
  }
}
```

### 2.5 窗口状态保存（Rust 端）

```rust
// src-tauri/src/main.rs
use tauri::{Manager, WindowEvent};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // 初始化配置存储
            let config_store = ConfigStore::new(app.handle())?;
            app.manage(std::sync::Mutex::new(config_store));

            // 窗口关闭前保存状态
            let window = app.get_webview_window("main").unwrap();
            window.on_window_event({
                let app_handle = app.handle().clone();
                move |event| {
                    if let WindowEvent::CloseRequested { .. } = event {
                        // 保存窗口状态
                        if let Ok(store) = app_handle.state::<Mutex<ConfigStore>>().lock() {
                            let _ = store.update(|s| {
                                // 获取窗口位置和大小
                                if let Some(window) = app_handle.get_webview_window("main") {
                                    if let Ok(outer_size) = window.outer_size() {
                                        s.window_state.width = outer_size.width;
                                        s.window_state.height = outer_size.height;
                                    }
                                    if let Ok(position) = window.outer_position() {
                                        s.window_state.x = position.x;
                                        s.window_state.y = position.y;
                                    }
                                }
                            });
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            // ... 其他命令
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 3. 接口定义

### 3.1 Rust IPC 命令

```rust
// commands/settings.rs
#[tauri::command]
pub fn get_settings(store: State<Mutex<ConfigStore>>) -> Result<AppSettings, String>

#[tauri::command]
pub fn save_settings(settings: AppSettings, store: State<Mutex<ConfigStore>>) -> Result<(), String>

#[tauri::command]
pub fn update_window_state(window_state: WindowState, store: State<Mutex<ConfigStore>>) -> Result<(), String>
```

### 3.2 useConfigPersistence Composable

```typescript
export interface UseConfigPersistenceReturn {
  isLoaded: Ref<boolean>
  isSaving: Ref<boolean>
  loadConfig: () => Promise<void>
  saveNow: () => Promise<void>
}
```

### 3.3 配置版本迁移（预留）

```typescript
// lib/configMigration.ts

const MIGRATIONS: Record<number, (config: any) => any> = {
  // 1 -> 2: 增加新字段
  1: (config) => ({
    ...config,
    version: 2,
    newField: 'default_value',
  }),
}

export function migrateConfig(config: any): any {
  let currentVersion = config.version || 0
  while (MIGRATIONS[currentVersion]) {
    config = MIGRATIONS[currentVersion](config)
    currentVersion = config.version
  }
  return config
}
```

---

## 4. 数据结构

### 4.1 完整配置 JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MKPreview Settings",
  "type": "object",
  "properties": {
    "version": { "type": "integer", "minimum": 1 },
    "theme": { "type": "string", "enum": ["system", "light", "dark"] },
    "displayMode": { "type": "string", "enum": ["preview", "source", "split"] },
    "fontBody": { "type": "string" },
    "fontCode": { "type": "string" },
    "fontSizeBody": { "type": "integer", "minimum": 12, "maximum": 24 },
    "fontSizeCode": { "type": "integer", "minimum": 10, "maximum": 20 },
    "showLineNumbers": { "type": "boolean" },
    "autoSave": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean" },
        "delayMs": { "type": "integer", "minimum": 500 }
      }
    },
    "enableFolding": { "type": "boolean" },
    "enableMermaid": { "type": "boolean" },
    "enableKaTeX": { "type": "boolean" },
    "windowState": {
      "type": "object",
      "properties": {
        "width": { "type": "integer" },
        "height": { "type": "integer" },
        "x": { "type": "integer" },
        "y": { "type": "integer" },
        "maximized": { "type": "boolean" }
      }
    },
    "recentDirectories": {
      "type": "array",
      "items": { "type": "string" }
    },
    "fileTreeState": {
      "type": "object",
      "properties": {
        "sidebarWidth": { "type": "integer" },
        "sidebarCollapsed": { "type": "boolean" },
        "expandedPaths": {
          "type": "array",
          "items": { "type": "string" }
        },
        "selectedPath": { "type": ["string", "null"] }
      }
    }
  }
}
```

### 4.2 TypeScript 配置类型

```typescript
// types/settings.ts
export interface PersistedSettings {
  version: number
  theme: ThemePreference
  displayMode: DisplayMode
  fontBody: string
  fontCode: string
  fontSizeBody: number
  fontSizeCode: number
  showLineNumbers: boolean
  autoSave: {
    enabled: boolean
    delayMs: number
  }
  enableFolding: boolean
  enableMermaid: boolean
  enableKaTeX: boolean
  windowState: WindowState
  recentDirectories: string[]
  fileTreeState: FileTreeState
}

export interface WindowState {
  width: number
  height: number
  x: number
  y: number
  maximized: boolean
}

export interface FileTreeState {
  sidebarWidth: number
  sidebarCollapsed: boolean
  expandedPaths: string[]
  selectedPath: string | null
}
```

---

## 5. 依赖关系

| 依赖模块 | 特性 | 说明 |
|---------|------|------|
| M02 | F02-05 配置持久化服务 | Rust 后端 config_store 服务 |
| M08 | F08-01 CSS 变量主题系统 | 加载后应用主题 |
| M08 | F08-02 主题切换功能 | 持久化用户主题偏好 |
| M08 | F08-03 设置面板 | 设置变更触发持久化 |
| M03 | F03-01 CSS Grid 布局 | 窗口尺寸持久化 |
| M04 | F04-01 文件树核心组件 | 文件树展开状态持久化 |

**被依赖**：
- 所有需要持久化状态的模块

---

## 6. 测试要点

### 6.1 单元测试

| 测试项 | 操作 | 预期结果 |
|--------|------|---------|
| 首次启动 | 无配置文件 | 使用默认配置，创建 settings.json |
| 加载配置 | 存在有效配置 | 正确加载并应用到 Store |
| 加载损坏配置 | JSON 格式错误 | 降级为默认配置，日志警告 |
| 保存配置 | 设置变更 | settings.json 更新，1 秒防抖 |
| 版本迁移 | 旧版本配置 | 自动迁移到最新版本 |
| 跨平台路径 | macOS/Windows | 正确存储到各自应用数据目录 |

### 6.2 集成测试

1. **启动恢复**：修改设置 → 关闭应用 → 重新启动 → 设置正确恢复
2. **窗口状态**：调整窗口大小/位置 → 关闭 → 重启 → 窗口恢复上次状态
3. **最近目录**：打开目录 → 关闭 → 重启 → 最近目录列表包含该目录

### 6.3 E2E 测试

- 删除配置文件后启动 → 应用正常启动，使用默认配置
- 手动编辑配置文件为无效 JSON → 应用正常启动，使用默认配置
- 频繁修改设置 → 配置只保存最终状态（防抖生效）

### 6.4 安全测试

| 测试项 | 预期 |
|--------|------|
| 配置目录权限 | 应用仅读写自身数据目录 |
| 路径遍历 | 配置文件路径不可被用户注入 |
| 敏感信息 | 配置中不存储密码等敏感信息 |
