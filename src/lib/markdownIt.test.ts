import { describe, it, expect } from 'vitest'
import MarkdownIt from 'markdown-it'
import { createMarkdownIt, renderMarkdown } from './markdownIt'

describe('createMarkdownIt', () => {
  it('返回 MarkdownIt 实例', () => {
    const md = createMarkdownIt()
    expect(md).toBeInstanceOf(MarkdownIt)
  })

  it('基础渲染：标题', () => {
    const md = createMarkdownIt()
    const html = md.render('# Hello')
    expect(html).toContain('<h1')
    expect(html).toContain('Hello')
  })

  it('基础渲染：段落', () => {
    const md = createMarkdownIt()
    const html = md.render('Hello world')
    expect(html).toContain('<p>Hello world</p>')
  })

  it('基础渲染：列表', () => {
    const md = createMarkdownIt()
    const html = md.render('- item1\n- item2')
    expect(html).toContain('<ul')
    expect(html).toContain('<li>item1</li>')
    expect(html).toContain('<li>item2</li>')
  })

  it('基础渲染：粗体斜体', () => {
    const md = createMarkdownIt()
    const html = md.render('**bold** *italic*')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
  })

  it('anchor 插件：标题生成 id slug', () => {
    const md = createMarkdownIt()
    const html = md.render('# Hello World')
    expect(html).toContain('id="hello-world"')
  })

  it('anchor 插件：中文 slug', () => {
    const md = createMarkdownIt()
    const html = md.render('# 中文标题')
    expect(html).toContain('id="中文标题"')
  })

  it('task-lists 插件：- [x] 渲染为 checkbox', () => {
    const md = createMarkdownIt()
    const html = md.render('- [x] done')
    expect(html).toContain('checked')
  })

  it('task-lists 插件：- [ ] 渲染为 checkbox', () => {
    const md = createMarkdownIt()
    const html = md.render('- [ ] todo')
    expect(html).toContain('type="checkbox"')
    expect(html).not.toContain('checked')
  })

  it('图片路径转换：相对路径 → asset:// 协议', () => {
    const md = createMarkdownIt({ baseDir: '/docs' })
    const html = md.render('![alt](image.png)')
    expect(html).toContain('asset:///docs/image.png')
  })

  it('图片路径转换：绝对路径不转换', () => {
    const md = createMarkdownIt({ baseDir: '/docs' })
    const html = md.render('![alt](/absolute.png)')
    expect(html).not.toContain('asset://')
  })

  it('外部链接：http:// 链接添加 target="_blank" 和 rel="noopener noreferrer"', () => {
    const md = createMarkdownIt()
    const html = md.render('[link](http://example.com)')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('外部链接：https:// 链接添加 target="_blank"', () => {
    const md = createMarkdownIt()
    const html = md.render('[link](https://example.com)')
    expect(html).toContain('target="_blank"')
  })

  it('内部链接不添加 target', () => {
    const md = createMarkdownIt()
    const html = md.render('[link](./local.md)')
    expect(html).not.toContain('target="_blank"')
  })

  it('fence 自定义渲染：生成 code-block-wrapper + code-header + code-copy-btn', () => {
    const md = createMarkdownIt()
    const html = md.render('```js\nconst x = 1;\n```')
    expect(html).toContain('class="code-block-wrapper"')
    expect(html).toContain('class="code-header"')
    expect(html).toContain('class="code-copy-btn"')
    expect(html).toContain('class="code-lang"')
  })

  it('mermaid 拦截：`\`\`mermaid 生成 <div class="mermaid">', () => {
    const md = createMarkdownIt()
    const html = md.render('```mermaid\ngraph TD\nA-->B\n```')
    expect(html).toContain('<div class="mermaid">')
    expect(html).not.toContain('code-block-wrapper')
  })

  it('sourceMap 模式：生成 data-source-line 属性', () => {
    const md = createMarkdownIt({ enableSourceMap: true })
    const html = md.render('# Title\n\nparagraph')
    expect(html).toContain('data-source-line="0"')
    expect(html).toContain('data-source-line="2"')
  })

  describe('KaTeX 支持', () => {
    it('行内公式 $E=mc^2$ 渲染为含 katex 类的 HTML', () => {
      const md = createMarkdownIt({ enableKaTeX: true })
      const html = md.render('$E=mc^2$')
      expect(html).toContain('katex')
    })

    it('块级公式 $$\\sum_{i=1}^n$$ 渲染为 display math', () => {
      const md = createMarkdownIt({ enableKaTeX: true })
      const html = md.render('$$\sum_{i=1}^n$$')
      expect(html).toContain('katex')
      expect(html).toContain('katex-display')
    })

    it('非数学 $ 符号不被错误匹配', () => {
      const md = createMarkdownIt({ enableKaTeX: true })
      const html = md.render('The price is $5 and $10')
      // 未匹配的 $ 应该保持原样或不被解析为数学公式
      expect(html).toContain('$5')
      expect(html).toContain('$10')
    })

    it('多行块级公式渲染正确', () => {
      const md = createMarkdownIt({ enableKaTeX: true })
      const html = md.render('$$\n\\int_0^1 x dx\n$$')
      expect(html).toContain('katex')
      expect(html).toContain('katex-display')
    })

    it('未启用 KaTeX 时 $ 符号按普通文本处理', () => {
      const md = createMarkdownIt({ enableKaTeX: false })
      const html = md.render('$E=mc^2$')
      expect(html).not.toContain('katex')
      expect(html).toContain('$E=mc^2$')
    })
  })
})

describe('renderMarkdown', () => {
  it('便捷函数渲染 Markdown', () => {
    const html = renderMarkdown('# Hello')
    expect(html).toContain('<h1')
  })

  it('传递 baseDir 参数', () => {
    const html = renderMarkdown('![img](pic.png)', '/docs')
    expect(html).toContain('asset:///docs/pic.png')
  })
})
