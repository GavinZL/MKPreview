/** TOC 标题项 */
export interface TocHeading {
  level: number
  text: string
  id: string
  offsetTop: number
}

/** 同步滚动映射项 */
export interface ScrollMapping {
  sourceLine: number
  previewOffset: number
}

/** 搜索结果 */
export interface SearchResult {
  path: string
  name: string
  lineNumber: number | null
  context: string | null
  matchType: 'filename' | 'content'
}
