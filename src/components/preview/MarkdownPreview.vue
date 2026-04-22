<template>
  <div ref="previewRef" class="markdown-preview">
    <!-- 加载状态 -->
    <div v-if="isRendering" class="preview-loading">
      <div class="loading-spinner"></div>
      <span>正在渲染...</span>
    </div>

    <!-- 渲染容器 -->
    <article
      v-show="!isRendering"
      ref="articleRef"
      class="mk-body"
      v-html="renderedHtml"
    ></article>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { createMarkdownIt } from '@/lib/markdownIt'
import { highlightAllIn } from '@/lib/highlighter'
import { renderMermaidInContainer } from '@/lib/mermaidConfig'
import 'katex/dist/katex.min.css'

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
  const md = createMarkdownIt({ baseDir: baseDir.value, enableKaTeX: true })
  const html = md.render(content)

  // Check cancellation
  if (token !== renderCancelToken) return

  // Save scroll position before re-rendering
  const container = previewRef.value
  const scrollTop = container ? container.scrollTop : 0

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
  highlightAllIn(article)

  // Stage 3.5: Mermaid 图表渲染
  await renderMermaidInContainer(article)

  // Check cancellation after async mermaid render
  if (token !== renderCancelToken) return

  // Stage 4: Enhancements
  bindCodeCopyButtons(article)
  interceptExternalLinks(article)
  wrapTables(article)

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
    btn.addEventListener('click', handleCopyClick)
  })
}

function handleCopyClick(e: Event) {
  const btn = e.currentTarget as HTMLButtonElement
  const code = btn.getAttribute('data-code')
  if (!code) return

  navigator.clipboard.writeText(code).then(() => {
    const originalText = btn.textContent
    btn.textContent = '已复制'
    setTimeout(() => {
      btn.textContent = originalText
    }, 1500)
  })
}

function interceptExternalLinks(container: HTMLElement) {
  const links = container.querySelectorAll<HTMLAnchorElement>('a.external-link')
  links.forEach((link) => {
    link.addEventListener('click', handleExternalLinkClick)
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

watch(
  () => props.content,
  () => {
    renderContent()
  },
  { immediate: true }
)

onUnmounted(() => {
  // Cancel any ongoing render
  renderCancelToken++
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
