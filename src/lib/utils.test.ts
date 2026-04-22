import { describe, it, expect } from 'vitest'
import { formatFileSize } from './utils'

describe('formatFileSize', () => {
  it('0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })

  it('512 bytes', () => {
    expect(formatFileSize(512)).toBe('512 B')
  })

  it('1024 bytes = 1.0 KB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
  })

  it('1536 bytes = 1.5 KB', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })

  it('1048576 bytes = 1.0 MB', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB')
  })

  it('大文件', () => {
    expect(formatFileSize(1073741824)).toBe('1024.0 MB')
  })
})
