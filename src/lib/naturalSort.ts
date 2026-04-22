export function naturalSort(a: string, b: string): number {
  const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })
  return collator.compare(a, b)
}
