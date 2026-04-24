/** 文件标签 — MVP 阶段为单文件，Phase 2 扩展为多标签 */
export interface FileTab {
  path: string
  name: string
}

export interface TabItem {
  id: string
  path: string
  name: string
  content: string
  scrollPosition: number
}

/** 光标位置 */
export interface CursorPosition {
  line: number
  ch: number
}

/** Phase 2 完整标签接口（TabItem 的超集） */
export interface Tab extends TabItem {
  cursorPosition: CursorPosition
  isModified: boolean
  /** 文件打开时的 mtime，用于保存时检测外部修改冲突 */
  originalMtime?: number
}
