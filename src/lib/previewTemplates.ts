import type { PreviewTemplate } from '@/types'

export const previewTemplates: PreviewTemplate[] = [
  {
    id: 'default',
    name: '默认标准',
    nameKey: 'default',
    descKey: 'defaultDesc',
    description: '通用 Markdown 阅读样式，平衡的信息密度与阅读舒适度',
  },
  {
    id: 'blog',
    name: '博客文章',
    nameKey: 'blog',
    descKey: 'blogDesc',
    description: '适合长文阅读，宽松行距，首字下沉，图片突出',
  },
  {
    id: 'tech-doc',
    name: '技术文档',
    nameKey: 'techDoc',
    descKey: 'techDocDesc',
    description: '信息密度高，无衬线字体，紧凑排版，适合 API 文档',
  },
  {
    id: 'academic',
    name: '学术论文',
    nameKey: 'academic',
    descKey: 'academicDesc',
    description: '衬线字体，标题自动编号，首行缩进，三线表',
  },
  {
    id: 'minimalist',
    name: '极简风格',
    nameKey: 'minimalist',
    descKey: 'minimalistDesc',
    description: '大量留白，去除多余装饰，专注内容本身',
  },
]
