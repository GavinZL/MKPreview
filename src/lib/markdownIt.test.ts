import { describe, it, expect } from 'vitest'
import MarkdownIt from 'markdown-it'
import { createMarkdownIt, renderMarkdown, resolveRelativePath } from './markdownIt'

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

  it('图片路径转换：相对路径 → 绝对路径', () => {
    const md = createMarkdownIt({ baseDir: '/docs' })
    const html = md.render('![alt](image.png)')
    expect(html).toContain('/docs/image.png')
  })

  it('图片路径转换：绝对路径保持不变', () => {
    const md = createMarkdownIt({ baseDir: '/docs' })
    const html = md.render('![alt](/absolute.png)')
    expect(html).toContain('/absolute.png')
  })

  it('图片路径转换：网络图片不转换', () => {
    const md = createMarkdownIt({ baseDir: '/docs' })
    const html = md.render('![alt](https://example.com/img.png)')
    expect(html).toContain('https://example.com/img.png')
  })

  it('图片路径转换：data URI 不转换', () => {
    const md = createMarkdownIt({ baseDir: '/docs' })
    const html = md.render('![alt](data:image/png;base64,abc)')
    expect(html).toContain('data:image/png;base64,abc')
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
    expect(html).toContain('/docs/pic.png')
  })
})

describe('resolveRelativePath', () => {
  it('解析 ./ 前缀路径', () => {
    expect(resolveRelativePath('/docs/project', './sub/file.md')).toBe('/docs/project/sub/file.md')
  })

  it('解析 ../ 前缀路径', () => {
    expect(resolveRelativePath('/docs/project/sub', '../parent.md')).toBe('/docs/project/parent.md')
  })

  it('解析多层 ../ 路径', () => {
    expect(resolveRelativePath('/a/b/c/d', '../../file.md')).toBe('/a/b/file.md')
  })

  it('绝对路径不转换', () => {
    expect(resolveRelativePath('/docs', '/absolute/path.md')).toBe('/absolute/path.md')
  })

  it('空 base 返回原路径', () => {
    expect(resolveRelativePath('', './file.md')).toBe('./file.md')
  })

  it('空 relativePath 返回原路径', () => {
    expect(resolveRelativePath('/docs', '')).toBe('')
  })
})

describe('内部链接处理', () => {
  it('相对路径 .md 链接添加 internal-link 类和 data-file-path', () => {
    const md = createMarkdownIt({ baseDir: '/docs/project' })
    const html = md.render('[文档](./subfolder/doc.md)')
    expect(html).toContain('class="internal-link"')
    expect(html).toContain('data-file-path="/docs/project/subfolder/doc.md"')
  })

  it('父目录 .md 链接正确解析路径', () => {
    const md = createMarkdownIt({ baseDir: '/docs/project/sub' })
    const html = md.render('[返回](../parent.md)')
    expect(html).toContain('data-file-path="/docs/project/parent.md"')
  })

  it('.md 链接带锚点时保留 hash', () => {
    const md = createMarkdownIt({ baseDir: '/docs' })
    const html = md.render('[章节](./doc.md#section)')
    expect(html).toContain('data-file-path="/docs/doc.md"')
    expect(html).toContain('data-hash="#section"')
  })

  it('.markdown 扩展名也被识别为内部链接', () => {
    const md = createMarkdownIt({ baseDir: '/docs' })
    const html = md.render('[文档](./doc.markdown)')
    expect(html).toContain('class="internal-link"')
    expect(html).toContain('data-file-path="/docs/doc.markdown"')
  })

  it('外部链接不受影响', () => {
    const md = createMarkdownIt({ baseDir: '/docs' })
    const html = md.render('[外部](https://example.com)')
    expect(html).toContain('class="external-link"')
    expect(html).not.toContain('internal-link')
  })

  it('内部链接的 href 设为 javascript:void(0)', () => {
    const md = createMarkdownIt({ baseDir: '/docs' })
    const html = md.render('[文档](./doc.md)')
    expect(html).toContain('href="javascript:void(0)"')
  })
})

describe('图片路径解析', () => {
  it('相对路径图片解析为绝对路径', () => {
    const md = createMarkdownIt({ baseDir: '/docs' })
    const html = md.render('![图片](./images/test.png)')
    expect(html).toContain('/docs/images/test.png')
  })

  it('父目录图片路径正确解析', () => {
    const md = createMarkdownIt({ baseDir: '/docs/sub' })
    const html = md.render('![图片](../images/test.png)')
    expect(html).toContain('/docs/images/test.png')
  })
})
