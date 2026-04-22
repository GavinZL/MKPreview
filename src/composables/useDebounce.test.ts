import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useDebounce } from './useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('初始值等于 source 值', () => {
    const source = ref('hello')
    const debounced = useDebounce(source, 300)
    expect(debounced.value).toBe('hello')
  })

  it('延迟后值更新', async () => {
    const source = ref('hello')
    const debounced = useDebounce(source, 300)
    source.value = 'world'
    await nextTick()
    expect(debounced.value).toBe('hello')
    vi.advanceTimersByTime(300)
    expect(debounced.value).toBe('world')
  })

  it('快速连续变化只取最后一个值', async () => {
    const source = ref('a')
    const debounced = useDebounce(source, 300)

    source.value = 'b'
    await nextTick()
    vi.advanceTimersByTime(100)

    source.value = 'c'
    await nextTick()
    vi.advanceTimersByTime(100)

    source.value = 'd'
    await nextTick()
    vi.advanceTimersByTime(100)

    // 此时 'b' 的定时器已经触发，但 'c' 和 'd' 还没
    // 继续推进时间
    vi.advanceTimersByTime(300)
    expect(debounced.value).toBe('d')
  })
})
