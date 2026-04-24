import { invoke } from './errorHandler'
import type { FileTreeNode, FileMeta, Settings, SearchResult } from '@/types'

/**
 * Tauri IPC Command 封装层
 * 所有 invoke 调用统一在此，组件和 Store 禁止直接调用 @tauri-apps/api
 */
export const tauriCommands = {
  /** 扫描目录，返回文件树 */
  scanDirectory: (path: string): Promise<FileTreeNode[]> =>
    invoke<FileTreeNode[]>('scan_directory', { path }),

  /** 读取文件内容 */
  readFile: (path: string): Promise<string> =>
    invoke<string>('read_file', { path }),

  /** 写入文件内容 (Phase 2) */
  writeFile: (path: string, content: string, expectedMtime?: number): Promise<void> =>
    invoke<void>('write_file', { path, content, expectedMtime }),

  /** 获取文件元信息 */
  getFileMeta: (path: string): Promise<FileMeta> =>
    invoke<FileMeta>('get_file_meta', { path }),

  /** 启动文件监控 */
  startWatching: (path: string): Promise<void> =>
    invoke<void>('start_watching', { path }),

  /** 停止文件监控 */
  stopWatching: (): Promise<void> =>
    invoke<void>('stop_watching'),

  /** 读取用户配置 */
  getSettings: (): Promise<Settings> =>
    invoke<Settings>('get_settings'),

  /** 全局搜索文件 */
  searchFiles: (dir: string, query: string): Promise<SearchResult[]> =>
    invoke<SearchResult[]>('search_files', { dir, query }),

  /** 保存用户配置 */
  saveSettings: (settings: Settings): Promise<void> =>
    invoke<void>('save_settings', { settings }),
}
