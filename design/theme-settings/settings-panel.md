# F08-03 设置面板 [Phase 2]

## 1. 功能描述与目标

**功能描述**：Phase 2 阶段实现设置面板，以弹出覆盖层（Overlay）形式展示。用户可配置主题、字体、编辑器行为、预览选项等。

**目标**：
- 从侧栏底部设置按钮或快捷键打开设置面板
- 设置项分组：外观 / 编辑器 / 预览
- 外观：主题选择（跟随系统/亮色/暗色）、正文字体、代码字体
- 编辑器：自动保存开关及间隔、行号显示开关、代码折叠开关
- 预览：Mermaid 图表开关、KaTeX 数学公式开关
- 使用 Toggle 开关、下拉选择等控件
- 设置变更即时生效
- 面板支持 ESC 键关闭、点击外部关闭

**PRD 关联**：FR-007.7（应用字体可配置）、原型设计 settings-panel.png

---

## 2. 技术实现方案

### 2.1 SettingsPanel.vue 组件

```vue
<!-- components/settings/SettingsPanel.vue -->
<template>
  <Transition name="settings-slide">
    <div v-if="visible" class="settings-overlay" @click.self="close">
      <div class="settings-panel">
        <div class="settings-header">
          <h2 class="settings-title">设置</h2>
          <button class="settings-close" @click="close">
            <CloseIcon />
          </button>
        </div>

        <!-- 外观设置 -->
        <SettingsSection title="外观">
          <SettingsRow label="主题" description="选择应用界面主题">
            <select v-model="theme" class="select-box">
              <option value="system">跟随系统</option>
              <option value="light">亮色</option>
              <option value="dark">暗色</option>
            </select>
          </SettingsRow>

          <SettingsRow label="正文字体" description="Markdown 渲染字体">
            <select v-model="fontBody" class="select-box">
              <option value="'LXGW WenKai', 'Noto Serif SC', Georgia, serif">霞鹜文楷</option>
              <option value="'Noto Serif SC', Georgia, serif">Noto Serif SC</option>
              <option value="-apple-system, BlinkMacSystemFont, sans-serif">系统默认</option>
            </select>
          </SettingsRow>

          <SettingsRow label="代码字体" description="代码块与编辑器字体">
            <select v-model="fontCode" class="select-box">
              <option value="'JetBrains Mono', 'Fira Code', Menlo, monospace">JetBrains Mono</option>
              <option value="'Fira Code', Menlo, monospace">Fira Code</option>
              <option value="'SF Mono', Menlo, monospace">SF Mono</option>
            </select>
          </SettingsRow>
        </SettingsSection>

        <!-- 编辑器设置 -->
        <SettingsSection title="编辑器">
          <SettingsRow label="自动保存" description="无操作后自动保存">
            <Toggle v-model="autoSaveEnabled" />
          </SettingsRow>

          <SettingsRow
            v-if="autoSaveEnabled"
            label="自动保存间隔"
            description="无操作后等待的时间"
          >
            <select v-model="autoSaveDelay" class="select-box">
              <option :value="1000">1 秒</option>
              <option :value="3000">3 秒</option>
              <option :value="5000">5 秒</option>
              <option :value="10000">10 秒</option>
            </select>
          </SettingsRow>

          <SettingsRow label="显示行号" description="源码编辑器显示行号">
            <Toggle v-model="showLineNumbers" />
          </SettingsRow>

          <SettingsRow label="代码折叠" description="允许折叠代码块和标题">
            <Toggle v-model="enableFolding" />
          </SettingsRow>
        </SettingsSection>

        <!-- 预览设置 -->
        <SettingsSection title="预览">
          <SettingsRow label="Mermaid 图表" description="渲染 Mermaid 代码块">
            <Toggle v-model="enableMermaid" />
          </SettingsRow>

          <SettingsRow label="KaTeX 数学公式" description="渲染 LaTeX 数学公式">
            <Toggle v-model="enableKaTeX" />
          </SettingsRow>
        </SettingsSection>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import SettingsSection from './SettingsSection.vue'
import SettingsRow from './SettingsRow.vue'
import Toggle from '@/components/common/Toggle.vue'
import CloseIcon from '@/components/icons/CloseIcon.vue'

interface Props {
  visible: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const store = useSettingsStore()

// 双向绑定 Store 状态
const theme = computed({
  get: () => store.theme,
  set: (v) => store.setTheme(v as 'system' | 'light' | 'dark'),
})

const fontBody = computed({
  get: () => store.fontBody,
  set: (v) => store.setFontBody(v),
})

const fontCode = computed({
  get: () => store.fontCode,
  set: (v) => store.setFontCode(v),
})

const autoSaveEnabled = computed({
  get: () => store.autoSaveEnabled,
  set: (v) => store.setAutoSaveEnabled(v),
})

const autoSaveDelay = computed({
  get: () => store.autoSaveDelay,
  set: (v) => store.setAutoSaveDelay(v),
})

const showLineNumbers = computed({
  get: () => store.showLineNumbers,
  set: (v) => store.setShowLineNumbers(v),
})

const enableFolding = computed({
  get: () => store.enableFolding,
  set: (v) => store.setEnableFolding(v),
})

const enableMermaid = computed({
  get: () => store.enableMermaid,
  set: (v) => store.setEnableMermaid(v),
})

const enableKaTeX = computed({
  get: () => store.enableKaTeX,
  set: (v) => store.setEnableKaTeX(v),
})

function close() {
  emit('close')
}

// ESC 键关闭
useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') close()
})
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  z-index: var(--z-modal);
  display: flex;
  justify-content: flex-end;
}

.settings-panel {
  width: 420px;
  max-width: 90vw;
  height: 100%;
  background: var(--bg-primary);
  border-left: 1px solid var(--border);
  overflow-y: auto;
  padding: 24px;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.settings-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.settings-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s;
}

.settings-close:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

/* 滑入动画 */
.settings-slide-enter-active,
.settings-slide-leave-active {
  transition: opacity 200ms ease;
}

.settings-slide-enter-active .settings-panel,
.settings-slide-leave-active .settings-panel {
  transition: transform 200ms ease;
}

.settings-slide-enter-from,
.settings-slide-leave-to {
  opacity: 0;
}

.settings-slide-enter-from .settings-panel,
.settings-slide-leave-to .settings-panel {
  transform: translateX(100%);
}
</style>
```

