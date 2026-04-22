import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { FsChangeEvent, FsErrorEvent } from '@/types'

/**
 * Tauri Event 监听封装层
 * 所有 listen 调用统一在此
 */
export const tauriEvents = {
  /** 监听文件系统变更事件 */
  onFsChange: (callback: (event: FsChangeEvent) => void): Promise<UnlistenFn> =>
    listen<FsChangeEvent>('fs:change', (event) => {
      callback(event.payload)
    }),

  /** 监听文件系统错误事件 */
  onFsError: (callback: (event: FsErrorEvent) => void): Promise<UnlistenFn> =>
    listen<FsErrorEvent>('fs:error', (event) => {
      callback(event.payload)
    }),
}
