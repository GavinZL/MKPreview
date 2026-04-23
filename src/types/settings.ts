/** 主题偏好 */
export type ThemePreference = 'system' | 'light' | 'dark'

/** 显示模式 */
export type DisplayMode = 'preview' | 'source' | 'split'

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

/** 预览风格模板 ID */
export type PreviewTemplateId =
  | 'default'
  | 'blog'
  | 'tech-doc'
  | 'academic'
  | 'minimalist'

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

/** 窗口状态 */
export interface WindowState {
  width: number
  height: number
  x: number
  y: number
  maximized: boolean
}

/** 用户配置 — 对应 Rust Settings */
export interface Settings {
  theme: ThemePreference
  fontSize: number
  codeFontSize: number
  recentDirectories: string[]
  lastDirectory: string | null
  treeExpandedState: Record<string, boolean>
  windowState: WindowState
  sidebarWidth: number
  showLineNumbers: boolean
  autoSave: boolean
  autoSaveInterval: number
  // Phase 2 新增
  enableMermaid?: boolean
  enableKaTeX?: boolean
  enableFolding?: boolean
  fontBody?: string
  fontCode?: string
  // F09 预览主题与模板
  previewTheme?: BuiltInPreviewThemeId
  previewTemplate?: PreviewTemplateId
  customThemes?: SavedCustomTheme[]
}
