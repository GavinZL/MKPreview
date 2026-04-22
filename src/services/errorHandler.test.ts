import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseError, getErrorLevel, handleError, invoke, invokeWithDefault } from './errorHandler'
import { ErrorCodes } from '@/types'

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { invoke as tauriInvoke } from '@tauri-apps/api/core'

describe('parseError', () => {
  it('JSON 字符串 → AppException', () => {
    const json = JSON.stringify({ code: 'FS_NOT_FOUND', message: 'File missing' })
    const result = parseError(json)
    expect(result.code).toBe('FS_NOT_FOUND')
    expect(result.message).toBe('File missing')
  })

  it('普通字符串 → UNKNOWN code', () => {
    const result = parseError('some error')
    expect(result.code).toBe(ErrorCodes.UNKNOWN)
    expect(result.message).toBe('some error')
  })

  it('Error 对象 → UNKNOWN code', () => {
    const err = new Error('oops')
    const result = parseError(err)
    expect(result.code).toBe(ErrorCodes.UNKNOWN)
    expect(result.message).toBe('oops')
  })

  it('其他类型 → String 转换', () => {
    const result = parseError(12345)
    expect(result.code).toBe(ErrorCodes.UNKNOWN)
    expect(result.message).toBe('12345')
  })
})

describe('getErrorLevel', () => {
  it('INTERNAL → fatal', () => {
    expect(getErrorLevel(ErrorCodes.INTERNAL)).toBe('fatal')
  })

  it('CFG_DESERIALIZE → silent', () => {
    expect(getErrorLevel(ErrorCodes.CFG_DESERIALIZE)).toBe('silent')
  })

  it('WATCH_RUNTIME → warning', () => {
    expect(getErrorLevel(ErrorCodes.WATCH_RUNTIME)).toBe('warning')
  })

  it('FS_NOT_FOUND → error', () => {
    expect(getErrorLevel(ErrorCodes.FS_NOT_FOUND)).toBe('error')
  })
})

describe('handleError', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fatal 级别调用 console.error', () => {
    handleError({ code: ErrorCodes.INTERNAL, message: 'fatal' })
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('error 级别调用 console.error', () => {
    handleError({ code: ErrorCodes.FS_NOT_FOUND, message: 'not found' })
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('warning 级别调用 console.warn', () => {
    handleError({ code: ErrorCodes.WATCH_RUNTIME, message: 'watch' })
    expect(consoleWarnSpy).toHaveBeenCalled()
  })

  it('silent 级别在 DEV 下调用 console.info', () => {
    handleError({ code: ErrorCodes.CFG_DESERIALIZE, message: 'silent' })
    if (import.meta.env.DEV) {
      expect(consoleInfoSpy).toHaveBeenCalled()
    }
  })
})

describe('invoke', () => {
  beforeEach(() => {
    vi.mocked(tauriInvoke).mockReset()
  })

  it('成功调用返回值', async () => {
    vi.mocked(tauriInvoke).mockResolvedValue('success')
    const result = await invoke<string>('test_cmd')
    expect(result).toBe('success')
  })

  it('失败时解析错误并抛出 AppException', async () => {
    const errObj = { code: 'FS_NOT_FOUND', message: 'missing' }
    vi.mocked(tauriInvoke).mockRejectedValue(JSON.stringify(errObj))
    await expect(invoke('test_cmd')).rejects.toMatchObject({
      code: 'FS_NOT_FOUND',
      message: 'missing',
    })
  })
})

describe('invokeWithDefault', () => {
  beforeEach(() => {
    vi.mocked(tauriInvoke).mockReset()
  })

  it('成功时返回实际值', async () => {
    vi.mocked(tauriInvoke).mockResolvedValue('real')
    const result = await invokeWithDefault<string>('test_cmd', undefined, 'default')
    expect(result).toBe('real')
  })

  it('失败时返回默认值', async () => {
    vi.mocked(tauriInvoke).mockRejectedValue('error')
    const result = await invokeWithDefault<string>('test_cmd', undefined, 'default')
    expect(result).toBe('default')
  })
})
