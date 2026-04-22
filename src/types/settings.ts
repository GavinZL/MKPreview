/** 主题偏好 */
export type ThemePreference = 'system' | 'light' | 'dark'

/** 显示模式 */
export type DisplayMode = 'preview' | 'source' | 'split'

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
}
