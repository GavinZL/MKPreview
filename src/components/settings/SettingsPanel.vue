<template>
  <Teleport to="body">
    <Transition name="settings-fade">
      <div v-if="visible" class="settings-overlay" @click.self="close">
        <div class="settings-panel">
          <div class="settings-header">
            <h2 class="settings-title">{{ t('settings.title') }}</h2>
            <button class="settings-close" @click="close">✕</button>
          </div>

          <div class="settings-body">
            <!-- 外观设置 -->
            <SettingsSection :title="t('settings.sectionAppearance')">
              <SettingsRow :label="t('settings.theme')" :description="t('settings.themeDesc')">
                <select v-model="theme" class="select-box">
                  <option value="system">{{ t('settings.themeSystem') }}</option>
                  <option value="light">{{ t('settings.themeLight') }}</option>
                  <option value="dark">{{ t('settings.themeDark') }}</option>
                </select>
              </SettingsRow>
              <SettingsRow :label="t('settings.language')" :description="t('settings.languageDesc')">
                <select v-model="locale" class="select-box">
                  <option value="zh-CN">中文</option>
                  <option value="en-US">English</option>
                </select>
              </SettingsRow>
              <SettingsRow :label="t('settings.fontBody')" :description="t('settings.fontBodyDesc')">
                <select v-model="fontBody" class="select-box">
                  <option value="">{{ t('settings.fontDefault') }}</option>
                  <option value="'LXGW WenKai', 'Noto Serif SC', Georgia, serif">霞鹜文楷</option>
                  <option value="'Noto Serif SC', Georgia, serif">Noto Serif SC</option>
                  <option value="-apple-system, BlinkMacSystemFont, sans-serif">{{ t('settings.fontSystem') }}</option>
                </select>
              </SettingsRow>
              <SettingsRow :label="t('settings.fontCode')" :description="t('settings.fontCodeDesc')">
                <select v-model="fontCode" class="select-box">
                  <option value="">{{ t('settings.fontDefault') }}</option>
                  <option value="'JetBrains Mono', 'Fira Code', Menlo, monospace">JetBrains Mono</option>
                  <option value="'Fira Code', Menlo, monospace">Fira Code</option>
                  <option value="'SF Mono', Menlo, monospace">SF Mono</option>
                </select>
              </SettingsRow>
              <SettingsRow :label="t('settings.fontSize')" :description="t('settings.fontSizeDesc')">
                <input type="number" v-model.number="fontSize" min="12" max="24" class="input-box" />
              </SettingsRow>
            </SettingsSection>

            <!-- 编辑器设置 -->
            <SettingsSection :title="t('settings.sectionEditor')">
              <SettingsRow :label="t('settings.autoSave')" :description="t('settings.autoSaveDesc')">
                <Toggle v-model="autoSave" />
              </SettingsRow>
              <SettingsRow v-if="autoSave" :label="t('settings.autoSaveInterval')" :description="t('settings.autoSaveIntervalDesc')">
                <input type="number" v-model.number="autoSaveInterval" min="1" max="60" class="input-box" />
              </SettingsRow>
              <SettingsRow :label="t('settings.showLineNumbers')">
                <Toggle v-model="showLineNumbers" />
              </SettingsRow>
              <SettingsRow :label="t('settings.enableFolding')" :description="t('settings.enableFoldingDesc')">
                <Toggle v-model="enableFolding" />
              </SettingsRow>
            </SettingsSection>

            <!-- 预览设置 -->
            <SettingsSection :title="t('settings.sectionPreview')">
              <SettingsRow :label="t('settings.previewTheme')" :description="t('settings.previewThemeDesc')">
                <select v-model="previewTheme" class="select-box">
                  <option
                    v-for="th in builtInPreviewThemes"
                    :key="th.id"
                    :value="th.id"
                  >
                    {{ t('theme.' + th.nameKey) }}
                  </option>
                </select>
              </SettingsRow>
              <SettingsRow :label="t('settings.previewTemplate')" :description="t('settings.previewTemplateDesc')">
                <select v-model="previewTemplate" class="select-box">
                  <option
                    v-for="tp in previewTemplates"
                    :key="tp.id"
                    :value="tp.id"
                  >
                    {{ t('template.' + tp.nameKey) }}
                  </option>
                </select>
              </SettingsRow>
              <SettingsRow :label="t('settings.enableMermaid')" :description="t('settings.enableMermaidDesc')">
                <Toggle v-model="enableMermaid" />
              </SettingsRow>
              <SettingsRow :label="t('settings.enableKaTeX')" :description="t('settings.enableKaTeXDesc')">
                <Toggle v-model="enableKaTeX" />
              </SettingsRow>
            </SettingsSection>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { setLocale } from '@/i18n'
