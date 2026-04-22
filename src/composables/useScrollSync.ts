import { ref, nextTick, onMounted, onUnmounted, type Ref } from 'vue'
import { ScrollSyncEngine } from '@/lib/scrollSyncEngine'

export interface UseScrollSyncOptions {
  /** 是否启用同步，默认 true */
  enabled?: Ref<boolean>
}

/**
 * 同步滚动 composable
 * 连接源码编辑器滚动容器与预览滚动容器，实现双向同步滚动
 *
 * @param sourceContainer 源码侧滚动容器 (CodeMirror 的 .cm-scroller)
 * @param previewContainer 预览侧滚动容器 (MarkdownPreview 的 .markdown-preview)
 * @param options 配置项
 */
export function useScrollSync(
  sourceContainer: Ref<HTMLElement | undefined>,
  previewContainer: Ref<HTMLElement | undefined>,
  options?: UseScrollSyncOptions
) {
  const engine = new ScrollSyncEngine()
  /** 防止循环同步标志 */
  const isSyncing = ref(false)
  const isEnabled = ref(false)

  let sourceScrollHandler: (() => void) | null = null
  let previewScrollHandler: (() => void) | null = null

  /** 从源码同步到预览 */
  function syncSourceToPreview(): void {
    if (isSyncing.value || !sourceContainer.value || !previewContainer.value) return
    if (!engine.hasMappings) return

    isSyncing.value = true

    // 获取源码当前滚动对应的行号
    const scrollTop = sourceContainer.value.scrollTop
    const lineHeight = parseFloat(getComputedStyle(sourceContainer.value).lineHeight) || 20
    const currentLine = Math.floor(scrollTop / lineHeight)

    // 映射到预览偏移
    const targetOffset = engine.sourceLineToPreviewOffset(currentLine)

    requestAnimationFrame(() => {
      if (previewContainer.value) {
        previewContainer.value.scrollTo({ top: targetOffset, behavior: 'auto' })
      }
      // 延迟重置防止循环
      setTimeout(() => { isSyncing.value = false }, 50)
    })
  }

  /** 从预览同步到源码 */
  function syncPreviewToSource(): void {
    if (isSyncing.value || !sourceContainer.value || !previewContainer.value) return
    if (!engine.hasMappings) return

    isSyncing.value = true

    // 获取预览当前滚动位置对应的源码行号
    const scrollTop = previewContainer.value!.scrollTop
    const targetLine = engine.previewOffsetToSourceLine(scrollTop)

    // 计算源码目标滚动位置
    const lineHeight = parseFloat(getComputedStyle(sourceContainer.value!).lineHeight) || 20
    const targetScrollTop = targetLine * lineHeight

    requestAnimationFrame(() => {
      if (sourceContainer.value) {
        sourceContainer.value.scrollTo({ top: targetScrollTop, behavior: 'auto' })
      }
      // 延迟重置防止循环
      setTimeout(() => { isSyncing.value = false }, 50)
    })
  }

  /** 内容变化后重建映射表 */
  function rebuildMappings(): void {
    if (!previewContainer.value) return
    nextTick(() => {
      if (previewContainer.value) {
        engine.buildMappings(previewContainer.value)
      }
    })
  }

  /** 启用同步滚动监听 */
  function enableSync(): void {
    if (isEnabled.value) return

    const source = sourceContainer.value
    const preview = previewContainer.value
    if (!source || !preview) return

    sourceScrollHandler = () => syncSourceToPreview()
    previewScrollHandler = () => syncPreviewToSource()

    source.addEventListener('scroll', sourceScrollHandler, { passive: true })
    preview.addEventListener('scroll', previewScrollHandler, { passive: true })

    isEnabled.value = true
  }

  /** 禁用同步滚动监听 */
  function disableSync(): void {
    const source = sourceContainer.value
    const preview = previewContainer.value

    if (source && sourceScrollHandler) {
      source.removeEventListener('scroll', sourceScrollHandler)
    }
    if (preview && previewScrollHandler) {
      preview.removeEventListener('scroll', previewScrollHandler)
    }

    sourceScrollHandler = null
    previewScrollHandler = null
    isEnabled.value = false
  }

  onMounted(() => {
    if (options?.enabled === undefined || options.enabled.value) {
      enableSync()
    }
  })

  onUnmounted(() => {
    disableSync()
    engine.clear()
  })

  return {
    syncSourceToPreview,
    syncPreviewToSource,
    rebuildMappings,
    enableSync,
    disableSync,
  }
}
