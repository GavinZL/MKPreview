# F03-04 原生菜单栏

## 1. 功能描述与目标

实现 MKPreview 原生应用菜单栏，提供系统级操作入口：

- **File 菜单**：打开目录（CmdOrCtrl+O）、退出应用（CmdOrCtrl+Q）
- **Edit 菜单**：Undo / Redo / Cut / Copy / Paste / Select All（标准编辑操作，确保 WebView 内文本编辑可用）
- **View 菜单**：Preview / Source / Split 模式切换、侧栏切换
- **Help 菜单**：About MKPreview

**核心目标**：
- 使用 Tauri 2.0 原生 Menu API 构建，菜单样式跟随操作系统原生外观
- 菜单加速键（Accelerator）与现有快捷键体系保持一致
- 菜单项事件通过 Tauri 事件系统发送到前端，由 `useMenuEvents` composable 统一响应
- macOS 上菜单栏显示在系统菜单栏，Windows 上显示在窗口标题栏下方

**PRD 需求追溯**：
- FR-001.1：系统原生目录选择对话框 → File > Open Directory
- FR-003：模式切换快捷键 → View 菜单
- 附录 A 快捷键汇总 → 菜单加速键对齐

## 2. 菜单结构

### 2.1 完整菜单定义

```
┌ MKPreview ────────┬ File ────────┬ Edit ────────┬ View ────────┬ Help ────────┐
│ About MKPreview    │ Open Directory│ Undo         │ Preview Mode  │ About        │
│ ─────────────────  │ ────────────  │ Redo         │ Source Mode   │              │
│ Preferences…       │              │ ───────────  │ Split Mode    │              │
│ ─────────────────  │              │ Cut          │ ────────────  │              │
│ Quit MKPreview     │              │ Copy         │ Toggle Sidebar│              │
│                    │              │ Paste        │               │              │
│                    │              │ Select All   │               │              │
└────────────────────┴──────────────┴──────────────┴───────────────┴──────────────┘
```

### 2.2 菜单项详细定义

#### File 菜单

| 菜单项 | Accelerator | 事件 ID | 说明 |
|--------|-------------|---------|------|
| Open Directory | CmdOrCtrl+O | `menu:open-directory` | 调用系统目录选择对话框，选择后加载为文件树根目录 |
| --- Separator --- | | | |
| Quit | CmdOrCtrl+Q | `menu:quit` | 退出应用（macOS 上由系统 Apple 菜单处理） |

#### Edit 菜单

| 菜单项 | Accelerator | 事件 ID | 说明 |
|--------|-------------|---------|------|
| Undo | CmdOrCtrl+Z | `menu:undo` | WebView 内标准 Undo（编辑器/输入框） |
| Redo | CmdOrCtrl+Shift+Z | `menu:redo` | WebView 内标准 Redo |
| --- Separator --- | | | |
| Cut | CmdOrCtrl+X | `menu:cut` | WebView 内标准 Cut |
| Copy | CmdOrCtrl+C | `menu:copy` | WebView 内标准 Copy |
| Paste | CmdOrCtrl+V | `menu:paste` | WebView 内标准 Paste |
| Select All | CmdOrCtrl+A | `menu:select-all` | WebView 内标准 Select All |

> **注意**：Edit 菜单项不需要自定义前端事件处理，Tauri WebView 会自动处理这些标准编辑操作的加速键。定义菜单项的目的是让它们出现在原生菜单中，提供视觉提示和备选操作方式。

#### View 菜单

| 菜单项 | Accelerator | 事件 ID | 说明 |
|--------|-------------|---------|------|
| Preview Mode | CmdOrCtrl+1 | `menu:mode-preview` | 切换到渲染预览模式 |
| Source Mode | CmdOrCtrl+2 | `menu:mode-source` | 切换到源码查看模式 |
| Split Mode | CmdOrCtrl+3 | `menu:mode-split` | 切换到分屏模式（P2） |
| --- Separator --- | | | |
| Toggle Sidebar | CmdOrCtrl+B | `menu:toggle-sidebar` | 切换侧栏显示/隐藏 |

#### Help 菜单

| 菜单项 | Accelerator | 事件 ID | 说明 |
|--------|-------------|---------|------|
| About MKPreview | 无 | `menu:about` | 显示关于对话框（应用名、版本号、版权信息） |

## 3. 技术实现方案

### 3.1 Rust 端菜单构建

使用 Tauri 2.0 的 `tauri::menu` 模块构建原生菜单：