import SettingsSection from './SettingsSection.vue'
import SettingsRow from './SettingsRow.vue'
import Toggle from '@/components/common/Toggle.vue'
import { builtInPreviewThemes } from '@/lib/previewThemes'
import { previewTemplates } from '@/lib/previewTemplates'
import type { ThemePreference, BuiltInPreviewThemeId, PreviewTemplateId, AppLocale } from '@/types'

interface Props {
  visible: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const store = useSettingsStore()

// 双向绑定 Store 状态
const theme = computed({
  get: () => store.theme,
  set: (v) => store.setTheme(v as ThemePreference),
})

const locale = computed({
  get: () => store.locale,
  set: (v) => {
    store.setLocale(v as AppLocale)
    setLocale(v as AppLocale)
  },
})

const fontBody = computed({
  get: () => store.fontBody,
  set: (v) => { store.fontBody = v },
})

const fontCode = computed({
  get: () => store.fontCode,
  set: (v) => { store.fontCode = v },
})

const fontSize = computed({
  get: () => store.fontSize,
  set: (v) => { if (v != null) store.setFontSize(v) },
})

const autoSave = computed({
  get: () => store.autoSave,
  set: (v) => { store.autoSave = v },
})

const autoSaveInterval = computed({
  get: () => store.autoSaveInterval,
  set: (v) => { if (v != null) store.autoSaveInterval = v },
})

const showLineNumbers = computed({
  get: () => store.showLineNumbers,
  set: (v) => { store.showLineNumbers = v },
})

const enableFolding = computed({
  get: () => store.enableFolding,
  set: (v) => { store.enableFolding = v },
})

const enableMermaid = computed({
  get: () => store.enableMermaid,
  set: (v) => { store.enableMermaid = v },
})

const enableKaTeX = computed({
  get: () => store.enableKaTeX,
  set: (v) => { store.enableKaTeX = v },
})

const previewTheme = computed({
  get: () => store.previewTheme,
  set: (v) => store.setPreviewTheme(v as BuiltInPreviewThemeId),
})

const previewTemplate = computed({
  get: () => store.previewTemplate,
  set: (v) => store.setPreviewTemplate(v as PreviewTemplateId),
})

function close() {
  emit('close')
}

// ESC 键关闭
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-panel {
  width: 100%;
  max-width: 560px;
  max-height: 80vh;
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.settings-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
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
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.15s;
}

.settings-close:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.settings-body {
  overflow-y: auto;
  padding: 16px 24px 24px;
  flex: 1;
}

/* 控件样式 */
.select-box {
  appearance: none;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  padding: 6px 28px 6px 10px;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%236B7280' viewBox='0 0 16 16'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
}

.select-box:focus {
  border-color: var(--border-focus);
}

.input-box {
  appearance: none;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  padding: 6px 10px;
  width: 72px;
  outline: none;
  transition: border-color 0.15s;
  text-align: center;
}

.input-box:focus {
  border-color: var(--border-focus);
}

/* 过渡动画 */
.settings-fade-enter-active,
.settings-fade-leave-active {
  transition: opacity 200ms ease;
}

.settings-fade-enter-active .settings-panel,
.settings-fade-leave-active .settings-panel {
  transition: transform 200ms ease, opacity 200ms ease;
}

.settings-fade-enter-from,
.settings-fade-leave-to {
  opacity: 0;
}

.settings-fade-enter-from .settings-panel,
.settings-fade-leave-to .settings-panel {
  transform: scale(0.95);
  opacity: 0;
}
</style>
