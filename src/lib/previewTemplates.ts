import type { PreviewTemplate } from '@/types'

export const previewTemplates: PreviewTemplate[] = [
  {
    id: 'default',
    name: '默认标准',
    description: '通用 Markdown 阅读样式，平衡的信息密度与阅读舒适度',
  },
  {
    id: 'blog',
    name: '博客文章',
    description: '适合长文阅读，宽松行距，首字下沉，图片突出',
  },
  {
    id: 'tech-doc',
    name: '技术文档',
    description: '信息密度高，无衬线字体，紧凑排版，适合 API 文档',
  },
  {
    id: 'academic',
    name: '学术论文',
    description: '衬线字体，标题自动编号，首行缩进，三线表',
  },
  {
    id: 'minimalist',
    name: '极简风格',
    description: '大量留白，去除多余装饰，专注内容本身',
  },
]
