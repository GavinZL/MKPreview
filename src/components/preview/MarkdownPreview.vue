<template>
  <div ref="previewRef" class="markdown-preview">
    <!-- 加载状态 -->
    <div v-if="isRendering" class="preview-loading">
      <div class="loading-spinner"></div>
      <span>{{ t('preview.rendering') }}</span>
    </div>

    <!-- 渲染容器 -->
    <article
      v-show="!isRendering"
      ref="articleRef"
      class="mk-body"
      :data-preview-theme="previewTheme"
      :data-preview-template="previewTemplate"
      v-html="renderedHtml"
    ></article>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { createMarkdownIt } from '@/lib/markdownIt'
import { findAnchorTarget } from '@/lib/utils'
import { highlightAllInContainer } from '@/lib/highlighter'
import {
  renderMermaidInContainer,
  cleanupMermaidObservers,
  reRenderMermaidBlocks,
  updateMermaidTheme,
} from '@/lib/mermaidConfig'
import { useTabStore } from '@/stores/tabStore'
import { useNavigationStore } from '@/stores/navigationStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { usePreviewTheme } from '@/composables/usePreviewTheme'
import { usePreviewTemplate } from '@/composables/usePreviewTemplate'
import { convertFileSrc } from '@tauri-apps/api/core'
import 'katex/dist/katex.min.css'
import '@/assets/styles/markdown/index.css'

interface Props {
  content: string
  filePath: string
}

interface Emits {
  (e: 'rendered'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const previewRef = ref<HTMLElement>()
const articleRef = ref<HTMLElement>()
const renderedHtml = ref('')
const isRendering = ref(false)
const { t } = useI18n()
const tabStore = useTabStore()
const navigationStore = useNavigationStore()
const settingsStore = useSettingsStore()
const { currentTheme: previewTheme } = usePreviewTheme()
const { currentTemplate: previewTemplate } = usePreviewTemplate()

// Cancel token for render cancellation
let renderCancelToken = 0

const baseDir = computed(() => {
  if (!props.filePath) return ''
  const lastSep = Math.max(
    props.filePath.lastIndexOf('/'),
    props.filePath.lastIndexOf('\\')
  )
  return lastSep > 0 ? props.filePath.substring(0, lastSep) : ''
})

async function renderContent() {
  const token = ++renderCancelToken
  const content = props.content

  if (!content) {
    renderedHtml.value = ''
    isRendering.value = false
    return
  }

  isRendering.value = true

  // Stage 1: Parse markdown to HTML
  const md = createMarkdownIt({
    baseDir: baseDir.value,
    enableKaTeX: true,
    enableSourceMap: true,
  })
  const html = md.render(content)

  // Check cancellation
  if (token !== renderCancelToken) return

  // Save scroll position before re-rendering
  const container = previewRef.value
  const scrollTop = container ? container.scrollTop : 0

  // 清理旧 mermaid 图表的 ResizeObserver，避免内存泄漏
  const oldArticle = articleRef.value
  if (oldArticle) {
    cleanupMermaidObservers(oldArticle)
  }

  // Stage 2: Inject HTML
  renderedHtml.value = html

  // Stage 3 & 4: Post-processing after DOM update
  await nextTick()

  // Check cancellation again
  if (token !== renderCancelToken) return

  const article = articleRef.value
  if (!article) {
    isRendering.value = false
    return
  }

  // Stage 3: Syntax highlighting
  highlightAllInContainer(article)

  // Stage 3.5: Mermaid 图表渲染
  await renderMermaidInContainer(article)

  // Check cancellation after async mermaid render
  if (token !== renderCancelToken) return

  // Stage 4: Enhancements
  bindCodeCopyButtons(article)
  interceptExternalLinks(article)
  bindInternalLinkHandlers(article)
  bindAnchorLinkHandlers(article)
  wrapTables(article)
  processImagePaths(article)

  // Restore scroll position
  if (container) {
    container.scrollTop = scrollTop
  }

  isRendering.value = false
  emit('rendered')
}

function bindCodeCopyButtons(container: HTMLElement) {
  const buttons = container.querySelectorAll<HTMLButtonElement>('.code-copy-btn')
  buttons.forEach((btn) => {
    if (btn.dataset.copyBound === 'true') return
    btn.dataset.copyBound = 'true'
    btn.addEventListener('click', handleCopyClick)
  })
}

function handleCopyClick(e: Event) {
  const btn = e.currentTarget as HTMLButtonElement
  // 从相邻的 code 元素读取原始代码（避免 data-code 中的 HTML 转义问题）
  const wrapper = btn.closest('.code-block-wrapper')
  const codeEl = wrapper?.querySelector('.code-body code')
  const code = codeEl?.textContent || btn.getAttribute('data-code') || ''
  if (!code) return

  navigator.clipboard.writeText(code).then(() => {
    showCopiedFeedback(btn)
  })
}

function showCopiedFeedback(btn: HTMLButtonElement): void {
  const originalText = btn.textContent || t('preview.copy')
  btn.classList.add('copied')
  btn.textContent = t('preview.copied')
  setTimeout(() => {
    btn.classList.remove('copied')
    btn.textContent = originalText
  }, 2000)
}

function interceptExternalLinks(container: HTMLElement) {
  const links = container.querySelectorAll<HTMLAnchorElement>('a.external-link')
  links.forEach((link) => {
    link.addEventListener('click', handleExternalLinkClick)
  })
}

function bindInternalLinkHandlers(container: HTMLElement) {
  const links = container.querySelectorAll<HTMLAnchorElement>('a.internal-link')
  links.forEach((link) => {
    if (link.dataset.linkBound) return
    link.dataset.linkBound = 'true'
    link.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const filePath = link.dataset.filePath
      const hash = link.dataset.hash
      if (filePath) {
        // 跳转前保存当前文件到历史（如果有当前文件）
        if (props.filePath) {
          const currentName = props.filePath.split('/').pop() || props.filePath
          // 获取当前滚动位置
          const scrollContainer = previewRef.value
          const scrollTop = scrollContainer?.scrollTop ?? 0
          navigationStore.updateCurrentScrollTop(scrollTop)
          navigationStore.pushEntry(props.filePath, currentName, undefined, settingsStore.displayMode)
        }

        const fileName = filePath.split('/').pop() || filePath
        navigationStore.pushEntry(filePath, fileName, undefined, settingsStore.displayMode)
        tabStore.openFile(filePath, fileName)

        // 如果带有锚点，在目标文件渲染完成后跳转到对应锚点
        if (hash) {
          const targetId = hash.substring(1)
          // 等待文件打开并渲染完成后再滚动到锚点
          setTimeout(() => {
            const previewContainer = document.querySelector('.markdown-preview') as HTMLElement | null
            if (!previewContainer) return
            const targetElement = findAnchorTarget(previewContainer, targetId)
            if (targetElement) {
              targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
            } else {
              console.warn(`[内部链接] 找不到跨文件锚点目标: "${targetId}"`)
            }
          }, 300)
        }
      }
    })
  })
}

