# MKPreview 国际化 (i18n) 功能规格文档

## 1. 需求概述

为 MKPreview 引入完整的国际化支持，目标语言为 **中文（zh-CN）** 和 **英文（en-US）**。用户可在设置面板中切换界面语言，切换即时生效且持久化。

## 2. 技术选型

- **vue-i18n@9**：Vue 3 官方国际化方案，Composition API 原生支持
- **legacy: false**：使用 Composition API 模式
- **fallbackLocale: 'zh-CN'**：英文未覆盖的键自动回退中文

## 3. 目录结构

```
src/
  i18n/
    index.ts              # i18n 实例创建、setLocale 导出
    locales/
      zh-CN.ts            # 中文语言包
      en-US.ts            # 英文语言包
```

## 4. 键名规范

采用 `module.key` 点分命名，全部 camelCase。支持插值变量 `{varName}`。

### 4.1 键名总表

#### toolbar 模块
| 键名 | 中文 | 英文 |
|------|------|------|
| `toolbar.toggleSidebar` | 切换侧栏 | Toggle Sidebar |
| `toolbar.goBack` | 回退 | Back |
| `toolbar.goForward` | 前进 | Forward |
| `toolbar.openDirectory` | 打开目录 (⌘O) | Open Folder (⌘O) |
| `toolbar.previewTheme` | 切换预览主题 | Preview Theme |
| `toolbar.previewTemplate` | 切换预览风格 | Preview Style |
| `toolbar.toggleTheme` | 切换主题 | Toggle Theme |
| `toolbar.settings` | 设置 | Settings |
| `toolbar.modePreview` | Preview | Preview |
| `toolbar.modeSplit` | Split | Split |

#### status 模块
| 键名 | 中文 | 英文 |
|------|------|------|
| `status.saving` | 保存中... | Saving... |
| `status.modified` | 已修改 | Modified |
| `status.saved` | 已保存 | Saved |
| `status.ready` | 就绪 | Ready |
| `status.line` | 行 {line}, 列 {col} | Ln {line}, Col {col} |
| `status.lines` | {count} 行 | {count} lines |
| `status.words` | {count} 字 | {count} words |
| `status.modePreview` | 预览模式 | Preview |
| `status.modeSource` | 源码模式 | Source |
| `status.modeSplit` | 分屏模式 | Split |

#### settings 模块
| 键名 | 中文 | 英文 |
|------|------|------|
| `settings.title` | 设置 | Settings |
| `settings.sectionAppearance` | 外观 | Appearance |
| `settings.sectionEditor` | 编辑器 | Editor |
| `settings.sectionPreview` | 预览 | Preview |
| `settings.theme` | 主题 | Theme |
| `settings.themeDesc` | 选择界面主题 | Choose interface theme |
| `settings.themeSystem` | 跟随系统 | System |
| `settings.themeLight` | 浅色 | Light |
| `settings.themeDark` | 深色 | Dark |
| `settings.fontBody` | 正文字体 | Body Font |
| `settings.fontBodyDesc` | 预览区域正文字体 | Body font for preview |
| `settings.fontCode` | 代码字体 | Code Font |
| `settings.fontCodeDesc` | 编辑器和代码块字体 | Font for editor & code blocks |
| `settings.fontSize` | 字体大小 | Font Size |
| `settings.fontSizeDesc` | 正文基础字号 | Base font size |
| `settings.autoSave` | 自动保存 | Auto Save |
| `settings.autoSaveDesc` | 编辑后自动保存文件 | Auto save after editing |
| `settings.autoSaveInterval` | 自动保存间隔 | Auto Save Interval |
| `settings.autoSaveIntervalDesc` | 秒 | seconds |
| `settings.showLineNumbers` | 显示行号 | Show Line Numbers |
| `settings.enableFolding` | 代码折叠 | Code Folding |
| `settings.enableFoldingDesc` | 启用代码折叠功能 | Enable code folding |
| `settings.previewTheme` | 预览主题 | Preview Theme |
| `settings.previewThemeDesc` | Markdown 预览区配色方案 | Preview color scheme |
| `settings.previewTemplate` | 预览风格 | Preview Style |
| `settings.previewTemplateDesc` | Markdown 渲染排版风格 | Rendering layout style |
| `settings.enableMermaid` | Mermaid 图表 | Mermaid Diagrams |
| `settings.enableMermaidDesc` | 启用 Mermaid 图表渲染 | Enable Mermaid rendering |
| `settings.enableKaTeX` | KaTeX 公式 | KaTeX Math |
| `settings.enableKaTeXDesc` | 启用数学公式渲染 | Enable math formula rendering |
| `settings.language` | 语言 | Language |
| `settings.languageDesc` | 选择界面语言 | Choose interface language |
| `settings.fontDefault` | 默认 | Default |
| `settings.fontSystem` | 系统默认 | System Default |