### 2.2 设置项子组件

```vue
<!-- components/settings/SettingsSection.vue -->
<template>
  <div class="settings-section">
    <h3 class="section-title">{{ title }}</h3>
    <div class="section-content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string
}
defineProps<Props>()
</script>

<style scoped>
.settings-section {
  margin-bottom: 28px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.section-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
```

```vue
<!-- components/settings/SettingsRow.vue -->
<template>
  <div class="setting-row">
    <div class="setting-info">
      <div class="setting-label">{{ label }}</div>
      <div v-if="description" class="setting-desc">{{ description }}</div>
    </div>
    <div class="setting-control">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  label: string
  description?: string
}
defineProps<Props>()
</script>

<style scoped>
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  gap: 16px;
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-label {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}

.setting-desc {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.setting-control {
  flex-shrink: 0;
}
</style>
```

### 2.3 Toggle 开关组件

```vue
<!-- components/common/Toggle.vue -->
<template>
  <button
    class="toggle"
    :class="{ on: modelValue }"
    @click="toggle"
    role="switch"
    :aria-checked="modelValue"
  >
    <span class="toggle-thumb" />
  </button>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function toggle() {
  emit('update:modelValue', !props.modelValue)
}
</script>

<style scoped>
.toggle {
  width: 36px;
  height: 20px;
  background: var(--border);
  border-radius: 10px;
  position: relative;
  cursor: pointer;
  border: none;
  padding: 0;
  transition: background 0.2s;
}

.toggle.on {
  background: var(--accent);
}

.toggle-thumb {
  position: absolute;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.toggle.on .toggle-thumb {
  transform: translateX(16px);
}
</style>
```

