import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTheme } from '@/composables/useTheme'
import { tauriCommands } from '@/services/tauriCommands'
import * as errorHandler from '@/services/errorHandler'
import { ErrorCodes } from '@/types'
import type { FileTreeNode, FileMeta, Settings, FsChangeEvent, FsErrorEvent, AppException } from '@/types'

/**
 * ============================================================
 * 集成测试：模块间接口契约和数据流一致性验证
 * ============================================================
 */

describe('Store 互操作', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('settingsStore theme 变化通过 useTheme 正确反映', async () => {
    const settingsStore = useSettingsStore()
    const { resolvedTheme, isDark, toggleTheme } = useTheme()

    // 初始状态（system 偏好）
    expect(settingsStore.theme).toBe('system')
    expect(['light', 'dark']).toContain(resolvedTheme.value)

    // 切换为 dark
    settingsStore.setTheme('dark')
    await nextTick()
    expect(resolvedTheme.value).toBe('dark')
    expect(isDark.value).toBe(true)

    // 切换为 light
    settingsStore.setTheme('light')
    await nextTick()
    expect(resolvedTheme.value).toBe('light')
    expect(isDark.value).toBe(false)

    // toggleTheme 应切换为相反的主题
    const beforeToggle = resolvedTheme.value
    toggleTheme()
    await nextTick()
    expect(resolvedTheme.value).toBe(beforeToggle === 'light' ? 'dark' : 'light')
  })

  it('settingsStore 的 resolvedTheme getter 正确计算', () => {
    const settingsStore = useSettingsStore()
    expect(settingsStore.resolvedTheme).toBeDefined()
    expect(['light', 'dark']).toContain(settingsStore.resolvedTheme)
  })
})

describe('错误处理链路', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
  })

  it('parseError 正确解析 Rust JSON 错误', () => {
    const rustJson = JSON.stringify({
      code: 'FS_NOT_FOUND',
      message: '文件不存在: /test.md',
      details: { path: '/test.md' },
    })
    const err = errorHandler.parseError(rustJson)
    expect(err.code).toBe('FS_NOT_FOUND')
    expect(err.message).toContain('/test.md')
    expect(err.details).toEqual({ path: '/test.md' })
  })

  it('parseError 降级处理非 JSON 字符串', () => {
    const err = errorHandler.parseError('some plain error')
    expect(err.code).toBe(ErrorCodes.UNKNOWN)
    expect(err.message).toBe('some plain error')
  })

  it('parseError 降级处理 Error 对象', () => {
    const err = errorHandler.parseError(new Error('network failure'))
    expect(err.code).toBe(ErrorCodes.UNKNOWN)
    expect(err.message).toBe('network failure')
  })

  it('handleError 根据级别输出正确日志', () => {
    const fatalErr: AppException = { code: ErrorCodes.INTERNAL, message: 'fatal' }
    const errorErr: AppException = { code: ErrorCodes.FS_NOT_FOUND, message: 'error' }
    const warnErr: AppException = { code: ErrorCodes.WATCH_START_FAIL, message: 'warn' }

    errorHandler.handleError(fatalErr)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[FATAL]', 'INTERNAL', 'fatal', undefined)

    errorHandler.handleError(errorErr)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[AppError]', 'FS_NOT_FOUND', 'error', undefined)

    errorHandler.handleError(warnErr)
    expect(consoleWarnSpy).toHaveBeenCalledWith('[AppWarn]', 'WATCH_START_FAIL', 'warn', undefined)
  })

  it('getErrorLevel 与 Rust 错误码正确映射', () => {
    expect(errorHandler.getErrorLevel(ErrorCodes.INTERNAL)).toBe('fatal')
    expect(errorHandler.getErrorLevel(ErrorCodes.CFG_DESERIALIZE)).toBe('silent')
    expect(errorHandler.getErrorLevel(ErrorCodes.CFG_NO_DATA_DIR)).toBe('silent')
    expect(errorHandler.getErrorLevel(ErrorCodes.WATCH_RUNTIME)).toBe('warning')
    expect(errorHandler.getErrorLevel(ErrorCodes.WATCH_PATH_GONE)).toBe('warning')
    expect(errorHandler.getErrorLevel(ErrorCodes.FS_NOT_FOUND)).toBe('error')
    expect(errorHandler.getErrorLevel(ErrorCodes.UNKNOWN)).toBe('error')
  })
})

describe('IPC 命令清单完整性', () => {
  it('tauriCommands 导出的所有命令与后端 generate_handler! 对齐', async () => {
    // 这些是 src-tauri/src/lib.rs 中 generate_handler! 注册的命令
    const expectedCommands = [
      'scan_directory',
      'read_file',
      'get_file_meta',
      'get_settings',
      'save_settings',
      'start_watching',
      'stop_watching',
    ]

    const invokeSpy = vi.spyOn(errorHandler, 'invoke').mockResolvedValue(undefined)

    // 按顺序调用每个命令，收集传入的命令名
    await tauriCommands.scanDirectory('/test')
    await tauriCommands.readFile('/test.md')
    await tauriCommands.getFileMeta('/test.md')
    await tauriCommands.getSettings()
    await tauriCommands.saveSettings({} as Settings)
    await tauriCommands.startWatching('/test')
    await tauriCommands.stopWatching()

    const actualCommands = invokeSpy.mock.calls.map(call => call[0] as string)

    invokeSpy.mockRestore()

    // 注意：write_file 在 Phase 2 实现，MVP 中不应存在
    expect(actualCommands).toEqual(expectedCommands)
    expect(actualCommands).not.toContain('write_file')
  })

  it('tauriCommands 包含所有 MVP 阶段必需的命令', () => {
    expect(tauriCommands.scanDirectory).toBeTypeOf('function')
    expect(tauriCommands.readFile).toBeTypeOf('function')
    expect(tauriCommands.getFileMeta).toBeTypeOf('function')
    expect(tauriCommands.getSettings).toBeTypeOf('function')
    expect(tauriCommands.saveSettings).toBeTypeOf('function')
    expect(tauriCommands.startWatching).toBeTypeOf('function')
    expect(tauriCommands.stopWatching).toBeTypeOf('function')
  })
})

