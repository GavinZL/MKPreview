# F09-01 预览区颜色主题扩展系统 [Phase 2]

## 1. 功能描述与目标

**功能描述**：扩展 Markdown 预览区域的颜色主题系统，在现有全局亮/暗两套主题不变的前提下，为预览区提供 15+ 种内置配色方案与自定义主题能力。用户可通过工具栏或设置面板切换预览区配色。

**目标**：
- 预览区颜色主题与全局 `light/dark` 应用主题**正交叠加**：全局主题控制应用 UI（文件树、工具栏、编辑器），预览区主题仅控制 `.mk-body` 渲染区域的配色。
- 提供 15 种预设主题（对应截图中的橙心、姹紫、嫩青、绿意、红绯、蓝莹、兰青、山吹、极客黑、蔷薇紫、萌绿、全栈蓝、极简黑、橙蓝风等）。
- 支持用户自定义主题：在设置面板中调整关键色值，实时预览，持久化保存。
- 通过 `data-preview-theme` 属性切换，切换时 300ms 渐变过渡。
- 主题色值通过 CSS 变量作用域限制在预览容器内，不污染应用全局样式。

**PRD 关联**：FR-007.1 ~ FR-007.3（主题与外观）、F08-01 CSS 变量主题系统

---

## 2. 技术实现方案

### 2.1 核心架构

预览区主题系统采用**三层叠加模型**：

```
Layer 1: 全局应用主题 (data-theme="light|dark")
         控制 --bg-primary, --text-primary 等基础变量
         作用于整个应用（html 元素）

Layer 2: 预览区颜色主题 (data-preview-theme="default|orange|...")
         覆盖预览区特有的强调色、链接色、装饰色
         作用于 .markdown-preview 容器

Layer 3: 预览风格模板 (data-preview-template="default|blog|...")
         控制排版、布局、字体、间距（详见 F09-02）
         作用于 .mk-body 容器
```

三层完全正交，可任意组合。例如：`light` 全局 + `blue` 预览主题 + `academic` 风格模板。

### 2.2 文件结构

```
src/assets/styles/
├── global.css                     # 现有：全局样式 + Tailwind
├── themes/
│   ├── light.css                  # 现有
│   └── dark.css                   # 现有
└── preview-themes/
    ├── _vars.css                  # 预览主题变量基础设施
    ├── _default.css               # 默认主题（无覆盖，继承全局）
    ├── orange.css                 # 橙心
    ├── purple.css                 # 姹紫
    ├── teal.css                   # 嫩青
    ├── green.css                  # 绿意
    ├── red.css                    # 红绯
    ├── blue.css                   # 蓝莹
    ├── indigo.css                 # 兰青
    ├── amber.css                  # 山吹
    ├── geek-black.css             # 极客黑
    ├── rose.css                   # 蔷薇紫
    ├── mint.css                   # 萌绿
    ├── fullstack-blue.css         # 全栈蓝
    ├── minimal-black.css          # 极简黑
    ├── orange-blue.css            # 橙蓝风
    └── index.css                  # 统一入口
```

### 2.3 CSS 变量作用域设计

```css
/* preview-themes/_vars.css */

/*
 * 预览区主题只覆盖以下变量，其余继承全局 data-theme。
 * 被覆盖的变量按优先级从高到低：
 *   1. [data-preview-theme] 显式定义
 *   2. 全局 [data-theme="dark"] 定义
 *   3. :root 默认值
 */

/* 预览区容器背景（可选，用于需要整体氛围色的主题） */
--preview-bg: transparent;

/* 强调色系 */
--preview-accent: var(--accent);
--preview-accent-hover: var(--accent-hover);
--preview-accent-red: var(--accent-red);
--preview-accent-green: var(--accent-green);
--preview-accent-amber: var(--accent-amber);
--preview-accent-purple: var(--accent-purple);

/* 文字链接色 */
--preview-text-link: var(--text-link);
--preview-text-link-hover: var(--text-link-hover);

/* 装饰线/引用块颜色 */
--preview-border-accent: var(--accent);
```

在 `.mk-body` 样式中，关键颜色引用改为优先使用预览主题变量：

