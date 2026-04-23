import { describe, it, expect } from 'vitest'
import { formatFileSize, findAnchorTarget } from './utils'

describe('formatFileSize', () => {
  it('0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })

  it('512 bytes', () => {
    expect(formatFileSize(512)).toBe('512 B')
  })

  it('1024 bytes = 1.0 KB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
  })

  it('1536 bytes = 1.5 KB', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })

  it('1048576 bytes = 1.0 MB', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB')
  })

  it('大文件', () => {
    expect(formatFileSize(1073741824)).toBe('1024.0 MB')
  })
})

describe('findAnchorTarget', () => {
  function createContainer(html: string): HTMLElement {
    const div = document.createElement('div')
    div.innerHTML = html
    return div
  }

  it('策略1: 精确匹配 id', () => {
    const container = createContainer('<h2 id="hello-world">Hello World</h2>')
    const result = findAnchorTarget(container, 'hello-world')
    expect(result).not.toBeNull()
    expect(result?.tagName).toBe('H2')
  })

  it('策略2: slugify 规范化匹配', () => {
    const container = createContainer('<h2 id="hello-world">Hello World</h2>')
    const result = findAnchorTarget(container, 'Hello World')
    expect(result).not.toBeNull()
    expect(result?.id).toBe('hello-world')
  })

  it('策略3: 小写匹配', () => {
    const container = createContainer('<h2 id="UPPERCASE">UPPERCASE</h2>')
    const result = findAnchorTarget(container, 'uppercase')
    expect(result).not.toBeNull()
    expect(result?.id).toBe('UPPERCASE')
  })

  it('策略4: 空格替换为连字符', () => {
    const container = createContainer('<h2 id="hello-world">Hello World</h2>')
    const result = findAnchorTarget(container, 'hello world')
    expect(result).not.toBeNull()
    expect(result?.id).toBe('hello-world')
  })

  it('策略5: 遍历 heading 比较 id（处理重复标题后缀）', () => {
    const container = createContainer(`
      <h2 id="标题">标题</h2>
      <h2 id="标题-2">标题</h2>
    `)
    // 用户 TOC 可能写的是 #标题，只能找到第一个
    const result = findAnchorTarget(container, '标题')
    expect(result).not.toBeNull()
    expect(result?.id).toBe('标题')
  })

  it('策略6: 通过 heading 文本内容反推 slugify 匹配', () => {
    const container = createContainer('<h2 id="1-引言">1. 引言</h2>')
    // 用户 TOC 可能省略了序号，只写 #引言
    const result = findAnchorTarget(container, '引言')
    expect(result).not.toBeNull()
    expect(result?.textContent).toBe('1. 引言')
  })

  it('策略6b: 处理中文冒号被 slugify 为连字符但 TOC 省略的情况', () => {
    // 模拟 "第一部分：枚举深度解析" 被 slugify 为 "第一部分-枚举深度解析"
    const container = createContainer('<h2 id="第一部分-枚举深度解析">第一部分：枚举深度解析</h2>')
    // 用户 TOC 链接写的是 #第一部分枚举深度解析（省略了冒号）
    const result = findAnchorTarget(container, '第一部分枚举深度解析')
    expect(result).not.toBeNull()
    expect(result?.textContent).toBe('第一部分：枚举深度解析')
  })

  it('策略6b: 处理 TL;DR 中的分号被 slugify 的情况', () => {
    // "核心结论 TL;DR" 被 slugify 为 "核心结论-tl-dr"
    const container = createContainer('<h2 id="核心结论-tl-dr">核心结论 TL;DR</h2>')
    // 用户 TOC 链接写的是 #核心结论-tldr（省略了分号对应的连字符）
    const result = findAnchorTarget(container, '核心结论-tldr')
    expect(result).not.toBeNull()
    expect(result?.textContent).toBe('核心结论 TL;DR')
  })

  it('策略6b: 处理中英文混合标题（CTAD 类模板参数推导）', () => {
    // "第五部分：CTAD 类模板参数推导" 被 slugify 为 "第五部分-ctad-类模板参数推导"
    const container = createContainer('<h2 id="第五部分-ctad-类模板参数推导">第五部分：CTAD 类模板参数推导</h2>')
    // 场景 A: 用户省略冒号和空格
    const resultA = findAnchorTarget(container, '第五部分CTAD类模板参数推导')
    expect(resultA).not.toBeNull()
    expect(resultA?.textContent).toBe('第五部分：CTAD 类模板参数推导')
    // 场景 B: 用户保留冒号但省略空格
    const resultB = findAnchorTarget(container, '第五部分：CTAD类模板参数推导')
    expect(resultB).not.toBeNull()
    // 场景 C: 用户只取 CTAD 部分
    const resultC = findAnchorTarget(container, 'ctad-类模板参数推导')
    expect(resultC).not.toBeNull()
  })

  it('策略7: 大小写不敏感的文本比较', () => {
    const container = createContainer('<h2 id="custom-id">My Heading</h2>')
    // id 和文本都不直接匹配，但文本大小写不敏感匹配
    const result = findAnchorTarget(container, 'my heading')
    expect(result).not.toBeNull()
    expect(result?.textContent).toBe('My Heading')
  })

  it('中文标题精确匹配', () => {
    const container = createContainer('<h2 id="中文标题">中文标题</h2>')
    const result = findAnchorTarget(container, '中文标题')
    expect(result).not.toBeNull()
    expect(result?.id).toBe('中文标题')
  })

  it('URL 编码后的中文锚点匹配', () => {
    const container = createContainer('<h2 id="中文标题">中文标题</h2>')
    // 模拟已 decodeURIComponent 后的 targetId
    const result = findAnchorTarget(container, '中文标题')
    expect(result).not.toBeNull()
  })

  it('找不到目标时返回 null', () => {
    const container = createContainer('<h2 id="exist">Exist</h2>')
    const result = findAnchorTarget(container, 'not-exist')
    expect(result).toBeNull()
  })

  it('空 targetId 返回 null', () => {
    const container = createContainer('<h2 id="test">Test</h2>')
    expect(findAnchorTarget(container, '')).toBeNull()
  })
})
