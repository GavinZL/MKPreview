/** Mermaid 懒加载单例 */
let mermaidPromise: Promise<typeof import('mermaid').default> | null = null

async function loadMermaid(): Promise<typeof import('mermaid').default> {
  if (mermaidPromise) return mermaidPromise
  mermaidPromise = import('mermaid').then(m => m.default)
  return mermaidPromise
}

let currentTheme: 'light' | 'dark' = 'light'
let initialized = false

/** 每个 mermaid 容器对应的 ResizeObserver，用于清理 */
const observerMap = new WeakMap<HTMLElement, ResizeObserver>()

/**
 * 初始化 mermaid.js
 * @param appTheme 应用当前主题
 */
export function initMermaid(appTheme: 'light' | 'dark'): void {
  currentTheme = appTheme
  // 异步加载 mermaid 并初始化
  loadMermaid().then(mermaid => {
    mermaid.initialize({
      // === 安全配置 ===
      securityLevel: 'strict',
      maxTextSize: 50000,
      maxEdges: 500,
      // === 主题配置 ===
      theme: appTheme === 'dark' ? 'dark' : 'default',
      // === 渲染配置 ===
      startOnLoad: false,
      // === 字体配置 ===
      fontFamily: 'var(--font-mono)',
      // 增大默认字号，提升可读性
      fontSize: 14,
      // === 流程图配置 ===
      flowchart: { 
        // 不使用最大宽度限制，让图表自然扩展
        useMaxWidth: false, 
        htmlLabels: false, 
        curve: 'basis',
        // 增加节点间距
        padding: 20,
        // 增加分支间距
        diagramPadding: 20,
      },
      // === 序列图配置 ===
      sequence: { 
        useMaxWidth: false,
        // 增加消息间距
        messageAlign: 'center',
      },
      // === 类图配置 ===
      class: { useMaxWidth: false },
      // === 甘特图配置 ===
      gantt: { useMaxWidth: false },
    })
    initialized = true
  })
}

/**
 * 切换 mermaid 主题并重新初始化
 * 注意：主题切换后，需要调用方（MarkdownPreview.vue）自行调用 reRenderMermaidBlocks 重渲染图表
 * @param appTheme 应用当前主题
 */
export async function updateMermaidTheme(appTheme: 'light' | 'dark'): Promise<void> {
  if (appTheme === currentTheme) return
  
  currentTheme = appTheme
  
  // 重新初始化 mermaid 配置（更新主题色）
  initMermaid(appTheme)
  
  // 等待 mermaid 加载完成
  await loadMermaid()
  
  console.log('[mermaid] 主题配置已更新为:', appTheme)
}

/**
 * 渲染单个 mermaid 图表
 * @param id 唯一标识符（用于 SVG ID）
 * @param definition Mermaid 图表定义文本
 * @returns 渲染后的 SVG 字符串
 */
export async function renderMermaidDiagram(
  id: string,
  definition: string
): Promise<string> {
  if (!initialized) {
    await loadMermaid()
    initMermaid('light')
  }

  const mermaid = await loadMermaid()
  try {
    const result = await mermaid.render(id, definition.trim())
    return result.svg
  } catch (err) {
    console.error(`[mermaid] 渲染失败 (${id}):`, err)
    throw err
  }
}

/**
 * 渲染单个 mermaid 容器
 */
async function renderSingleMermaid(
  div: HTMLElement,
  code: string,
  index: number
): Promise<void> {
  const id = `mermaid-${Date.now()}-${index}`

  try {
    const svg = await renderMermaidDiagram(id, code)
    div.innerHTML = svg
    div.setAttribute('data-processed', 'true')
    div.classList.remove('mermaid-error-container')
    div.classList.add('mermaid-rendered')
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : '未知错误'
    div.innerHTML = `
      <div class="mermaid-error">
        <div class="mermaid-error-title">Mermaid 渲染失败</div>
        <pre class="mermaid-error-code">${escapeHtml(errorMessage)}</pre>
      </div>
    `
    div.setAttribute('data-processed', 'true')
    div.classList.remove('mermaid-rendered')
    div.classList.add('mermaid-error-container')
  }
}