### 2.4 SettingsStore 扩展（Phase 2 完整版）

```typescript
// stores/settingsStore.ts (Phase 2)
export const useSettingsStore = defineStore('settings', () => {
  // ... MVP 已有状态

  // Phase 2 新增状态
  const enableFolding = ref(true)
  const enableMermaid = ref(true)
  const enableKaTeX = ref(true)

  // Phase 2 新增 Actions
  function setAutoSaveEnabled(enabled: boolean) {
    autoSaveEnabled.value = enabled
  }

  function setAutoSaveDelay(delay: number) {
    autoSaveDelay.value = delay
  }

  function setShowLineNumbers(show: boolean) {
    showLineNumbers.value = show
  }

  function setEnableFolding(enabled: boolean) {
    enableFolding.value = enabled
  }

  function setEnableMermaid(enabled: boolean) {
    enableMermaid.value = enabled
  }

  function setEnableKaTeX(enabled: boolean) {
    enableKaTeX.value = enabled
  }

  // 导出所有设置（用于持久化）
  function exportSettings(): Record<string, unknown> {
    return {
      theme: theme.value,
      displayMode: displayMode.value,
      fontBody: fontBody.value,
      fontCode: fontCode.value,
      fontSizeBody: fontSizeBody.value,
      fontSizeCode: fontSizeCode.value,
      showLineNumbers: showLineNumbers.value,
      autoSaveEnabled: autoSaveEnabled.value,
      autoSaveDelay: autoSaveDelay.value,
      enableFolding: enableFolding.value,
      enableMermaid: enableMermaid.value,
      enableKaTeX: enableKaTeX.value,
    }
  }

  // 导入设置（恢复时）
  function importSettings(settings: Record<string, unknown>) {
    if (settings.theme) theme.value = settings.theme as ThemePreference
    if (settings.displayMode) displayMode.value = settings.displayMode as DisplayMode
    if (settings.fontBody) fontBody.value = settings.fontBody as string
    if (settings.fontCode) fontCode.value = settings.fontCode as string
    if (settings.fontSizeBody) fontSizeBody.value = settings.fontSizeBody as number
    if (settings.fontSizeCode) fontSizeCode.value = settings.fontSizeCode as number
    if (typeof settings.showLineNumbers === 'boolean') showLineNumbers.value = settings.showLineNumbers
    if (typeof settings.autoSaveEnabled === 'boolean') autoSaveEnabled.value = settings.autoSaveEnabled
    if (settings.autoSaveDelay) autoSaveDelay.value = settings.autoSaveDelay as number
    if (typeof settings.enableFolding === 'boolean') enableFolding.value = settings.enableFolding
    if (typeof settings.enableMermaid === 'boolean') enableMermaid.value = settings.enableMermaid
    if (typeof settings.enableKaTeX === 'boolean') enableKaTeX.value = settings.enableKaTeX
  }

  return {
    // ... 原有导出
    enableFolding,
    enableMermaid,
    enableKaTeX,
    setAutoSaveEnabled,
    setAutoSaveDelay,
    setShowLineNumbers,
    setEnableFolding,
    setEnableMermaid,
    setEnableKaTeX,
    exportSettings,
    importSettings,
  }
})
```

---

## 3. 接口定义

### 3.1 SettingsPanel.vue Props / Emits

```typescript
interface SettingsPanelProps {
  visible: boolean
}

interface SettingsPanelEmits {
  close: []
}
```

### 3.2 设置项控件 Props

```typescript
// Toggle.vue
interface ToggleProps {
  modelValue: boolean
}

// SettingsRow.vue
interface SettingsRowProps {
  label: string
  description?: string
}

// SettingsSection.vue
interface SettingsSectionProps {
  title: string
}
```

### 3.3 SettingsStore Phase 2 接口

