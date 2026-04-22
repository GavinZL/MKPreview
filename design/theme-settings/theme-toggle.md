# F08-02 主题切换功能 [MVP]

## 1. 功能描述与目标

**功能描述**：实现应用主题的检测、切换与持久化。支持跟随系统主题偏好（自动切换亮/暗色）、手动切换（工具栏按钮 / 快捷键），切换时带有 300ms 渐变过渡效果。

**目标**：
- 应用启动时检测系统 `prefers-color-scheme` 偏好
- 默认跟随系统主题（可配置为固定亮色/暗色）
- 工具栏提供主题切换按钮（太阳/月亮图标）
- 快捷键 Cmd/Ctrl+Shift+T 切换主题
- 主题切换时所有组件（含 CodeMirror、Mermaid）同步响应
- 通过 `settingsStore` 持久化用户主题偏好
- 切换过程 300ms 渐变，无闪烁

**PRD 关联**：FR-007.1 ~ FR-007.3（主题与外观）、附录 A 快捷键

---

## 2. 技术实现方案

### 2.1 useTheme Composable

```typescript
// composables/useTheme.ts
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

/**
 * 主题管理 Composable
 * - 检测系统主题偏好
 * - 支持跟随系统 / 固定亮色 / 固定暗色
 * - 切换时更新 <html data-theme> 属性
 * - 同步 CodeMirror / Mermaid 等第三方组件主题
 */
export function useTheme() {
  const settingsStore = useSettingsStore()

  // 系统主题媒体查询
  const mediaQuery = ref<MediaQueryList | null>(null)

  // 当前解析后的实际主题（light | dark）
  const resolvedTheme = ref<ResolvedTheme>('light')

  // 用户偏好设置
  const themePreference = computed<ThemePreference>(() => settingsStore.theme)

  /** 解析最终主题 */
  function resolveTheme(): ResolvedTheme {
    const preference = themePreference.value
    if (preference === 'system') {
      return getSystemTheme()
    }
    return preference
  }

  /** 获取系统当前主题 */
  function getSystemTheme(): ResolvedTheme {
    if (window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }
    return 'light'
  }

  /** 应用主题到 DOM */
  function applyTheme(theme: ResolvedTheme) {
    document.documentElement.setAttribute('data-theme', theme)
    resolvedTheme.value = theme

    // 同步 CodeMirror 主题（通过事件或全局状态）
    window.dispatchEvent(new CustomEvent('mkpreview:themechange', {
      detail: { theme },
    }))

    // 同步 Mermaid 主题（Phase 2）
    // mermaid.initialize({ theme: theme === 'dark' ? 'dark' : 'default' })
  }

  /** 设置主题偏好 */
  function setThemePreference(preference: ThemePreference) {
    settingsStore.setTheme(preference)
    applyTheme(resolveTheme())
  }

  /** 切换主题（在 light/dark 之间切换） */
  function toggleTheme() {
    const current = resolvedTheme.value
    const next: ResolvedTheme = current === 'light' ? 'dark' : 'light'

    // 如果当前是跟随系统，则切换为固定模式
    if (themePreference.value === 'system') {
      setThemePreference(next)
    } else {
      // 固定模式下直接切换
      setThemePreference(next)
    }
  }

  /** 系统主题变化回调 */
  function handleSystemChange(e: MediaQueryListEvent) {
    if (themePreference.value === 'system') {
      applyTheme(e.matches ? 'dark' : 'light')
    }
  }

  // 初始化
  onMounted(() => {
    // 监听系统主题变化
    mediaQuery.value = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.value.addEventListener('change', handleSystemChange)

    // 应用当前主题
    applyTheme(resolveTheme())
  })

  onUnmounted(() => {
    mediaQuery.value?.removeEventListener('change', handleSystemChange)
  })

  // 监听偏好变化（从设置恢复时）
  watch(themePreference, () => {
    applyTheme(resolveTheme())
  })

  const isDark = computed(() => resolvedTheme.value === 'dark')

  return {
    themePreference,
    resolvedTheme,
    isDark,
    setThemePreference,
    toggleTheme,
  }
}
```

