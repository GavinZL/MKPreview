/** 预览风格模板 ID */
export type PreviewTemplateId =
  | 'default'
  | 'blog'
  | 'tech-doc'
  | 'academic'
  | 'minimalist'

/** 预览模板元数据 */
export interface PreviewTemplate {
  id: PreviewTemplateId
  name: string
  nameKey: string
  descKey: string
  description: string
}
