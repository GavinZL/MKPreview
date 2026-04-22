import type { ScrollMapping } from '@/types/markdown'

/**
 * 同步滚动引擎
 * 基于段落映射法实现源码行号与预览偏移的双向映射
 * 通过 markdown-it 注入的 data-source-line 属性构建映射表
 */
export class ScrollSyncEngine {
  private mappings: ScrollMapping[] = []

  /**
   * 从预览容器的 data-source-line 属性构建映射表
   * 扫描所有带 data-source-line 属性的元素，获取其相对于滚动容器的偏移
   */
  buildMappings(previewContainer: HTMLElement): void {
    this.mappings = []

    const elements = previewContainer.querySelectorAll<HTMLElement>('[data-source-line]')
    if (elements.length === 0) return

    const containerRect = previewContainer.getBoundingClientRect()
    const seen = new Map<number, number>()

    elements.forEach((el) => {
      const lineAttr = el.getAttribute('data-source-line')
      if (!lineAttr) return

      const sourceLine = parseInt(lineAttr, 10)
      if (isNaN(sourceLine)) return

      // 使用 getBoundingClientRect 计算元素相对于滚动容器的绝对偏移
      const elRect = el.getBoundingClientRect()
      const previewOffset = elRect.top - containerRect.top + previewContainer.scrollTop

      // 同一 sourceLine 保留最小偏移（最顶部的映射点）
      const existing = seen.get(sourceLine)
      if (existing === undefined || previewOffset < existing) {
        seen.set(sourceLine, previewOffset)
      }
    })

    // 构建映射表并按源码行号排序
    this.mappings = Array.from(seen.entries())
      .map(([sourceLine, previewOffset]) => ({ sourceLine, previewOffset }))
      .sort((a, b) => a.sourceLine - b.sourceLine)
  }

  /**
   * 源码行号 → 预览偏移
   * 使用二分查找定位映射区间，再线性插值计算精确偏移
   */
  sourceLineToPreviewOffset(line: number): number {
    if (this.mappings.length === 0) return 0

    const first = this.mappings[0]
    const last = this.mappings[this.mappings.length - 1]

    // 边界：行号小于最小映射行
    if (line <= first.sourceLine) return first.previewOffset

    // 边界：行号大于最大映射行
    if (line >= last.sourceLine) return last.previewOffset

    // 二分查找：找到 sourceLine <= line 的最大索引
    let left = 0
    let right = this.mappings.length - 1

    while (left < right) {
      const mid = Math.floor((left + right + 1) / 2)
      if (this.mappings[mid].sourceLine <= line) {
        left = mid
      } else {
        right = mid - 1
      }
    }

    const mapping = this.mappings[left]

    // 精确匹配
    if (mapping.sourceLine === line) {
      return mapping.previewOffset
    }

    // 线性插值：在两个映射点之间按比例计算
    const nextMapping = this.mappings[left + 1]
    if (!nextMapping) return mapping.previewOffset

    const lineDelta = line - mapping.sourceLine
    const totalLineDelta = nextMapping.sourceLine - mapping.sourceLine
    const offsetDelta = nextMapping.previewOffset - mapping.previewOffset

    return mapping.previewOffset + (lineDelta / totalLineDelta) * offsetDelta
  }

  /**
   * 预览偏移 → 源码行号
   * 使用二分查找定位映射区间，再线性插值计算精确行号
   */
  previewOffsetToSourceLine(offset: number): number {
    if (this.mappings.length === 0) return 0

    const first = this.mappings[0]
    const last = this.mappings[this.mappings.length - 1]

    // 边界：偏移小于最小映射偏移
    if (offset <= first.previewOffset) return first.sourceLine

    // 边界：偏移大于最大映射偏移
    if (offset >= last.previewOffset) return last.sourceLine

    // 二分查找：找到 previewOffset <= offset 的最大索引
    let left = 0
    let right = this.mappings.length - 1

    while (left < right) {
      const mid = Math.floor((left + right + 1) / 2)
      if (this.mappings[mid].previewOffset <= offset) {
        left = mid
      } else {
        right = mid - 1
      }
    }

    const mapping = this.mappings[left]

    // 精确匹配
    if (mapping.previewOffset === offset) {
      return mapping.sourceLine
    }

    // 线性插值：在两个映射点之间按比例计算
    const nextMapping = this.mappings[left + 1]
    if (!nextMapping) return mapping.sourceLine

    const offsetDelta = offset - mapping.previewOffset
    const totalOffsetDelta = nextMapping.previewOffset - mapping.previewOffset
    const lineDelta = nextMapping.sourceLine - mapping.sourceLine

    return mapping.sourceLine + (offsetDelta / totalOffsetDelta) * lineDelta
  }

  /** 获取映射表是否为空 */
  get hasMappings(): boolean {
    return this.mappings.length > 0
  }

  /** 清空映射 */
  clear(): void {
    this.mappings = []
  }
}