### 2.2 SettingsStore 主题状态

```typescript
// stores/settingsStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ThemePreference, DisplayMode } from '@/types/settings'

export const useSettingsStore = defineStore('settings', () => {
  // ========== State ==========
  const theme = ref<ThemePreference>('system')
  const displayMode = ref<DisplayMode>('preview')

  // Phase 2/3 扩展
  const fontBody = ref("'LXGW WenKai', 'Noto Serif SC', Georgia, serif")
  const fontCode = ref("'JetBrains Mono', 'Fira Code', Menlo, monospace")
  const fontSizeBody = ref(16)
  const fontSizeCode = ref(14)
  const showLineNumbers = ref(true)
  const autoSaveEnabled = ref(true)
  const autoSaveDelay = ref(3000)

  // ========== Getters ==========
  const isDarkTheme = computed(() => {
    if (theme.value === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return theme.value === 'dark'
  })

  // ========== Actions ==========
  function setTheme(preference: ThemePreference) {
    theme.value = preference
  }

  function setDisplayMode(mode: DisplayMode) {
    displayMode.value = mode
  }

  // Phase 2/3 设置项
  function setFontBody(font: string) {
    fontBody.value = font
    document.documentElement.style.setProperty('--font-body', font)
  }

  function setFontCode(font: string) {
    fontCode.value = font
    document.documentElement.style.setProperty('--font-mono', font)
  }

  return {
    theme,
    displayMode,
    fontBody,
    fontCode,
    fontSizeBody,
    fontSizeCode,
    showLineNumbers,
    autoSaveEnabled,
    autoSaveDelay,
    isDarkTheme,
    setTheme,
    setDisplayMode,
    setFontBody,
    setFontCode,
  }
})
```

### 2.3 工具栏主题切换按钮

```vue
<!-- 工具栏中的主题切换按钮 -->
<template>
  <button
    class="icon-btn"
    :title="`切换主题 (${modifierKey}+Shift+T)`"
    @click="toggleTheme"
  >
    <SunIcon v-if="isDark" class="theme-icon" />
    <MoonIcon v-else class="theme-icon" />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'
import SunIcon from '@/components/icons/SunIcon.vue'
import MoonIcon from '@/components/icons/MoonIcon.vue'

const { isDark, toggleTheme } = useTheme()

const modifierKey = computed(() => {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? 'Cmd' : 'Ctrl'
})
</script>
```

### 2.4 主题切换 CSS 过渡

```css
/* global.css - 主题过渡 */

/* 全局颜色过渡 */
*,
*::before,
*::after {
  transition: background-color 300ms ease,
              color 300ms ease,
              border-color 300ms ease,
              box-shadow 300ms ease;
}

/* 排除不需要过渡的元素 */
img,
.mermaid svg,
.katex,
.cm-editor,
.cm-editor * {
  transition: none !important;
}

/* CodeMirror 主题切换需单独处理 */
.cm-editor {
  transition: background-color 300ms ease !important;
}
```

### 2.5 CodeMirror 主题同步

```typescript
// 在 SourceEditor.vue 中监听主题变化
import { onMounted } from 'vue'

onMounted(() => {
  // 监听全局主题变化事件
  window.addEventListener('mkpreview:themechange', (e: Event) => {
    const customEvent = e as CustomEvent<{ theme: 'light' | 'dark' }>
    const isDark = customEvent.detail.theme === 'dark'
    setTheme(isDark)
  })
})
```

---

## 3. 接口定义

### 3.1 useTheme Composable

```typescript
// composables/useTheme.ts
export interface UseThemeReturn {
  /** 用户主题偏好（system / light / dark） */
  themePreference: Ref<ThemePreference>
  /** 解析后的实际主题（light / dark） */
  resolvedTheme: Ref<ResolvedTheme>
  /** 当前是否为暗色主题 */
  isDark: ComputedRef<boolean>
  /** 设置主题偏好 */
  setThemePreference: (preference: ThemePreference) => void
  /** 切换主题（light ↔ dark） */
  toggleTheme: () => void
}
```