```css
/* markdown/base.css 中的引用方式调整 */
.mk-body h2 {
  border-left: 4px solid var(--preview-accent-red, var(--accent-red));
}

.mk-body a {
  color: var(--preview-text-link, var(--text-link));
}

.mk-body blockquote {
  border-left-color: var(--preview-border-accent, var(--accent));
}
```

### 2.4 主题样式示例（橙心）

```css
/* preview-themes/orange.css */

.markdown-preview[data-preview-theme="orange"] {
  --preview-bg: #fff7ed;
}

.markdown-preview[data-preview-theme="orange"] .mk-body {
  --preview-accent: #f97316;
  --preview-accent-hover: #ea580c;
  --preview-accent-red: #ef4444;
  --preview-accent-green: #22c55e;
  --preview-accent-amber: #f59e0b;
  --preview-accent-purple: #a855f7;
  --preview-text-link: #f97316;
  --preview-text-link-hover: #ea580c;
  --preview-border-accent: #f97316;
}

/* 暗色全局下的橙心适配 */
[data-theme="dark"] .markdown-preview[data-preview-theme="orange"] {
  --preview-bg: #2a1810;
}

[data-theme="dark"] .markdown-preview[data-preview-theme="orange"] .mk-body {
  --preview-accent: #fb923c;
  --preview-accent-hover: #fdba74;
  --preview-accent-red: #f87171;
  --preview-accent-green: #4ade80;
  --preview-accent-amber: #fbbf24;
  --preview-accent-purple: #c084fc;
  --preview-text-link: #fb923c;
  --preview-text-link-hover: #fdba74;
  --preview-border-accent: #fb923c;
}
```

### 2.5 预设主题完整色值表

| 主题 ID | 名称 | Light 模式强调色 | Light 模式背景 | Dark 模式强调色 | Dark 模式背景 |
|---------|------|------------------|----------------|-----------------|---------------|
| default | 默认主题 | 继承全局 | transparent | 继承全局 | transparent |
| orange | 橙心 | `#f97316` | `#fff7ed` | `#fb923c` | `#2a1810` |
| purple | 姹紫 | `#8b5cf6` | `#f5f3ff` | `#a78bfa` | `#1e1b2e` |
| teal | 嫩青 | `#14b8a6` | `#f0fdfa` | `#2dd4bf` | `#102a25` |
| green | 绿意 | `#22c55e` | `#f0fdf4` | `#4ade80` | `#102a15` |
| red | 红绯 | `#e11d48` | `#fff1f2` | `#fb7185` | `#2a1015` |
| blue | 蓝莹 | `#3b82f6` | `#eff6ff` | `#60a5fa` | `#0f1a2e` |
| indigo | 兰青 | `#6366f1` | `#eef2ff` | `#818cf8` | `#181a2e` |
| amber | 山吹 | `#d97706` | `#fffbeb` | `#fbbf24` | `#2a2010` |
| geek-black | 极客黑 | `#10b981` | `#0a0a0a` | `#10b981` | `#050505` |
| rose | 蔷薇紫 | `#e879f9` | `#fdf4ff` | `#f0abfc` | `#2a182e` |
| mint | 萌绿 | `#10b981` | `#ecfdf5` | `#34d399` | `#0f291e` |
| fullstack-blue | 全栈蓝 | `#0ea5e9` | `#f0f9ff` | `#38bdf8` | `#0a1f2e` |
| minimal-black | 极简黑 | `#171717` | `#fafafa` | `#d4d4d4` | `#0a0a0a` |
| orange-blue | 橙蓝风 | `#2563eb` | `#fff7ed` | `#3b82f6` | `#1a1025` |

注：
- `geek-black` 在两种全局模式下均使用深色预览背景，以营造极客风格。
- `minimal-black` 强调黑白灰，强调色退化为深灰/浅灰。
- `orange-blue` 以蓝色为强调色、橙色为点缀色，形成撞色效果。

### 2.6 自定义主题

