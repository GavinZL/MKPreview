import { slugifyHeading } from './markdownIt'

export interface FileSizeLabels {
  b: string
  kb: string
  mb: string
}

export function formatFileSize(bytes: number, labels?: FileSizeLabels): string {
  const { b = 'B', kb = 'KB', mb = 'MB' } = labels ?? {}
  if (bytes < 1024) return `${bytes} ${b}`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${kb}`
  return `${(bytes / (1024 * 1024)).toFixed(1)} ${mb}`
}

/**
 * 在容器内查找锚点目标元素
 * 提供多层回退匹配策略，处理不同 slugify 规则生成的 ID 不一致问题
 * @param container 搜索容器
 * @param targetId 锚点 ID（来自 href="#xxx"）
 * @returns 匹配到的 HTMLElement 或 null
 */
export function findAnchorTarget(
  container: HTMLElement,
  targetId: string
): HTMLElement | null {
  if (!targetId) return null

  // 策略 1: 精确匹配
  let el = container.querySelector(`[id="${CSS.escape(targetId)}"]`) as HTMLElement | null
  if (el) return el

  // 策略 2: slugify 规范化匹配（处理特殊字符、空格、大小写）
  const slugified = slugifyHeading(targetId)
  el = container.querySelector(`[id="${CSS.escape(slugified)}"]`) as HTMLElement | null
  if (el) return el

  // 策略 3: 小写匹配
  el = container.querySelector(`[id="${CSS.escape(targetId.toLowerCase())}"]`) as HTMLElement | null
  if (el) return el

  // 策略 4: 空格替换为连字符
  el = container.querySelector(`[id="${CSS.escape(targetId.replace(/\s+/g, '-'))}"]`) as HTMLElement | null
  if (el) return el

  // 策略 5: 遍历所有 heading，比较 id（处理重复标题的后缀差异等）
  const headings = container.querySelectorAll<HTMLHeadingElement>('h1, h2, h3, h4, h5, h6')
  for (const heading of headings) {
    if (heading.id === targetId || heading.id === slugified) {
      return heading
    }
  }

  // 策略 6: 遍历所有 heading，比较文本内容的 slugify 结果
  for (const heading of headings) {
    const text = heading.textContent?.replace(/#/g, '').trim() || ''
    const textSlug = slugifyHeading(text)
    if (
      textSlug === slugified ||
      text === targetId ||
      textSlug.endsWith(`-${slugified}`) ||
      // 处理连字符数量差异（如标题含中文冒号被 slugify 为 `-`，但 TOC 链接省略了冒号）
      textSlug.replace(/-/g, '') === slugified.replace(/-/g, '')
    ) {
      return heading
    }
  }

  // 策略 7: 遍历所有 heading，进行大小写不敏感的文本比较
  for (const heading of headings) {
    const text = heading.textContent?.replace(/#/g, '').trim() || ''
    if (text.toLowerCase() === targetId.toLowerCase()) {
      return heading
    }
  }

  return null
}