### 3.2 SettingsStore 接口

```typescript
// stores/settingsStore.ts
export interface SettingsState {
  theme: ThemePreference
  displayMode: DisplayMode
  // ... 其他设置项
}

export interface SettingsActions {
  setTheme(preference: ThemePreference): void
  setDisplayMode(mode: DisplayMode): void
}
```

### 3.3 全局主题变化事件

```typescript
// 自定义事件类型
interface ThemeChangeEvent extends CustomEvent {
  detail: {
    theme: 'light' | 'dark'
  }
}

// 事件名：mkpreview:themechange
```

---

## 4. 数据结构

### 4.1 Theme 类型定义

```typescript
// types/settings.ts

/** 用户主题偏好 */
export type ThemePreference = 'system' | 'light' | 'dark'

/** 解析后的实际主题 */
export type ResolvedTheme = 'light' | 'dark'

/** 显示模式 */
export type DisplayMode = 'preview' | 'source' | 'split'

/** 完整设置状态 */
export interface Settings {
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
}
```

### 4.2 主题切换状态机

```
当前偏好: system
    │
    ├──► 系统为 light ──► 应用 light
    └──► 系统为 dark ───► 应用 dark

当前偏好: light
    │
    └──► 应用 light

当前偏好: dark
    │
    └──► 应用 dark

切换操作 (toggleTheme):
    system + 系统 light ──► 固定 dark
    system + 系统 dark ───► 固定 light
    light ────────────────► dark
    dark ─────────────────► light
```

---

## 5. 依赖关系

| 依赖模块 | 特性 | 说明 |
|---------|------|------|
| M08 | F08-01 CSS 变量主题系统 | 依赖 light.css / dark.css 变量定义 |
| M03 | F03-02 工具栏组件 | 主题切换按钮嵌入工具栏 |
| M07 | F07-02 模式切换 | 快捷键系统中注册 Cmd+Shift+T |

**被依赖**：
- M07 F07-01 CodeMirror 只读查看器（需监听主题变化同步编辑器主题）
- M06 F06-04 Mermaid 图表渲染（P2 需同步 mermaid 主题）
- M08 F08-03 设置面板（显示当前主题偏好选项）
- M08 F08-04 配置持久化（持久化用户主题偏好）

---

## 6. 测试要点

### 6.1 单元测试

| 测试项 | 输入 | 预期结果 |
|--------|------|---------|
| 跟随系统 light | preference='system', matchMedia=light | resolvedTheme='light' |
| 跟随系统 dark | preference='system', matchMedia=dark | resolvedTheme='dark' |
| 固定 light | preference='light' | resolvedTheme='light' |
| 固定 dark | preference='dark' | resolvedTheme='dark' |
| 切换 | toggleTheme() from light | preference='dark', DOM data-theme='dark' |
| 系统变化 | 系统从 light 变 dark, preference='system' | 自动切换到 dark |
| 系统变化（固定模式） | 系统变化, preference='light' | 保持 light |

### 6.2 视觉测试

1. **过渡动画**：切换主题时颜色在 300ms 内渐变，无突兀跳变
2. **图标变化**：暗色时显示太阳图标（点击切换到亮色），亮色时显示月亮图标
3. **CodeMirror 同步**：切换主题后编辑器背景/文字颜色同步更新
4. **滚动条**：暗色主题下滚动条颜色变浅

### 6.3 跨平台测试

| 平台 | 测试项 |
|------|--------|
| macOS | prefers-color-scheme 检测正确 |
| Windows | prefers-color-scheme 检测正确 |
| macOS | Cmd+Shift+T 切换主题 |
| Windows | Ctrl+Shift+T 切换主题 |

### 6.4 E2E 测试

- 系统主题为暗色，启动应用 → 应用自动使用暗色主题
- 点击工具栏主题按钮 → 主题切换，图标变化
- 切换系统主题 → 应用自动跟随（如 preference='system'）
- 重启应用 → 恢复上次设置的主题偏好
