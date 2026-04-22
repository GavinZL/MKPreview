import { describe, it, expect } from 'vitest'
import { naturalSort } from './naturalSort'

describe('naturalSort', () => {
  it('纯字母排序', () => {
    expect(naturalSort('a', 'b')).toBeLessThan(0)
    expect(naturalSort('b', 'a')).toBeGreaterThan(0)
    expect(naturalSort('a', 'a')).toBe(0)
  })

  it('数字自然排序', () => {
    const files = ['file1', 'file10', 'file2']
    files.sort(naturalSort)
    expect(files).toEqual(['file1', 'file2', 'file10'])
  })

  it('中文排序', () => {
    expect(naturalSort('中文', '英文')).not.toBe(0)
    const chars = ['中文', '英文', '日文']
    chars.sort(naturalSort)
    // 按 zh-CN 拼音排序：日(rì) < 英(yīng) < 中(zhōng)
    expect(chars).toEqual(['日文', '英文', '中文'])
  })

  it('大小写不敏感', () => {
    expect(naturalSort('A', 'a')).toBe(0)
    expect(naturalSort('File', 'file')).toBe(0)
  })

  it('空字符串处理', () => {
    expect(naturalSort('', '')).toBe(0)
    expect(naturalSort('', 'a')).toBeLessThan(0)
    expect(naturalSort('a', '')).toBeGreaterThan(0)
  })
})