```rust
// src-tauri/src/lib.rs
use tauri::{
    App, Manager,
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
};

pub fn setup_menu(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    // File 菜单
    let open_dir = MenuItem::with_id(app, "menu:open-directory", "Open Directory", true, Some("CmdOrCtrl+O"))?;
    let quit = PredefinedMenuItem::quit(app, None);
    let file_menu = Submenu::with_items(app, "File", true, &[&open_dir, &PredefinedMenuItem::separator(app)?, &quit])?;

    // Edit 菜单
    let undo = MenuItem::with_id(app, "menu:undo", "Undo", true, Some("CmdOrCtrl+Z"))?;
    let redo = MenuItem::with_id(app, "menu:redo", "Redo", true, Some("CmdOrCtrl+Shift+Z"))?;
    let cut = MenuItem::with_id(app, "menu:cut", "Cut", true, Some("CmdOrCtrl+X"))?;
    let copy = MenuItem::with_id(app, "menu:copy", "Copy", true, Some("CmdOrCtrl+C"))?;
    let paste = MenuItem::with_id(app, "menu:paste", "Paste", true, Some("CmdOrCtrl+V"))?;
    let select_all = MenuItem::with_id(app, "menu:select-all", "Select All", true, Some("CmdOrCtrl+A"))?;
    let edit_menu = Submenu::with_items(app, "Edit", true, &[
        &undo, &redo,
        &PredefinedMenuItem::separator(app)?,
        &cut, &copy, &paste, &select_all,
    ])?;

    // View 菜单
    let mode_preview = MenuItem::with_id(app, "menu:mode-preview", "Preview Mode", true, Some("CmdOrCtrl+1"))?;
    let mode_source = MenuItem::with_id(app, "menu:mode-source", "Source Mode", true, Some("CmdOrCtrl+2"))?;
    let mode_split = MenuItem::with_id(app, "menu:mode-split", "Split Mode", true, Some("CmdOrCtrl+3"))?;
    let toggle_sidebar = MenuItem::with_id(app, "menu:toggle-sidebar", "Toggle Sidebar", true, Some("CmdOrCtrl+B"))?;
    let view_menu = Submenu::with_items(app, "View", true, &[
        &mode_preview, &mode_source, &mode_split,
        &PredefinedMenuItem::separator(app)?,
        &toggle_sidebar,
    ])?;

    // Help 菜单
    let about = MenuItem::with_id(app, "menu:about", "About MKPreview", true, None)?;
    let help_menu = Submenu::with_items(app, "Help", true, &[&about])?;

    // 组装菜单栏
    let menu = Menu::with_items(app, &[&file_menu, &edit_menu, &view_menu, &help_menu])?;
    app.set_menu(menu)?;

    Ok(())
)
```

### 3.2 菜单事件监听（Rust 端）

```rust
// src-tauri/src/lib.rs — 在 setup 回调中注册
app.on_menu_event(move |app, event| {
    let event_id = event.id().as_ref();

    match event_id {
        "menu:open-directory" | "menu:mode-preview" | "menu:mode-source"
        | "menu:mode-split" | "menu:toggle-sidebar" | "menu:about" => {
            // 将菜单事件转发到前端
            let _ = app.emit("menu-event", event_id);
        }
        // Edit 菜单项由 WebView 自动处理，无需转发
        _ => {}
    }
});
```

### 3.3 macOS 特殊处理

macOS 需额外处理：

1. **应用菜单**：macOS 会自动创建应用名菜单，包含 About、Preferences、Quit 等项。使用 `PredefinedMenuItem::about()` 和 `PredefinedMenuItem::quit()` 确保它们出现在正确的位置。
2. **Edit 菜单**：macOS 的 WebView 需要明确的 Edit 菜单才能响应 Cmd+C/V/Z 等操作。如果不定义这些菜单项，WebView 中的文本编辑将无法使用快捷键。
3. **窗口菜单**：macOS 自动提供 Window 菜单，无需手动创建。

## 4. 前端事件处理

### 4.1 useMenuEvents composable

```typescript
// composables/useMenuEvents.ts
import { onMounted, onUnmounted } from 'vue'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUiStore } from '@/stores/uiStore'
import { useFileTreeStore } from '@/stores/fileTreeStore'
import { open } from '@tauri-apps/plugin-dialog'

export function useMenuEvents() {
  const settingsStore = useSettingsStore()
  const uiStore = useUiStore()
  const fileTreeStore = useFileTreeStore()

  let unlisten: UnlistenFn | null = null

  async function handleMenuEvent(event: { payload: string }) {
    const menuId = event.payload

    switch (menuId) {
      case 'menu:open-directory':
        await handleOpenDirectory()
        break
      case 'menu:mode-preview':
        settingsStore.setDisplayMode('preview')
        break
      case 'menu:mode-source':
        settingsStore.setDisplayMode('source')
        break
      case 'menu:mode-split':
        settingsStore.setDisplayMode('split')
        break
      case 'menu:toggle-sidebar':
        uiStore.toggleSidebar()
        break
      case 'menu:about':
        uiStore.showAboutDialog()
        break
    }
  }

  async function handleOpenDirectory() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择目录',
    })
    if (selected && typeof selected === 'string') {
      await fileTreeStore.loadDirectory(selected)
    }
  }

  onMounted(async () => {
    unlisten = await listen<string>('menu-event', handleMenuEvent)
  })

  onUnmounted(() => {
    unlisten?.()
  })
}
```

