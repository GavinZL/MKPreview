/** 文件树节点 — 对应 Rust FileTreeNode */
export interface FileTreeNode {
  name: string
  path: string
  isDir: boolean
  children?: FileTreeNode[]
  fileCount?: number
}

/** 文件元信息 — 对应 Rust FileMeta */
export interface FileMeta {
  path: string
  size: number
  /** Unix timestamp (seconds since epoch) */
  modified: number
  /** Unix timestamp (seconds since epoch) */
  created: number
}

/** 文件系统变更类型 */
export type FsChangeType = 'created' | 'modified' | 'deleted' | 'renamed'

/** 文件系统变更事件 — 对应 Rust FsChangeEvent */
export interface FsChangeEvent {
  changeType: FsChangeType
  path: string
  oldPath?: string
  isDir: boolean
}

/** 文件系统错误事件 — 对应 Rust FsErrorEvent */
export interface FsErrorEvent {
  message: string
  timestamp: number
}