```typescript
// types/previewTheme.ts

/** 自定义主题颜色配置 */
export interface CustomThemeColors {
  accent: string
  accentRed: string
  accentGreen: string
  accentAmber: string
  accentPurple: string
  textLink: string
  textLinkHover: string
  borderAccent: string
  previewBgLight: string
  previewBgDark: string
}

/** 预览主题定义 */
export interface PreviewTheme {
  id: string
  name: string
  description?: string
  isBuiltIn: boolean
  colors?: CustomThemeColors
}

/** 内置主题 ID */
export type BuiltInPreviewThemeId =
  | 'default'
  | 'orange'
  | 'purple'
  | 'teal'
  | 'green'
  | 'red'
  | 'blue'
  | 'indigo'
  | 'amber'
  | 'geek-black'
  | 'rose'
  | 'mint'
  | 'fullstack-blue'
  | 'minimal-black'
  | 'orange-blue'
  | 'custom'

/** 用户保存的自定义主题 */
export interface SavedCustomTheme {
  id: string
  name: string
  colors: CustomThemeColors
  createdAt: number
}
```

自定义主题通过动态 CSS 注入实现：

```typescript
// lib/previewThemeInjector.ts

export function injectCustomTheme(theme: SavedCustomTheme): void {
  const styleId = `preview-theme-custom-${theme.id}`
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null

  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = styleId
    document.head.appendChild(styleEl)
  }

  const c = theme.colors
  styleEl.textContent = `
    .markdown-preview[data-preview-theme="${theme.id}"] {
      --preview-bg: ${c.previewBgLight};
    }
    .markdown-preview[data-preview-theme="${theme.id}"] .mk-body {
      --preview-accent: ${c.accent};
      --preview-accent-hover: ${c.accent};
      --preview-accent-red: ${c.accentRed};
      --preview-accent-green: ${c.accentGreen};
      --preview-accent-amber: ${c.accentAmber};
      --preview-accent-purple: ${c.accentPurple};
      --preview-text-link: ${c.textLink};
      --preview-text-link-hover: ${c.textLinkHover};
      --preview-border-accent: ${c.borderAccent};
    }
    [data-theme="dark"] .markdown-preview[data-preview-theme="${theme.id}"] {
      --preview-bg: ${c.previewBgDark};
    }
  `
}
```

### 2.7 usePreviewTheme Composable

```typescript
// composables/usePreviewTheme.ts

import { ref, computed, watch } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import type { BuiltInPreviewThemeId, SavedCustomTheme } from '@/types/previewTheme'

export function usePreviewTheme() {
  const settingsStore = useSettingsStore()
  const currentTheme = computed<BuiltInPreviewThemeId>(() => settingsStore.previewTheme)

  function applyTheme(themeId: BuiltInPreviewThemeId) {
    // 查找所有 .markdown-preview 容器并设置属性
    document.querySelectorAll('.markdown-preview').forEach((el) => {
      el.setAttribute('data-preview-theme', themeId)
    })
  }

  function setTheme(themeId: BuiltInPreviewThemeId) {
    settingsStore.setPreviewTheme(themeId)
    applyTheme(themeId)
  }

  // 当设置恢复或切换时自动应用
  watch(currentTheme, (id) => { applyTheme(id) }, { immediate: true })

  return {
    currentTheme,
    setTheme,
    applyTheme,
  }
}
```

### 2.8 SettingsStore 扩展

```typescript
// stores/settingsStore.ts 扩展

const defaultSettings: Settings = {
  // ... 现有字段
  previewTheme: 'default',
  previewTemplate: 'default',
  customThemes: [],
}

// State 新增
const previewTheme = ref<BuiltInPreviewThemeId>('default')
const customThemes = ref<SavedCustomTheme[]>([])

// Actions 新增
function setPreviewTheme(id: BuiltInPreviewThemeId) {
  previewTheme.value = id
}

function addCustomTheme(theme: SavedCustomTheme) {
  customThemes.value = [theme, ...customThemes.value].slice(0, 10)
}

function deleteCustomTheme(id: string) {
  customThemes.value = customThemes.value.filter(t => t.id !== id)
}
```

---

## 3. 接口定义

### 3.1 PreviewTheme 类型

