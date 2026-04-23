import { invoke as tauriInvoke } from '@tauri-apps/api/core'
import type { AppException, ErrorLevel } from '@/types'
import { ErrorCodes } from '@/types'

/** 可传入 Vue I18n 的 t 函数，用于将错误码映射为本地化消息 */
export type TranslateFn = (key: string, values?: Record<string, unknown>) => string

/**
 * 解析 Tauri IPC 错误字符串为结构化 AppException
 * 保留 Rust 传来的原始 message 作为后备
 */
export function parseError(err: unknown): AppException {
  if (typeof err === 'string') {
    try {
      const parsed = JSON.parse(err)
      if (parsed.code && parsed.message) {
        return {
          code: parsed.code,
          message: parsed.message,
          details: parsed.details,
        } as AppException
      }
    } catch {
      // 非 JSON 字符串，降级处理
    }
    return { code: ErrorCodes.UNKNOWN, message: err }
  }
  if (err instanceof Error) {
    return { code: ErrorCodes.UNKNOWN, message: err.message }
  }
  return { code: ErrorCodes.UNKNOWN, message: String(err) }
}

/**
 * 根据错误码获取本地化错误消息
 * @param err AppException
 * @param t vue-i18n 的 t 函数
 * @returns 本地化后的错误消息
 */
export function getLocalizedErrorMessage(err: AppException, t: TranslateFn): string {
  const key = `error.${err.code}`
  const fallback = err.message || t('error.UNKNOWN')
  // vue-i18n 在 key 不存在时会返回 key 本身，此时用 fallback
  const localized = t(key, err.details || {})
  return localized === key ? fallback : localized
}

/**
 * 根据错误码判断错误级别
 */
export function getErrorLevel(code: string): ErrorLevel {
  switch (code) {
    case ErrorCodes.INTERNAL:
      return 'fatal'

    case ErrorCodes.CFG_DESERIALIZE:
    case ErrorCodes.CFG_NO_DATA_DIR:
      return 'silent'

    case ErrorCodes.WATCH_RUNTIME:
    case ErrorCodes.WATCH_PATH_GONE:
    case ErrorCodes.CFG_INVALID_VALUE:
    case ErrorCodes.WATCH_START_FAIL:
      return 'warning'

    default:
      return 'error'
  }
}

/**
 * 统一错误处理入口 — 根据级别决定展示方式
 * MVP 阶段仅做 console 日志，UI 提示将在后续组件中实现
 */
export function handleError(err: AppException): void {
  const level = getErrorLevel(err.code)

  switch (level) {
    case 'fatal':
      console.error('[FATAL]', err.code, err.message, err.details)
      break
    case 'error':
      console.error('[AppError]', err.code, err.message, err.details)
      break
    case 'warning':
      console.warn('[AppWarn]', err.code, err.message, err.details)
      break
    case 'silent':
      // 仅记录，不展示
      if (import.meta.env.DEV) {
        console.info('[AppSilent]', err.code, err.message, err.details)
      }
      break
  }
}

/**
 * 统一 IPC 调用封装
 * 自动捕获错误并转换为 AppException
 */
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await tauriInvoke<T>(cmd, args)
  } catch (err) {
    const appErr = parseError(err)
    handleError(appErr)
    throw appErr
  }
}

/**
 * 带默认值的 IPC 调用 — 错误时返回默认值而非抛出
 */
export async function invokeWithDefault<T>(
  cmd: string,
  args: Record<string, unknown> | undefined,
  defaultValue: T
): Promise<T> {
  try {
    return await tauriInvoke<T>(cmd, args)
  } catch (err) {
    const appErr = parseError(err)
    handleError(appErr)
    return defaultValue
  }
}