function handleExternalLinkClick(e: Event) {
  e.preventDefault()
  const link = e.currentTarget as HTMLAnchorElement
  const url = link.getAttribute('href')
  if (url) {
    window.open(url, '_blank')
  }
}

function bindAnchorLinkHandlers(container: HTMLElement) {
  // 查找所有以 # 开头的链接（锚点链接）
  const links = container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')
  links.forEach((link) => {
    if (link.dataset.anchorBound) return
    link.dataset.anchorBound = 'true'
    link.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const href = link.getAttribute('href')
      if (!href || !href.startsWith('#')) return

      // 获取当前滚动位置
      const scrollContainer = (container.closest('.markdown-preview') as HTMLElement)
        || container
      const currentScrollTop = scrollContainer.scrollTop

      // 记录当前位置到导航历史
      if (props.filePath) {
        const fileName = props.filePath.split('/').pop() || props.filePath
        navigationStore.pushEntry(props.filePath, fileName, currentScrollTop, settingsStore.displayMode)
      }

      // 找到目标元素并平滑滚动
      let targetId = href.substring(1)
      // 尝试 URL 解码（处理编码后的中文锚点，如 #%E7%9F%A9... → 矩阵...）
      try { targetId = decodeURIComponent(targetId) } catch { /* 保留原始值 */ }

      // 使用增强的锚点查找（7 层回退匹配策略）
      const targetElement = findAnchorTarget(container, targetId)

      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' })

        // 滚动完成后记录目标位置（延迟等待滚动完成）
        setTimeout(() => {
          if (props.filePath) {
            const fileName = props.filePath.split('/').pop() || props.filePath
            const newScrollTop = scrollContainer.scrollTop
            navigationStore.pushEntry(props.filePath, fileName, newScrollTop, settingsStore.displayMode)
          }
        }, 500) // 等待平滑滚动完成
      } else {
        console.warn(`[TOC] 找不到锚点目标: "${targetId}"，请检查目录链接与标题是否匹配`)
      }
    })
  })
}

function wrapTables(container: HTMLElement) {
  const tables = container.querySelectorAll<HTMLTableElement>('table')
  tables.forEach((table) => {
    if (table.parentElement && table.parentElement.classList.contains('table-wrapper')) {
      return
    }
    const wrapper = document.createElement('div')
    wrapper.className = 'table-wrapper'
    table.parentNode?.insertBefore(wrapper, table)
    wrapper.appendChild(table)
  })
}

function processImagePaths(container: HTMLElement) {
  const images = container.querySelectorAll<HTMLImageElement>('img.mk-image')
  images.forEach((img) => {
    const src = img.getAttribute('src')
    if (!src) return
    // 跳过已经是合法 URL 的图片
    if (/^https?:\/\//.test(src) || src.startsWith('data:') || src.startsWith('asset:')) return
    try {
      img.src = convertFileSrc(src)
    } catch {
      // 非 Tauri 环境或转换失败时保留原路径
    }
  })
}

watch(
  [() => props.content, () => props.filePath],
  () => {
    renderContent()
  },
  { immediate: true }
)

// 监听应用主题变化，自动重渲染 mermaid 图表以适配新主题配色
watch(
  () => settingsStore.resolvedTheme,
  async (newTheme) => {
    updateMermaidTheme(newTheme as 'light' | 'dark')
    const article = articleRef.value
    if (article) {
      await reRenderMermaidBlocks(article)
    }
  }
)

onUnmounted(() => {
  // Cancel any ongoing render
  renderCancelToken++

  // 清理 mermaid ResizeObserver，防止内存泄漏
  const article = articleRef.value
  if (article) {
    cleanupMermaidObservers(article)
  }
})
</script>

<style scoped>
.markdown-preview {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 24px 32px;
}

.preview-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: var(--text-muted);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
