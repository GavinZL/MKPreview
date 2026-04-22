import katex from 'katex'

export const katexConfig = {
  throwOnError: false,
  errorColor: '#F85149',
  strict: false,
  trust: false,
  maxSize: 500,
  maxExpand: 1000,
}

export function renderKatex(tex: string, displayMode: boolean = false): string {
  try {
    return katex.renderToString(tex, { ...katexConfig, displayMode })
  } catch (err) {
    const errorClass = displayMode ? 'katex-display-error' : 'katex-inline-error'
    return `<span class="katex-error ${errorClass}">${escapeHtml(tex)}</span>`
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