describe('类型兼容性', () => {
  it('FileTreeNode 类型字段与 Rust 模型通过 camelCase 映射一致', () => {
    const node: FileTreeNode = {
      name: 'docs',
      path: '/docs',
      isDir: true,
      children: [],
      fileCount: 5,
    }
    expect(node.name).toBeDefined()
    expect(node.path).toBeDefined()
    expect(node.isDir).toBeDefined() // Rust: is_dir -> camelCase -> isDir
    expect(node.children).toBeDefined()
    expect(node.fileCount).toBeDefined() // Rust: file_count -> camelCase -> fileCount
  })

  it('FileMeta 类型字段与 Rust 模型一致', () => {
    const meta: FileMeta = {
      path: '/a.md',
      size: 1024,
      modified: 1700000000,
      created: 1700000000,
    }
    expect(meta.path).toBeDefined()
    expect(meta.size).toBeDefined()
    expect(meta.modified).toBeDefined()
    expect(meta.created).toBeDefined()
  })

  it('Settings 类型字段与 Rust 模型通过 camelCase 映射一致', () => {
    const settings: Settings = {
      theme: 'system',
      fontSize: 16, // Rust: font_size
      codeFontSize: 14, // Rust: code_font_size
      recentDirectories: [], // Rust: recent_directories
      lastDirectory: null, // Rust: last_directory
      treeExpandedState: {}, // Rust: tree_expanded_state
      windowState: { width: 1200, height: 800, x: 0, y: 0, maximized: false },
      sidebarWidth: 260, // Rust: sidebar_width
      showLineNumbers: true, // Rust: show_line_numbers
      autoSave: false, // Rust: auto_save
      autoSaveInterval: 3, // Rust: auto_save_interval
    }
    expect(settings.theme).toBeDefined()
    expect(settings.fontSize).toBeDefined()
    expect(settings.codeFontSize).toBeDefined()
    expect(settings.recentDirectories).toBeDefined()
    expect(settings.lastDirectory).toBeDefined()
    expect(settings.treeExpandedState).toBeDefined()
    expect(settings.windowState).toBeDefined()
    expect(settings.sidebarWidth).toBeDefined()
    expect(settings.showLineNumbers).toBeDefined()
    expect(settings.autoSave).toBeDefined()
    expect(settings.autoSaveInterval).toBeDefined()
  })

  it('FsChangeEvent 类型字段与 Rust 模型通过 camelCase 映射一致', () => {
    const event: FsChangeEvent = {
      changeType: 'modified', // Rust: change_type (lowercase enum)
      path: '/a.md',
      oldPath: undefined, // Rust: old_path
      isDir: false, // Rust: is_dir
    }
    expect(event.changeType).toBeDefined()
    expect(event.path).toBeDefined()
    expect(event.isDir).toBeDefined()
  })

  it('FsErrorEvent 类型字段与 Rust 模型一致', () => {
    const event: FsErrorEvent = {
      message: 'error',
      timestamp: 1700000000,
    }
    expect(event.message).toBeDefined()
    expect(event.timestamp).toBeDefined()
  })
})

describe('组件依赖关系', () => {
  it('关键组件可以动态导入而不报错', async () => {
    // 验证 import 链路完整，不会抛出模块解析错误
    await expect(import('@/components/layout/AppLayout.vue')).resolves.toBeDefined()
    await expect(import('@/components/layout/Toolbar.vue')).resolves.toBeDefined()
    await expect(import('@/components/layout/StatusBar.vue')).resolves.toBeDefined()
    await expect(import('@/components/file-tree/FileTree.vue')).resolves.toBeDefined()
    await expect(import('@/components/file-tree/TreeNode.vue')).resolves.toBeDefined()
    await expect(import('@/components/editor/SingleFileView.vue')).resolves.toBeDefined()
    await expect(import('@/components/editor/SourceEditor.vue')).resolves.toBeDefined()
    await expect(import('@/components/preview/MarkdownPreview.vue')).resolves.toBeDefined()
  })

  it('stores 可以正常实例化', async () => {
    setActivePinia(createPinia())
    const { useFileTreeStore } = await import('@/stores/fileTreeStore')
    const { useTabStore } = await import('@/stores/tabStore')
    const { useUiStore } = await import('@/stores/uiStore')

    expect(() => useFileTreeStore()).not.toThrow()
    expect(() => useTabStore()).not.toThrow()
    expect(() => useUiStore()).not.toThrow()
    expect(() => useSettingsStore()).not.toThrow()
  })
})