### 4.2 App.vue 中注册

```typescript
// App.vue <script setup>
import { useMenuEvents } from '@/composables/useMenuEvents'

useMenuEvents()
```

## 5. 快捷键与菜单加速键的关系

### 5.1 统一性原则

菜单加速键（Accelerator）和前端 `useKeyboard` composable 注册的快捷键必须保持一致，避免重复处理：

| 功能 | 菜单加速键 | 前端快捷键 | 处理方 |
|------|-----------|-----------|--------|
| 打开目录 | CmdOrCtrl+O | CmdOrCtrl+O | **菜单事件** — 前端不重复注册 |
| 模式切换 1/2/3 | CmdOrCtrl+1/2/3 | CmdOrCtrl+1/2/3 | **菜单事件** — 前端不重复注册 |
| 切换侧栏 | CmdOrCtrl+B | CmdOrCtrl+B | **菜单事件** — 前端不重复注册 |
| 保存文件 | — | CmdOrCtrl+S | **前端快捷键** — 菜单中不定义 |
| 切换主题 | — | CmdOrCtrl+Shift+T | **前端快捷键** — 菜单中不定义 |
| 全局搜索 | — | CmdOrCtrl+Shift+F | **前端快捷键** — 菜单中不定义 |

### 5.2 处理策略

- **菜单定义了加速键的**：前端 `useKeyboard` 不再注册相同快捷键，统一由菜单事件驱动
- **菜单未定义加速键的**：由前端 `useKeyboard` composable 独立处理
- **Edit 菜单项**：WebView 自动处理，前端和 Rust 端均无需额外逻辑

### 5.3 实现注意事项

1. **事件去重**：Tauri 2.0 中，定义了 Accelerator 的菜单项会在按下快捷键时同时触发菜单事件和 WebView 内的 keydown 事件。需要在 `useKeyboard` 中排除已由菜单处理的快捷键，或在菜单事件处理中调用 `event.preventDefault()` 以阻止 WebView 的默认处理。
2. **模式切换一致性**：菜单事件和前端快捷键最终都调用 `settingsStore.setDisplayMode()`，确保状态一致。
3. **Split 模式禁用**：MVP 阶段，Split Mode 菜单项应设置 `enabled: false`，P2 启用后改为 `true`。

## 6. 接口定义

### useMenuEvents 导出

| 导出 | 类型 | 说明 |
|------|------|------|
| `useMenuEvents()` | `() => void` | 在组件 setup 中调用，注册菜单事件监听 |

### 依赖 Store

| Store | 用途 |
|-------|------|
| `settingsStore` | `setDisplayMode()` — 模式切换 |
| `uiStore` | `toggleSidebar()` — 侧栏切换、`showAboutDialog()` — 关于对话框 |
| `fileTreeStore` | `loadDirectory()` — 打开目录后加载文件树 |

### 依赖 Tauri API

| API | 用途 |
|-----|------|
| `@tauri-apps/api/event` → `listen` | 监听 Rust 端转发的菜单事件 |
| `@tauri-apps/plugin-dialog` → `open` | 系统目录选择对话框 |

## 7. 依赖关系

| 依赖模块 | 说明 |
|---------|------|
| F03-02 工具栏组件 | 模式切换按钮和侧栏按钮与菜单功能重叠，共享 Store 操作 |
| F04-01 文件树核心组件 | 打开目录后调用 `fileTreeStore.loadDirectory()` |
| F08-02 主题切换功能 | 主题切换快捷键由前端独立处理，不在菜单中 |
| tauri::menu | Tauri 2.0 原生菜单 API |
| @tauri-apps/plugin-dialog | 系统原生目录选择对话框 |

## 8. 测试要点

1. **菜单显示**：macOS 系统菜单栏 / Windows 窗口菜单栏是否正确显示所有菜单项
2. **Open Directory**：点击 File > Open Directory 是否弹出系统目录选择对话框
3. **目录加载**：选择目录后是否正确加载文件树
4. **模式切换**：View 菜单中点击 Preview/Source/Split 是否正确切换显示模式
5. **侧栏切换**：View > Toggle Sidebar 是否正确折叠/展开侧栏
6. **About 对话框**：Help > About MKPreview 是否显示关于信息
7. **快捷键一致性**：菜单加速键与工具栏按钮、前端快捷键的效果是否一致
8. **Edit 菜单**：Cmd+C/V/Z 等编辑操作在 WebView 中是否正常工作
9. **Split Mode 禁用**：MVP 阶段 Split Mode 菜单项是否置灰不可点击
10. **事件去重**：通过菜单快捷键触发时，是否不会产生重复操作
