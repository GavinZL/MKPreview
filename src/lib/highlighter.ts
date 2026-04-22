import hljs from 'highlight.js/lib/core'

// 注册常用语言（按使用频率）
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import cpp from 'highlight.js/lib/languages/cpp'
import c from 'highlight.js/lib/languages/c'
import rust from 'highlight.js/lib/languages/rust'
import go from 'highlight.js/lib/languages/go'
import bash from 'highlight.js/lib/languages/bash'
import shell from 'highlight.js/lib/languages/shell'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'
import markdown from 'highlight.js/lib/languages/markdown'
import diff from 'highlight.js/lib/languages/diff'
import plaintext from 'highlight.js/lib/languages/plaintext'
import swift from 'highlight.js/lib/languages/swift'
import kotlin from 'highlight.js/lib/languages/kotlin'
import ruby from 'highlight.js/lib/languages/ruby'
import php from 'highlight.js/lib/languages/php'

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
}

// 注册所有语言
const languages: Array<{ name: string; module: any }> = [
  { name: 'bash', module: bash },
  { name: 'c', module: c },
  { name: 'cpp', module: cpp },
  { name: 'css', module: css },
  { name: 'diff', module: diff },
  { name: 'go', module: go },
  { name: 'java', module: java },
  { name: 'javascript', module: javascript },
  { name: 'json', module: json },
  { name: 'kotlin', module: kotlin },
  { name: 'markdown', module: markdown },
  { name: 'php', module: php },
  { name: 'plaintext', module: plaintext },
  { name: 'python', module: python },
  { name: 'ruby', module: ruby },
  { name: 'rust', module: rust },
  { name: 'shell', module: shell },
  { name: 'sql', module: sql },
  { name: 'swift', module: swift },
  { name: 'typescript', module: typescript },
  { name: 'xml', module: xml },
  { name: 'yaml', module: yaml },
]

languages.forEach(({ name, module }) => {
  hljs.registerLanguage(name, module)
})

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
  if (hljs.getLanguage(normalized)) {
    return normalized
  }
  return 'plaintext'
}

/**
 * 获取支持的语言列表
 * @returns 已注册语言名称数组
 */
export function getSupportedLanguages(): string[] {
  return languages.map(l => l.name).sort()
}

/**
 * 对代码字符串进行语法高亮
 * @param code 原始代码
 * @param lang 语言标记
 * @returns 高亮后的 HTML 字符串
 */
export function highlightCode(code: string, lang: string): string {
  if (!code) return ''
  const normalized = normalizeLanguage(lang)

  if (normalized === 'plaintext') {
    return hljs.highlightAuto(code).value
  }

  try {
    return hljs.highlight(code, { language: normalized }).value
  } catch (err) {
    console.warn(`[highlighter] 高亮失败 (${lang} -> ${normalized}):`, err)
    return hljs.highlightAuto(code).value
  }
}

/**
 * 对 DOM 容器中的所有代码块执行语法高亮
 * @param container 渲染容器 DOM 元素
 */
export function highlightAllInContainer(container: HTMLElement): void {
  const codeBlocks = container.querySelectorAll('pre code[class*="language-"]')
  codeBlocks.forEach((block) => {
    const codeEl = block as HTMLElement
    // 跳过已高亮的元素
    if (codeEl.dataset.highlighted === 'true') return

    const langClass = Array.from(codeEl.classList).find(c => c.startsWith('language-'))
    const lang = langClass ? langClass.replace('language-', '') : 'plaintext'
    const code = codeEl.textContent || ''

    if (!code) return

    const highlighted = highlightCode(code, lang)
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
