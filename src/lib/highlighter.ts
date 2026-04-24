// highlight.js 核心
import hljs from 'highlight.js/lib/core'

// 预注册常用语言（首屏必须，体积可控）
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import bash from 'highlight.js/lib/languages/bash'
import markdown from 'highlight.js/lib/languages/markdown'
import plaintext from 'highlight.js/lib/languages/plaintext'

// 已注册语言集合
const registeredLanguages = new Set<string>()

// 预注册核心语言
;[javascript, typescript, python, json, xml, bash, markdown, plaintext].forEach((mod, i) => {
  const names = ['javascript', 'typescript', 'python', 'json', 'xml', 'bash', 'markdown', 'plaintext']
  hljs.registerLanguage(names[i], mod)
  registeredLanguages.add(names[i])
})

// 语言别名映射表
const languageMap: Record<string, string> = {
  'sh': 'bash',
  'zsh': 'bash',
  'ts': 'typescript',
  'js': 'javascript',
  'py': 'python',
  'rs': 'rust',
  'yml': 'yaml',
  'html': 'xml',
  'htm': 'xml',
  'md': 'markdown',
  'text': 'plaintext',
  'kt': 'kotlin',
  'rb': 'ruby',
  'go': 'go',
  'java': 'java',
  'c': 'c',
  'cpp': 'cpp',
  'css': 'css',
  'sql': 'sql',
  'swift': 'swift',
  'kotlin': 'kotlin',
  'ruby': 'ruby',
  'php': 'php',
}

/**
 * 动态加载语言模块（用于扩展语言包）
 * @param name 语言名称
 */
async function loadLanguage(name: string): Promise<void> {
  if (registeredLanguages.has(name)) return

  // 动态 import（需要 vite 配置允许）
  const moduleMap: Record<string, () => Promise<any>> = {
    go: () => import('highlight.js/lib/languages/go'),
    rust: () => import('highlight.js/lib/languages/rust'),
    java: () => import('highlight.js/lib/languages/java'),
    c: () => import('highlight.js/lib/languages/c'),
    cpp: () => import('highlight.js/lib/languages/cpp'),
    css: () => import('highlight.js/lib/languages/css'),
    sql: () => import('highlight.js/lib/languages/sql'),
    swift: () => import('highlight.js/lib/languages/swift'),
    kotlin: () => import('highlight.js/lib/languages/kotlin'),
    ruby: () => import('highlight.js/lib/languages/ruby'),
    php: () => import('highlight.js/lib/languages/php'),
    yaml: () => import('highlight.js/lib/languages/yaml'),
    dockerfile: () => import('highlight.js/lib/languages/dockerfile'),
    docker: () => import('highlight.js/lib/languages/dockerfile'),
  }

  const loader = moduleMap[name]
  if (!loader) return

  try {
    const mod = await loader()
    hljs.registerLanguage(name, mod.default)
    registeredLanguages.add(name)
  } catch {
    // 忽略加载失败
  }
}

/**
 * 规范化语言名称（处理别名）
 * @param lang 原始语言标记
 * @returns 规范化的语言名称，未找到则返回 'plaintext'
 */
export function normalizeLanguage(lang: string): string {
  const normalized = lang.toLowerCase().trim()
  // 先查别名映射
  if (languageMap[normalized]) {
    return languageMap[normalized]
  }
  // 再查是否已注册
  if (registeredLanguages.has(normalized)) {
    return normalized
  }
  return 'plaintext'
}

/**
 * 获取支持的语言列表
 * @returns 已注册语言名称数组
 */
export function getSupportedLanguages(): string[] {
  return [...registeredLanguages].sort()
}

/**
 * 对代码字符串进行语法高亮
 * @param code 原始代码
 * @param lang 语言标记
 * @returns 高亮后的 HTML 字符串
 */
export async function highlightCode(code: string, lang: string): Promise<string> {
  if (!code) return ''
  const normalized = normalizeLanguage(lang)

  if (normalized === 'plaintext') {
    return hljs.highlightAuto(code).value
  }

  // 按需加载语言
  if (!registeredLanguages.has(normalized)) {
    await loadLanguage(normalized)
  }

  try {
    if (hljs.getLanguage(normalized)) {
      return hljs.highlight(code, { language: normalized }).value
    }
  } catch (err) {
    console.warn(`[highlighter] 高亮失败 (${lang} -> ${normalized}):`, err)
  }
  return hljs.highlightAuto(code).value
}

/**
 * 对 DOM 容器中的所有代码块执行语法高亮
 * @param container 渲染容器 DOM 元素
 */
export async function highlightAllInContainer(container: HTMLElement): Promise<void> {
  const codeBlocks = container.querySelectorAll('pre code[class*="language-"]')
  const blocks = Array.from(codeBlocks)

  // 批量预加载所有需要的语言
  const langsToLoad = new Set<string>()
  blocks.forEach((block) => {
    const codeEl = block as HTMLElement
    if (codeEl.dataset.highlighted === 'true') return
    const langClass = Array.from(codeEl.classList).find(c => c.startsWith('language-'))
    const lang = langClass ? langClass.replace('language-', '') : 'plaintext'
    const normalized = normalizeLanguage(lang)
    if (normalized !== 'plaintext' && !registeredLanguages.has(normalized)) {
      langsToLoad.add(normalized)
    }
  })

  // 并行加载所有需要的语言
  if (langsToLoad.size > 0) {
    await Promise.all([...langsToLoad].map(loadLanguage))
  }

  // 然后同步高亮
  blocks.forEach((block) => {
    const codeEl = block as HTMLElement
    if (codeEl.dataset.highlighted === 'true') return

    const langClass = Array.from(codeEl.classList).find(c => c.startsWith('language-'))
    const lang = langClass ? langClass.replace('language-', '') : 'plaintext'
    const code = codeEl.textContent || ''

    if (!code) return

    const normalized = normalizeLanguage(lang)
    let highlighted: string

    if (normalized === 'plaintext' || !hljs.getLanguage(normalized)) {
      highlighted = hljs.highlightAuto(code).value
    } else {
      highlighted = hljs.highlight(code, { language: normalized }).value
    }

    codeEl.innerHTML = highlighted
    codeEl.dataset.highlighted = 'true'
  })
}

/**
 * 判断是否为 ASCII 艺术框图代码块
 * @param code 代码内容
 * @returns 是否为 ASCII 框图
 */
export function isAsciiArt(code: string): boolean {
  // 检测是否包含 box-drawing 字符
  const boxDrawingChars = /[\u2500-\u257F\u2580-\u259F]/
  return boxDrawingChars.test(code)
}

export { hljs }
export default hljs
