import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ScrollSyncEngine } from './scrollSyncEngine'

function mockElementRect(el: HTMLElement, top: number) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    top,
    left: 0,
    right: 100,
    bottom: top + 20,
    width: 100,
    height: 20,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect)
}

describe('ScrollSyncEngine', () => {
  let engine: ScrollSyncEngine

  beforeEach(() => {
    engine = new ScrollSyncEngine()
    vi.restoreAllMocks()
  })

  describe('buildMappings', () => {
    it('从预览容器构建映射表', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <h1 data-source-line="0">Title</h1>
        <p data-source-line="2">Paragraph 1</p>
        <p data-source-line="5">Paragraph 2</p>
      `
      container.scrollTop = 0
      mockElementRect(container, 0)
      container.querySelectorAll('[data-source-line]').forEach((el, i) => {
        mockElementRect(el as HTMLElement, i * 30)
      })

      engine.buildMappings(container)
      expect(engine.hasMappings).toBe(true)
    })

    it('空容器不构建映射', () => {
      const container = document.createElement('div')
      mockElementRect(container, 0)
      engine.buildMappings(container)
      expect(engine.hasMappings).toBe(false)
    })

    it('同一 sourceLine 保留最小偏移', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <div data-source-line="0">First</div>
        <div data-source-line="0">Second</div>
      `
      container.scrollTop = 0
      mockElementRect(container, 0)
      const elements = container.querySelectorAll('[data-source-line]')
      mockElementRect(elements[0] as HTMLElement, 100)
      mockElementRect(elements[1] as HTMLElement, 50)

      engine.buildMappings(container)
      const offset = engine.sourceLineToPreviewOffset(0)
      expect(offset).toBe(50)
    })
  })

  describe('sourceLineToPreviewOffset', () => {
    it('空映射返回 0', () => {
      expect(engine.sourceLineToPreviewOffset(10)).toBe(0)
    })

    it('精确匹配返回对应偏移', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <h1 data-source-line="0">Title</h1>
        <p data-source-line="2">Paragraph</p>
      `
      container.scrollTop = 0
      mockElementRect(container, 0)
      mockElementRect(container.querySelector('h1') as HTMLElement, 0)
      mockElementRect(container.querySelector('p') as HTMLElement, 40)

      engine.buildMappings(container)
      expect(engine.sourceLineToPreviewOffset(0)).toBe(0)
      expect(engine.sourceLineToPreviewOffset(2)).toBe(40)
    })

    it('行号小于最小映射行返回第一个偏移', () => {
      const container = document.createElement('div')
      container.innerHTML = `<p data-source-line="5">Paragraph</p>`
      container.scrollTop = 0
      mockElementRect(container, 0)
      mockElementRect(container.querySelector('p') as HTMLElement, 50)

      engine.buildMappings(container)
      const firstOffset = engine.sourceLineToPreviewOffset(5)
      expect(engine.sourceLineToPreviewOffset(0)).toBe(firstOffset)
    })

    it('行号大于最大映射行返回最后一个偏移', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <p data-source-line="0">First</p>
        <p data-source-line="10">Last</p>
      `
      container.scrollTop = 0
      mockElementRect(container, 0)
      mockElementRect(container.querySelectorAll('p')[0] as HTMLElement, 0)
      mockElementRect(container.querySelectorAll('p')[1] as HTMLElement, 100)

      engine.buildMappings(container)
      const lastOffset = engine.sourceLineToPreviewOffset(10)
      expect(engine.sourceLineToPreviewOffset(100)).toBe(lastOffset)
    })

    it('在两个映射点之间线性插值', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <p data-source-line="0">First</p>
        <p data-source-line="10">Last</p>
      `
      container.scrollTop = 0
      mockElementRect(container, 0)
      mockElementRect(container.querySelectorAll('p')[0] as HTMLElement, 0)
      mockElementRect(container.querySelectorAll('p')[1] as HTMLElement, 100)

      engine.buildMappings(container)
      const offset = engine.sourceLineToPreviewOffset(5)
      expect(offset).toBeGreaterThan(0)
      expect(offset).toBeLessThan(100)
    })

    it('单映射点超出范围返回该点偏移', () => {
      const container = document.createElement('div')
      container.innerHTML = `<p data-source-line="5">Only</p>`
      container.scrollTop = 0
      mockElementRect(container, 0)
      mockElementRect(container.querySelector('p') as HTMLElement, 30)

      engine.buildMappings(container)
      const offset = engine.sourceLineToPreviewOffset(5)
      expect(engine.sourceLineToPreviewOffset(0)).toBe(offset)
      expect(engine.sourceLineToPreviewOffset(100)).toBe(offset)
    })
  })

  describe('previewOffsetToSourceLine', () => {
    it('空映射返回 0', () => {
      expect(engine.previewOffsetToSourceLine(10)).toBe(0)
    })

    it('精确匹配返回对应行号', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <h1 data-source-line="0">Title</h1>
        <p data-source-line="2">Paragraph</p>
      `
      container.scrollTop = 0
      mockElementRect(container, 0)
      mockElementRect(container.querySelector('h1') as HTMLElement, 0)
      mockElementRect(container.querySelector('p') as HTMLElement, 40)

      engine.buildMappings(container)
      expect(engine.previewOffsetToSourceLine(0)).toBe(0)
      expect(engine.previewOffsetToSourceLine(40)).toBe(2)
    })

    it('偏移小于最小映射偏移返回第一行行号', () => {
      const container = document.createElement('div')
      container.innerHTML = `<p data-source-line="5">Paragraph</p>`
      container.scrollTop = 0
      mockElementRect(container, 0)
      mockElementRect(container.querySelector('p') as HTMLElement, 50)

      engine.buildMappings(container)
      const firstLine = engine.previewOffsetToSourceLine(50)
      expect(engine.previewOffsetToSourceLine(0)).toBe(firstLine)
    })

    it('偏移大于最大映射偏移返回最后一行行号', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <p data-source-line="0">First</p>
        <p data-source-line="10">Last</p>
      `
      container.scrollTop = 0
      mockElementRect(container, 0)
      mockElementRect(container.querySelectorAll('p')[0] as HTMLElement, 0)
      mockElementRect(container.querySelectorAll('p')[1] as HTMLElement, 100)

      engine.buildMappings(container)
      const lastLine = engine.previewOffsetToSourceLine(100)
      expect(engine.previewOffsetToSourceLine(1000)).toBe(lastLine)
    })

    it('在两个映射点之间反向插值', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <p data-source-line="0">First</p>
        <p data-source-line="10">Last</p>
      `
      container.scrollTop = 0
      mockElementRect(container, 0)
      mockElementRect(container.querySelectorAll('p')[0] as HTMLElement, 0)
      mockElementRect(container.querySelectorAll('p')[1] as HTMLElement, 100)

      engine.buildMappings(container)
      const line = engine.previewOffsetToSourceLine(50)
      expect(line).toBeGreaterThan(0)
      expect(line).toBeLessThan(10)
    })

    it('单映射点超出范围返回该行号', () => {
      const container = document.createElement('div')
      container.innerHTML = `<p data-source-line="5">Only</p>`
      container.scrollTop = 0
      mockElementRect(container, 0)
      mockElementRect(container.querySelector('p') as HTMLElement, 30)

      engine.buildMappings(container)
      const line = engine.previewOffsetToSourceLine(30)
      expect(engine.previewOffsetToSourceLine(0)).toBe(line)
      expect(engine.previewOffsetToSourceLine(1000)).toBe(line)
    })
  })

  describe('clear', () => {
    it('清空映射表', () => {
      const container = document.createElement('div')
      container.innerHTML = `<p data-source-line="0">Paragraph</p>`
      container.scrollTop = 0
      mockElementRect(container, 0)
      mockElementRect(container.querySelector('p') as HTMLElement, 20)

      engine.buildMappings(container)
      expect(engine.hasMappings).toBe(true)

      engine.clear()
      expect(engine.hasMappings).toBe(false)
      expect(engine.sourceLineToPreviewOffset(0)).toBe(0)
    })
  })
})