#### tree 模块
| 键名 | 中文 | 英文 |
|------|------|------|
| `tree.openDirectoryHint` | 点击工具栏打开目录 | Click toolbar to open folder |
| `tree.noResults` | 无匹配结果 | No matches |
| `tree.dropHint` | 释放以打开 | Drop to open |
| `tree.searchPlaceholder` | 搜索文件... | Search files... |
| `tree.searchResults` | {count} 个结果 | {count} results |

#### search 模块
| 键名 | 中文 | 英文 |
|------|------|------|
| `search.placeholder` | 搜索文件名或内容... | Search files or content... |
| `search.searching` | 搜索中... | Searching... |
| `search.filenameMatches` | 文件名匹配 | Filename Matches |
| `search.contentMatches` | 内容匹配 | Content Matches |
| `search.noResults` | 无结果 | No results |

#### tabs 模块
| 键名 | 中文 | 英文 |
|------|------|------|
| `tabs.noFile` | 未打开文件 | No file opened |
| `tabs.close` | 关闭 | Close |
| `tabs.closeOthers` | 关闭其他 | Close Others |
| `tabs.closeRight` | 关闭右侧 | Close to the Right |
| `tabs.closeAll` | 关闭全部 | Close All |

#### view 模块
| 键名 | 中文 | 英文 |
|------|------|------|
| `view.loading` | 正在加载文件... | Loading file... |
| `view.emptyTitle` | 请选择一个 Markdown 文件 | Select a Markdown file |
| `view.emptyDesc` | 从左侧文件树中选择文件开始预览 | Choose a file from the sidebar to preview |

#### preview 模块
| 键名 | 中文 | 英文 |
|------|------|------|
| `preview.rendering` | 正在渲染... | Rendering... |
| `preview.copy` | 复制 | Copy |
| `preview.copied` | 已复制 | Copied |

#### conflict 模块
| 键名 | 中文 | 英文 |
|------|------|------|
| `conflict.title` | 文件冲突 | File Conflict |
| `conflict.message` | 文件 {fileName} 已在外部被修改，且您有未保存的更改。 | File {fileName} has been modified externally and you have unsaved changes. |
| `conflict.keepLocal` | 保留本地修改 | Keep Local |
| `conflict.loadExternal` | 加载外部版本 | Load External |
| `conflict.viewDiff` | 查看差异 | View Diff |

#### theme 模块（预览主题名称）
| 键名 | 中文 | 英文 |
|------|------|------|
| `theme.default` | 默认主题 | Default |
| `theme.orange` | 橙心 | Orange |
| `theme.purple` | 姹紫 | Purple |
| `theme.teal` | 嫩青 | Teal |
| `theme.green` | 绿意 | Green |
| `theme.red` | 红绯 | Red |
| `theme.blue` | 蓝莹 | Blue |
| `theme.indigo` | 兰青 | Indigo |
| `theme.amber` | 山吹 | Amber |
| `theme.geekBlack` | 极客黑 | Geek Black |
| `theme.rose` | 蔷薇紫 | Rose |
| `theme.mint` | 萌绿 | Mint |
| `theme.fullstackBlue` | 全栈蓝 | Fullstack Blue |
| `theme.minimalBlack` | 极简黑 | Minimal Black |
| `theme.orangeBlue` | 橙蓝风 | Orange Blue |

#### template 模块（预览模板名称）
| 键名 | 中文 | 英文 |
|------|------|------|
| `template.default` | 默认标准 | Default |
| `template.defaultDesc` | 通用 Markdown 阅读样式 | General Markdown reading style |
| `template.blog` | 博客文章 | Blog Article |
| `template.blogDesc` | 适合长文阅读，宽松行距 | For long-form reading |
| `template.techDoc` | 技术文档 | Technical Doc |
| `template.techDocDesc` | 信息密度高，紧凑排版 | High density, compact layout |
| `template.academic` | 学术论文 | Academic |
| `template.academicDesc` | 衬线字体，标题自动编号 | Serif font, auto heading numbers |
| `template.minimalist` | 极简风格 | Minimalist |
| `template.minimalistDesc` | 大量留白，专注内容 | Generous whitespace |

