import MarkdownIt from 'markdown-it'
import anchor from 'markdown-it-anchor'
import taskLists from 'markdown-it-task-lists'
import { renderKatex } from './katexConfig'
import { isAsciiArt } from './highlighter'

export interface MkMarkdownItOptions {
  enableAnchor?: boolean
  enableTaskLists?: boolean
  baseDir?: string
  enableSourceMap?: boolean
  enableKaTeX?: boolean
}

export function resolveRelativePath(base: string, relativePath: string): string {
  if (!base || !relativePath) return relativePath
  if (relativePath.startsWith('/')) return relativePath

  let rel = relativePath.startsWith('./') ? relativePath.substring(2) : relativePath
  let dir = base

  while (rel.startsWith('../')) {
    rel = rel.substring(3)
    const lastSlash = dir.lastIndexOf('/')
    if (lastSlash > 0) {
      dir = dir.substring(0, lastSlash)
    }
  }

  return `${dir}/${rel}`
}

export function createMarkdownIt(options: MkMarkdownItOptions = {}): MarkdownIt {
  const {
    enableAnchor = true,
    enableTaskLists = true,
    baseDir = '',
    enableSourceMap = false,
    enableKaTeX = false,
  } = options

  const md = new MarkdownIt({
    html: false,        // 安全：禁止原始 HTML
    linkify: true,      // 自动链接 URL
    typographer: true,  // 排版增强
    breaks: true,       // 单换行 → <br>
  })

  // 1. markdown-it-anchor
  if (enableAnchor) {
    md.use(anchor, {
      permalink: false,
      slugify: (s: string) =>
        s.toLowerCase()
          .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
          .replace(/^-+|-+$/g, ''),
      uniqueSlugStartIndex: 2,
    })
  }

  // 2. markdown-it-task-lists
  if (enableTaskLists) {
    md.use(taskLists, { enabled: true, label: true })
  }

  // 3. KaTeX 数学公式支持
  if (enableKaTeX) {
    // Block: $$...$$
    md.block.ruler.before('fence', 'math_block', (state, startLine, endLine, silent) => {
      const startContent = state.src.slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine])

      // Must start with $$
      if (!startContent.startsWith('$$')) return false

      // Same-line close: $$ E = mc^2 $$
      if (startContent.endsWith('$$') && startContent.length > 4) {
        if (silent) return true
        const content = startContent.slice(2, -2).trim()
        const token = state.push('math_block', '', 0)
        token.content = content
        token.map = [startLine, startLine]
        state.line = startLine + 1
        return true
      }

      // Multi-line close
      let nextLine = startLine + 1
      let foundEnd = false
      while (nextLine < endLine) {
        const lineContent = state.src.slice(state.bMarks[nextLine] + state.tShift[nextLine], state.eMarks[nextLine])
        if (lineContent.trim() === '$$') {
          foundEnd = true
          break
        }
        nextLine++
      }

      if (!foundEnd) return false
      if (silent) return true

      const content = state.getLines(startLine + 1, nextLine, state.tShift[startLine], false).trim()
      const token = state.push('math_block', '', 0)
      token.content = content
      token.map = [startLine, nextLine + 1]
      state.line = nextLine + 1
      return true
    })

    md.renderer.rules.math_block = (tokens, idx) => {
      const content = tokens[idx].content
      return renderKatex(content, true)
    }

    // Inline: $...$
    md.inline.ruler.after('escape', 'math_inline', (state, silent) => {
      const start = state.pos
      const max = state.posMax

      // Must start with $
      if (state.src.charCodeAt(start) !== 0x24) return false // '$'
      // Not $$ (that's block)
      if (start + 1 < max && state.src.charCodeAt(start + 1) === 0x24) return false
      // No space after $
      if (start + 1 < max && state.src.charCodeAt(start + 1) === 0x20) return false

      // Find closing $
      let pos = start + 1
      let foundEnd = false
      while (pos < max) {
        const ch = state.src.charCodeAt(pos)
        if (ch === 0x24) { // '$'
          // Not $$
          if (pos + 1 < max && state.src.charCodeAt(pos + 1) === 0x24) {
            pos += 2
            continue
          }
          // No space before $
          if (state.src.charCodeAt(pos - 1) === 0x20) {
            pos++
            continue
          }
          foundEnd = true
          break
        }
        // Skip escaped characters
        if (ch === 0x5C) { // '\\'
          pos += 2
          continue
        }
        // Newline breaks inline math
        if (ch === 0x0A) return false
        pos++
      }

      if (!foundEnd) return false
      if (silent) return true

      const content = state.src.slice(start + 1, pos)
      if (!content) return false

      const token = state.push('math_inline', '', 0)
      token.content = content
      state.pos = pos + 1
      return true
    })

    md.renderer.rules.math_inline = (tokens, idx) => {
      const content = tokens[idx].content
      return renderKatex(content, false)
    }
  }

  // === 自定义渲染规则 ===

  // 规则1: 图片路径转换（相对路径 → 绝对路径，供前端 convertFileSrc 使用）
  const defaultImageRender = md.renderer.rules.image ||
    ((tokens: any, idx: any, options: any, _env: any, self: any) => self.renderToken(tokens, idx, options))

  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const srcIndex = token.attrIndex('src')
    if (srcIndex >= 0 && baseDir) {
      const src = token.attrs![srcIndex][1]
      if (!/^https?:\/\//.test(src) && !src.startsWith('data:') && !src.startsWith('asset:')) {
        const resolvedPath = resolveRelativePath(baseDir, src)
        token.attrs![srcIndex][1] = resolvedPath
      }
    }
    token.attrJoin('class', 'mk-image')
    return defaultImageRender(tokens, idx, options, env, self)
  }

  // 规则2: 链接安全处理 + 内部链接识别
  const defaultLinkOpen = md.renderer.rules.link_open ||
    ((tokens: any, idx: any, options: any, _env: any, self: any) => self.renderToken(tokens, idx, options))

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const hrefIndex = token.attrIndex('href')
    if (hrefIndex >= 0) {
      const href = token.attrs![hrefIndex][1]
      if (/^https?:\/\//.test(href)) {
        // 外部链接 — 新窗口打开
        token.attrSet('target', '_blank')
        token.attrSet('rel', 'noopener noreferrer')
        token.attrJoin('class', 'external-link')
      } else if (/\.(md|markdown)$/i.test(href) || href.endsWith('.md#') || /\.(md|markdown)#/.test(href)) {
        // 内部 Markdown 文件链接
        const resolvedPath = resolveRelativePath(baseDir, href.replace(/#.*$/, ''))
        const hash = href.includes('#') ? href.substring(href.indexOf('#')) : ''
        token.attrSet('href', 'javascript:void(0)')
        token.attrSet('data-file-path', resolvedPath)
        if (hash) token.attrSet('data-hash', hash)
        token.attrJoin('class', 'internal-link')
      }
    }
    return defaultLinkOpen(tokens, idx, options, env, self)
  }

  // 规则3: 自定义 fence（代码块增强 + Mermaid 拦截）
  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx]
    const info = token.info.trim()
    const langName = info.split(/\s+/g)[0] || ''
    const sourceLine = enableSourceMap && token.map ? ` data-source-line="${token.map[0]}"` : ''

    // Mermaid 拦截
    if (langName === 'mermaid') {
      return `<div class="mermaid"${sourceLine}>${md.utils.escapeHtml(token.content)}</div>`
    }

    // 常规代码块
    const langDisplay = langName || 'text'
    const escapedCode = md.utils.escapeHtml(token.content)
    const isAscii = isAsciiArt(token.content)
    const asciiClass = isAscii ? ' ascii-art' : ''
    const asciiAttr = isAscii ? ' data-is-ascii="true"' : ''

    return `<div class="code-block-wrapper${asciiClass}"${asciiAttr}${sourceLine}>` +
      `<div class="code-header">` +
      `<span class="code-lang">${langDisplay}</span>` +
      `<button class="code-copy-btn" data-code="${md.utils.escapeHtml(token.content)}">复制</button>` +
      `</div>` +
      `<pre class="code-body"><code class="language-${langName || 'plaintext'}">${escapedCode}</code></pre>` +
      `</div>`
  }

  // 规则4: 标题添加 data-source-line（同步滚动用）
  if (enableSourceMap) {
    const defaultHeadingOpen = md.renderer.rules.heading_open ||
      ((tokens: any, idx: any, options: any, _env: any, self: any) => self.renderToken(tokens, idx, options))

    md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
      const token = tokens[idx]
      if (token.map) {
        token.attrSet('data-source-line', String(token.map[0]))
      }
      return defaultHeadingOpen(tokens, idx, options, env, self)
    }
  }

  // 规则5: 其他块级元素添加 data-source-line
  if (enableSourceMap) {
    const blockRules = [
      'paragraph_open',
      'blockquote_open',
      'ordered_list_open',
      'bullet_list_open',
      'table_open',
      'hr',
    ]

    blockRules.forEach((ruleName) => {
      const originalRule = md.renderer.rules[ruleName] ||
        ((tokens: any, idx: any, options: any, _env: any, self: any) => self.renderToken(tokens, idx, options))

      md.renderer.rules[ruleName] = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        if (token.map) {
          token.attrSet('data-source-line', String(token.map[0]))
        }
        return originalRule(tokens, idx, options, env, self)
      }
    })
  }

  return md
}

/**
 * 快速渲染函数：使用默认配置渲染 Markdown 文本为 HTML
 * @param content Markdown 原始文本
 * @param baseDir 当前文件目录（用于图片路径解析）
 * @returns 渲染后的 HTML 字符串
 */
export function renderMarkdown(content: string, baseDir?: string): string {
  const md = createMarkdownIt({ baseDir })
  return md.render(content)
}