```typescript
interface SettingsStorePhase2 {
  // 新增 State
  enableFolding: Ref<boolean>
  enableMermaid: Ref<boolean>
  enableKaTeX: Ref<boolean>

  // 新增 Actions
  setAutoSaveEnabled(enabled: boolean): void
  setAutoSaveDelay(delay: number): void
  setShowLineNumbers(show: boolean): void
  setEnableFolding(enabled: boolean): void
  setEnableMermaid(enabled: boolean): void
  setEnableKaTeX(enabled: boolean): void
  exportSettings(): Record<string, unknown>
  importSettings(settings: Record<string, unknown>): void
}
```

---

## 4. 数据结构

### 4.1 设置面板数据结构

```typescript
// types/settings.ts

export interface SettingsPanelGroup {
  id: string
  title: string
  items: SettingsPanelItem[]
}

export interface SettingsPanelItem {
  id: string
  type: 'select' | 'toggle' | 'number' | 'text'
  label: string
  description?: string
  options?: { label: string; value: string | number }[]
  min?: number
  max?: number
  step?: number
}

// 设置面板配置（用于动态渲染）
export const SETTINGS_PANEL_CONFIG: SettingsPanelGroup[] = [
  {
    id: 'appearance',
    title: '外观',
    items: [
      { id: 'theme', type: 'select', label: '主题', description: '选择应用界面主题', options: [
        { label: '跟随系统', value: 'system' },
        { label: '亮色', value: 'light' },
        { label: '暗色', value: 'dark' },
      ]},
      { id: 'fontBody', type: 'select', label: '正文字体', description: 'Markdown 渲染字体' },
      { id: 'fontCode', type: 'select', label: '代码字体', description: '代码块与编辑器字体' },
    ],
  },
  {
    id: 'editor',
    title: '编辑器',
    items: [
      { id: 'autoSaveEnabled', type: 'toggle', label: '自动保存', description: '无操作后自动保存' },
      { id: 'autoSaveDelay', type: 'select', label: '自动保存间隔', description: '无操作后等待的时间' },
      { id: 'showLineNumbers', type: 'toggle', label: '显示行号', description: '源码编辑器显示行号' },
      { id: 'enableFolding', type: 'toggle', label: '代码折叠', description: '允许折叠代码块和标题' },
    ],
  },
  {
    id: 'preview',
    title: '预览',
    items: [
      { id: 'enableMermaid', type: 'toggle', label: 'Mermaid 图表', description: '渲染 Mermaid 代码块' },
      { id: 'enableKaTeX', type: 'toggle', label: 'KaTeX 数学公式', description: '渲染 LaTeX 数学公式' },
    ],
  },
]
```

---

## 5. 依赖关系

| 依赖模块 | 特性 | 说明 |
|---------|------|------|
| M08 | F08-01 CSS 变量主题系统 | 设置面板样式依赖主题变量 |
| M08 | F08-02 主题切换功能 | 主题设置直接调用 setTheme |
| M02 | F02-05 配置持久化服务 | 设置变更后需持久化 |

**被依赖**：
- M08 F08-04 配置持久化（导出/导入设置）
- M03 F03-02 工具栏（设置按钮触发面板显示）

---

## 6. 测试要点

### 6.1 单元测试

| 测试项 | 操作 | 预期结果 |
|--------|------|---------|
| 打开面板 | visible = true | 面板从右侧滑入 |
| 关闭面板 | 点击遮罩 / ESC / 关闭按钮 | 面板滑出，emit close |
| 切换主题 | 选择 "暗色" | Store theme = 'dark'，应用主题更新 |
| 切换字体 | 选择 "Noto Serif SC" | --font-body 更新 |
| Toggle 开关 | 点击自动保存 Toggle | autoSaveEnabled 取反 |
| 设置联动 | 关闭自动保存 | 自动保存间隔选择框隐藏 |

### 6.2 视觉测试

1. 面板从右侧滑入，宽度 420px
2. 分组标题大写 + 灰色 + 字母间距
3. Toggle 开关动画：0.2s 滑动 + 背景色变化
4. 暗色主题下面板背景、文字、边框色正确

### 6.3 交互测试

- 点击遮罩关闭面板
- ESC 键关闭面板
- 面板打开时底部内容不可交互
- 设置变更即时生效（无需重启应用）