#### error 模块
| 键名 | 中文 | 英文 |
|------|------|------|
| `error.FS_IO_ERROR` | 文件读写错误: {0} | File I/O error: {0} |
| `error.FS_NOT_FOUND` | 文件不存在: {path} | File not found: {path} |
| `error.FS_OUT_OF_SCOPE` | 路径不在允许范围内: {path} | Path not allowed: {path} |
| `error.FS_INVALID_PATH` | 非法路径: {path} | Invalid path: {path} |
| `error.FS_NOT_MD` | 不是 Markdown 文件: {path} | Not a Markdown file: {path} |
| `error.FS_NOT_DIR` | 不是目录: {path} | Not a directory: {path} |
| `error.FS_TOO_LARGE` | 文件过大: {size} 字节 (限制 {limit} 字节) | File too large: {size} bytes (limit {limit}) |
| `error.FS_NO_PERMISSION` | 权限不足: {path} | Permission denied: {path} |
| `error.CFG_SERIALIZE` | 配置序列化失败: {0} | Config serialization failed: {0} |
| `error.CFG_DESERIALIZE` | 配置反序列化失败: {0} | Config deserialization failed: {0} |
| `error.CFG_INVALID_VALUE` | 配置值非法: {0} | Invalid config value: {0} |
| `error.CFG_NO_DATA_DIR` | 应用数据目录获取失败 | Failed to get app data directory |
| `error.WATCH_START_FAIL` | 文件监控启动失败: {0} | File watcher start failed: {0} |
| `error.WATCH_RUNTIME` | 文件监控运行时错误: {0} | File watcher error: {0} |
| `error.WATCH_PATH_GONE` | 监控路径已不存在: {path} | Watched path no longer exists: {path} |
| `error.SEARCH_INVALID_DIR` | 搜索目录非法: {path} | Invalid search directory: {path} |
| `error.SEARCH_TIMEOUT` | 搜索超时 | Search timeout |
| `error.INTERNAL` | 内部错误: {0} | Internal error: {0} |
| `error.UNKNOWN` | 未知错误 | Unknown error |

## 5. Settings 扩展

在 `Settings` 接口和 `defaultSettings` 中新增：

```typescript
type AppLocale = 'zh-CN' | 'en-US'

interface Settings {
  // ... existing fields
  locale?: AppLocale
}

const defaultSettings: Settings = {
  // ... existing fields
  locale: 'zh-CN'
}
```

SettingsStore 新增：
- `locale` ref
- `setLocale(locale: AppLocale)` action（同步更新 i18n locale 并持久化）

## 6. 后端错误处理策略

Rust 侧 `AppError` 的 `#[error("...")]` 改为英文描述（仅用于日志），前端 `parseError` 根据 `code` 从 i18n 查询本地化消息覆盖 `message` 字段。

## 7. 组件修改清单

| 文件 | 修改内容 |
|------|---------|
| `src/main.ts` | 注册 i18n: `app.use(i18n)` |
| `src/App.vue` | 加载 settings 后调用 `setLocale(settings.locale)` |
| `src/types/settings.ts` | 新增 `AppLocale` 类型，Settings 加 `locale` |
| `src/stores/settingsStore.ts` | 新增 `locale` state 和 `setLocale` action |
| `src/components/layout/Toolbar.vue` | title 和按钮文本改用 `t()` |
| `src/components/layout/StatusBar.vue` | 所有状态文本改用 `t()` |
| `src/components/settings/SettingsPanel.vue` | 所有标签文本改用 `t()`，新增语言选择 |
| `src/components/file-tree/FileTree.vue` | 空状态/拖拽提示改用 `t()` |
| `src/components/file-tree/TreeSearch.vue` | placeholder 和统计改用 `t()` |
| `src/components/search/SearchPanel.vue` | placeholder/状态/分组标题改用 `t()` |
| `src/components/tabs/TabBar.vue` | 占位文本和菜单改用 `t()` |
| `src/components/common/ConflictDialog.vue` | 标题/消息/按钮改用 `t()` |
| `src/components/editor/SingleFileView.vue` | 加载/空状态改用 `t()` |
| `src/components/preview/MarkdownPreview.vue` | 渲染中/复制反馈改用 `t()` |
| `src/lib/previewThemes.ts` | `name` 改为 `nameKey`（i18n 键名）|
| `src/lib/previewTemplates.ts` | `name`/`description` 改为 `nameKey`/`descKey` |
| `src/lib/utils.ts` | `formatFileSize` 单位本地化 |
| `src/services/errorHandler.ts` | `parseError` 覆盖 message 为 i18n 翻译 |
| `src-tauri/src/models/error.rs` | `#[error("...")]` 中文化改为英文 |
