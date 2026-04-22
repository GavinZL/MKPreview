/** 前端错误类型 — 对应 Rust AppError 序列化后的结构 */
export interface AppException {
  /** 错误码，如 FS_NOT_FOUND */
  code: string
  /** 用户友好的错误消息 */
  message: string
  /** 额外上下文数据（路径、大小等） */
  details?: Record<string, unknown>
}

/** 错误码常量 — 与 Rust AppError::error_code() 完全对齐 */
export const ErrorCodes = {
  // 文件系统
  FS_IO_ERROR: 'FS_IO_ERROR',
  FS_NOT_FOUND: 'FS_NOT_FOUND',
  FS_OUT_OF_SCOPE: 'FS_OUT_OF_SCOPE',
  FS_INVALID_PATH: 'FS_INVALID_PATH',
  FS_NOT_MD: 'FS_NOT_MD',
  FS_NOT_DIR: 'FS_NOT_DIR',
  FS_TOO_LARGE: 'FS_TOO_LARGE',
  FS_NO_PERMISSION: 'FS_NO_PERMISSION',
  // 配置
  CFG_SERIALIZE: 'CFG_SERIALIZE',
  CFG_DESERIALIZE: 'CFG_DESERIALIZE',
  CFG_INVALID_VALUE: 'CFG_INVALID_VALUE',
  CFG_NO_DATA_DIR: 'CFG_NO_DATA_DIR',
  // 监控
  WATCH_START_FAIL: 'WATCH_START_FAIL',
  WATCH_RUNTIME: 'WATCH_RUNTIME',
  WATCH_PATH_GONE: 'WATCH_PATH_GONE',
  // 搜索
  SEARCH_INVALID_DIR: 'SEARCH_INVALID_DIR',
  SEARCH_TIMEOUT: 'SEARCH_TIMEOUT',
  // 通用
  INTERNAL: 'INTERNAL',
  UNKNOWN: 'UNKNOWN',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

/** 错误级别 */
export type ErrorLevel = 'fatal' | 'error' | 'warning' | 'silent'
