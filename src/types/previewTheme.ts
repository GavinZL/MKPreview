/** 预览区内置主题 ID */
export type BuiltInPreviewThemeId =
  | 'default'
  | 'orange'
  | 'purple'
  | 'teal'
  | 'green'
  | 'red'
  | 'blue'
  | 'indigo'
  | 'amber'
  | 'geek-black'
  | 'rose'
  | 'mint'
  | 'fullstack-blue'
  | 'minimal-black'
  | 'orange-blue'

/** 预览主题元数据 */
export interface PreviewTheme {
  id: BuiltInPreviewThemeId
  name: string
  description?: string
  isBuiltIn: boolean
}

/** 自定义主题颜色配置 */
export interface CustomThemeColors {
  accent: string
  accentRed: string
  accentGreen: string
  accentAmber: string
  accentPurple: string
  textLink: string
  textLinkHover: string
  borderAccent: string
  previewBgLight: string
  previewBgDark: string
}

/** 用户保存的自定义主题 */
export interface SavedCustomTheme {
  id: string
  name: string
  colors: CustomThemeColors
  createdAt: number
}
