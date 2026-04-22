import mermaid from 'mermaid'

let initialized = false

export function initMermaid(appTheme: 'light' | 'dark'): void {
  mermaid.initialize({
    securityLevel: 'strict',
    maxTextSize: 50000,
    maxEdges: 500,
    theme: appTheme === 'dark' ? 'dark' : 'default',
    startOnLoad: false,
    fontFamily: 'var(--font-mono)',
    flowchart: { useMaxWidth: true, htmlLabels: false, curve: 'basis' },
    sequence: { useMaxWidth: true },
  })
  initialized = true
}

export function updateMermaidTheme(appTheme: 'light' | 'dark'): void {
  initMermaid(appTheme) // Re-initialize with new theme
}

export async function renderMermaidInContainer(container: HTMLElement): Promise<void> {
  if (!initialized) initMermaid('light')

  const mermaidDivs = container.querySelectorAll<HTMLElement>('.mermaid:not([data-processed])')

  for (let i = 0; i < mermaidDivs.length; i++) {
    const div = mermaidDivs[i]
    const code = div.textContent?.trim() || ''
    if (!code) continue

    const id = `mermaid-${Date.now()}-${i}`
    try {
      const { svg } = await mermaid.render(id, code)
      div.innerHTML = svg
      div.setAttribute('data-processed', 'true')
      div.classList.add('mermaid-rendered')
    } catch (err) {
      div.innerHTML = `<div class="mermaid-error">
        <div class="mermaid-error-title">Mermaid 渲染失败</div>
        <pre class="mermaid-error-code">${escapeHtml(code)}</pre>
      </div>`
      div.setAttribute('data-processed', 'true')
      div.classList.add('mermaid-error-container')
    }
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
