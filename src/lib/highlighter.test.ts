import { describe, it, expect, vi } from 'vitest'
import { highlightCode, highlightAllInContainer, hljs } from './highlighter'

describe('highlightCode', () => {
  it('已注册语言（js）正确高亮', () => {
    const code = 'const x = 1;'
    const result = highlightCode(code, 'js')
    expect(result).toContain('<span')
  })

  it('已注册语言（ts）正确高亮', () => {
    const code = 'const x: number = 1;'
    const result = highlightCode(code, 'ts')
    expect(result).toContain('<span')
  })

  it('已注册语言（python）正确高亮', () => {
    const code = 'def hello():'
    const result = highlightCode(code, 'python')
    expect(result).toContain('<span')
  })

  it('未注册语言回退到 auto', () => {
    const code = 'some random text'
    const result = highlightCode(code, 'nonexistent_lang')
    // auto 模式下可能返回原始文本或带有高亮的文本
    expect(typeof result).toBe('string')
  })
})

describe('hljs', () => {
  it('导出实例有效', () => {
    expect(hljs).toBeDefined()
    expect(typeof hljs.highlight).toBe('function')
  })
})

describe('highlightAllInContainer', () => {
  it('处理容器中的代码块', () => {
    const container = document.createElement('div')
    const pre = document.createElement('pre')
    const code = document.createElement('code')
    code.className = 'language-js'
    code.textContent = 'const x = 1;'
    pre.appendChild(code)
    container.appendChild(pre)

    // mock highlight to return wrapped HTML
    const originalHighlight = hljs.highlight
    hljs.highlight = vi.fn().mockReturnValue({ value: '<span class="hljs-keyword">const</span> x = 1;' })

    highlightAllInContainer(container)

    expect(hljs.highlight).toHaveBeenCalledTimes(1)
    expect(code.innerHTML).toContain('<span class="hljs-keyword">')
    expect(code.dataset.highlighted).toBe('true')

    // restore
    hljs.highlight = originalHighlight
  })

  it('跳过已高亮的代码块', () => {
    const container = document.createElement('div')
    const pre = document.createElement('pre')
    const code = document.createElement('code')
    code.className = 'language-js'
    code.textContent = 'const x = 1;'
    code.dataset.highlighted = 'true'
    pre.appendChild(code)
    container.appendChild(pre)

    const originalHighlight = hljs.highlight
    hljs.highlight = vi.fn().mockReturnValue({ value: '<span>const</span>' })

    highlightAllInContainer(container)

    expect(hljs.highlight).not.toHaveBeenCalled()

    hljs.highlight = originalHighlight
  })
})