/**
 * 为单个 mermaid 容器注册 ResizeObserver
 * 当容器宽度变化超过阈值时自动重新渲染
 */
function setupMermaidResizeObserver(div: HTMLElement): void {
  if (!('ResizeObserver' in window)) return

  // 断开已有 observer
  const existingObserver = observerMap.get(div)
  if (existingObserver) {
    existingObserver.disconnect()
  }

  let lastWidth = Math.round(div.getBoundingClientRect().width)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const observer = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) return

    // 当前处于渲染过程中时忽略变化
    if (div.dataset.rendering === 'true') return

    const newWidth = Math.round(entry.contentRect.width)

    // 忽略首次挂载和微小变化
    if (newWidth === lastWidth) return
    if (Math.abs(newWidth - lastWidth) < 20) {
      lastWidth = newWidth
      return
    }

    // debounce 延迟重渲染，避免频繁触发
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      lastWidth = newWidth

      const definition = div.getAttribute('data-definition')
      if (!definition) return

      // 标记渲染中，防止 observer 递归触发
      div.dataset.rendering = 'true'

      // 暂时断开 observer 避免渲染过程中触发
      observer.disconnect()

      renderSingleMermaid(div, definition, Date.now())
        .then(() => {
          div.dataset.rendering = 'false'
          // 重新连接 observer
          observer.observe(div)
        })
        .catch(() => {
          div.dataset.rendering = 'false'
          observer.observe(div)
        })
    }, 300)
  })

  observer.observe(div)
  observerMap.set(div, observer)
}

/**
 * 处理渲染容器内所有未渲染的 mermaid 代码块
 * @param container 渲染容器 DOM
 */
export async function renderMermaidInContainer(
  container: HTMLElement
): Promise<void> {
  if (!initialized) {
    await loadMermaid()
    initMermaid('light')
  }

  const mermaidDivs = container.querySelectorAll<HTMLElement>(
    '.mermaid:not([data-processed])'
  )

  if (mermaidDivs.length === 0) return

  // 并行渲染所有 mermaid 图表（mermaid v10 支持并行）
  const renderPromises = Array.from(mermaidDivs).map((div, i) => {
    const code = div.textContent?.trim() || ''
    if (!code) return Promise.resolve()
    div.setAttribute('data-definition', code)
    return renderSingleMermaid(div, code, i).then(() => setupMermaidResizeObserver(div))
  })

  await Promise.all(renderPromises)
}

/**
 * 清理容器内所有 mermaid 容器的 ResizeObserver
 * 在组件卸载或切换文件时调用，防止内存泄漏
 * @param container 渲染容器 DOM
 */
export function cleanupMermaidObservers(container: HTMLElement): void {
  const divs = container.querySelectorAll<HTMLElement>('.mermaid[data-processed]')
  divs.forEach((div) => {
    const observer = observerMap.get(div)
    if (observer) {
      observer.disconnect()
      observerMap.delete(div)
    }
    div.removeAttribute('data-definition')
    div.removeAttribute('data-rendered')
    div.removeAttribute('data-rendering')
    div.classList.remove('mermaid-rendered', 'mermaid-error-container')
  })
}

/**
 * 对容器内所有已渲染的 mermaid 图表执行重新渲染
 * 用于主题切换后更新图表配色
 * @param container 渲染容器 DOM
 */
export async function reRenderMermaidBlocks(
  container: HTMLElement
): Promise<void> {
  const divs = container.querySelectorAll<HTMLElement>('.mermaid[data-processed]')

  for (let i = 0; i < divs.length; i++) {
    const div = divs[i]
    const definition = div.getAttribute('data-definition')
    if (!definition) continue

    // 清理旧 observer
    const observer = observerMap.get(div)
    if (observer) {
      observer.disconnect()
      observerMap.delete(div)
    }

    // 清除状态并重新渲染
    div.removeAttribute('data-processed')
    div.classList.remove('mermaid-rendered', 'mermaid-error-container')

    await renderSingleMermaid(div, definition, Date.now())

    // 重新注册 observer
    setupMermaidResizeObserver(div)
  }
}

/**
 * HTML 转义辅助函数
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