```typescript
// types/previewTheme.ts

export type BuiltInPreviewThemeId =
  | 'default' | 'orange' | 'purple' | 'teal' | 'green' | 'red'
  | 'blue' | 'indigo' | 'amber' | 'geek-black' | 'rose' | 'mint'
  | 'fullstack-blue' | 'minimal-black' | 'orange-blue' | 'custom'

export interface SavedCustomTheme {
  id: string
  name: string
  colors: {
    accent: string
    accentRed: string
    accentGreen: string
    accentAmber: string
    accentPurple: string
    textLink: string
    textLinkHover: string
    borderAccent: string
    previewBgLight: string
    previewBgDark: string
  }
  createdAt: number
}
```

### 3.2 Settings 扩展

```typescript
// types/settings.ts

export interface Settings {
  // ... 现有字段
  previewTheme: BuiltInPreviewThemeId
  previewTemplate: string
  customThemes: SavedCustomTheme[]
}
```

### 3.3 usePreviewThemeReturn

```typescript
interface UsePreviewThemeReturn {
  currentTheme: Ref<BuiltInPreviewThemeId>
  setTheme: (id: BuiltInPreviewThemeId) => void
  applyTheme: (id: BuiltInPreviewThemeId) => void
}
```

---

## 4. 数据结构

### 4.1 内置主题注册表

```typescript
// lib/previewThemes.ts

import type { PreviewTheme } from '@/types/previewTheme'

export const builtInPreviewThemes: PreviewTheme[] = [
  { id: 'default', name: '默认主题', isBuiltIn: true },
  { id: 'orange', name: '橙心', isBuiltIn: true },
  { id: 'purple', name: '姹紫', isBuiltIn: true },
  { id: 'teal', name: '嫩青', isBuiltIn: true },
  { id: 'green', name: '绿意', isBuiltIn: true },
  { id: 'red', name: '红绯', isBuiltIn: true },
  { id: 'blue', name: '蓝莹', isBuiltIn: true },
  { id: 'indigo', name: '兰青', isBuiltIn: true },
  { id: 'amber', name: '山吹', isBuiltIn: true },
  { id: 'geek-black', name: '极客黑', isBuiltIn: true },
  { id: 'rose', name: '蔷薇紫', isBuiltIn: true },
  { id: 'mint', name: '萌绿', isBuiltIn: true },
  { id: 'fullstack-blue', name: '全栈蓝', isBuiltIn: true },
  { id: 'minimal-black', name: '极简黑', isBuiltIn: true },
  { id: 'orange-blue', name: '橙蓝风', isBuiltIn: true },
]
```

---

## 5. 依赖关系

| 依赖模块 | 特性 | 说明 |
|---------|------|------|
| F08-01 | CSS 变量主题系统 | 依赖全局 light/dark 变量作为基础层 |
| F08-03 | 设置面板 | 主题选择器 UI 嵌入设置面板 |
| F06-02 | 基础元素渲染样式 | .mk-body 样式需引用 --preview-* 变量 |
| F06-06 | 预览主组件 | MarkdownPreview.vue 需绑定 data-preview-theme |

**被依赖**：
- F09-02 预览风格模板系统（共用 MarkdownPreview.vue 容器属性）

---

## 6. 测试要点

### 6.1 视觉回归测试

| 测试项 | 亮色全局 + 橙心 | 暗色全局 + 橙心 |
|--------|-----------------|-----------------|
| 预览区背景 | `#fff7ed` | `#2a1810` |
| H2 左边框 | `#f97316` | `#fb923c` |
| 链接颜色 | `#f97316` | `#fb923c` |
| 引用块竖线 | `#f97316` | `#fb923c` |

### 6.2 主题切换测试

1. 切换 `data-preview-theme="orange"` -> 预览区颜色变量立即更新
2. 切换全局 `data-theme="dark"` -> 预览区跟随切换暗色适配值
3. 切换 `data-preview-theme="default"` -> 恢复继承全局颜色
4. 过渡动画：颜色变化有 300ms 渐变效果

### 6.3 自定义主题测试

1. 创建自定义主题 -> 动态 `<style>` 标签正确注入
2. 切换自定义主题 -> 颜色正确应用
3. 删除自定义主题 -> `<style>` 标签移除
4. 自定义主题持久化 -> 重启后恢复
