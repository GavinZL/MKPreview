# F09-01 Tauri 构建配置 [MVP]

## 1. 功能描述与目标

**功能描述**：配置 Tauri 2.0 应用的构建基础环境，包括应用元信息、窗口配置、安全策略（CSP、FS Scope）、打包配置、前端构建优化和 Rust 编译优化。

**目标**：
- 配置 `tauri.conf.json` 应用名称、版本、描述、分类
- 配置应用图标（自动生成多尺寸）
- 配置 Tauri 2.0 Capabilities/Permissions（最小权限原则）
- 配置 Content Security Policy（CSP）防止 XSS
- 配置 FS Scope 限定用户选择的目录 + `$APPDATA`
- 前端 Vite 生产模式优化（代码分割、tree-shaking、压缩）
- Rust 编译优化（LTO、codegen-units=1、strip=true）
- 开发命令 `npm run tauri dev` 和生产构建命令 `npm run tauri build`

**PRD 关联**：NFR-003（安装与分发）、NFR-004（安全性）、PRD 5.3 Rust IPC 命令接口

---

## 2. 技术实现方案

### 2.1 tauri.conf.json 完整配置

```json
// src-tauri/tauri.conf.json
{
  "$schema": "../node_modules/@tauri-apps/cli/config.schema.json",
  "productName": "MKPreview",
  "version": "1.0.0",
  "identifier": "com.mkpreview.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "MKPreview",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false,
        "center": true,
        "decorations": true,
        "transparent": false,
        "visible": true,
        "skipTaskbar": false
      }
    ],
    "security": {
      "csp": {
        "default-src": "'self'",
        "script-src": "'self'",
        "style-src": "'self' 'unsafe-inline'",
        "img-src": "'self' asset: https:",
        "font-src": "'self' data:",
        "connect-src": "'self' ipc: http://ipc.localhost",
        "frame-src": "'none'",
        "object-src": "'none'"
      },
      "capabilities": ["default"]
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "resources": [],
    "copyright": "© 2026 MKPreview",
    "category": "DeveloperTool",
    "shortDescription": "跨平台 Markdown 知识库精美渲染与浏览桌面应用",
    "longDescription": "MKPreview 是一款面向技术知识库管理场景的跨平台桌面应用，核心解决「大规模 Markdown 知识库的精美渲染浏览与轻量编辑」问题。",
    "macOS": {
      "frameworks": [],
      "minimumSystemVersion": "10.15",
      "license": "MIT",
      "signingIdentity": null,
      "entitlements": null,
      "dmg": {
        "windowSize": {
          "width": 660,
          "height": 440
        },
        "appPosition": {
          "x": 180,
          "y": 170
        },
        "applicationFolderPosition": {
          "x": 480,
          "y": 170
        }
      }
    },
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "",
      "nsis": {
        "installMode": "both",
        "startMenuFolder": "MKPreview",
        "installerIcon": "icons/icon.ico",
        "displayLanguageSelector": false,
        "languages": ["SimpChinese", "English"]
      }
    }
  }
}
```

### 2.2 Capabilities 权限配置

```json
// src-tauri/capabilities/default.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "MKPreview 默认权限配置",
  "windows": ["main"],
  "permissions": [
    "core:default",
    {
      "identifier": "fs:allow-read",
      "allow": [{ "path": "$APPDATA" }]
    },
    {
      "identifier": "fs:allow-write",
      "allow": [{ "path": "$APPDATA" }]
    },
    "dialog:allow-open",
    "shell:allow-open"
  ]
}
```

### 2.3 Cargo.toml 配置

```toml
# src-tauri/Cargo.toml
[package]
name = "mkpreview"
version = "1.0.0"
edition = "2021"
authors = ["MKPreview Team"]
description = "跨平台 Markdown 知识库精美渲染与浏览桌面应用"
license = "MIT"
repository = "https://github.com/your-org/mkpreview"
rust-version = "1.75"

[lib]
name = "mkpreview_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[[bin]]
name = "mkpreview"
path = "src/main.rs"

[build-dependencies]
tauri-build = { version = "2.0", features = [] }

[dependencies]
tauri = { version = "2.0", features = [] }
tauri-plugin-shell = "2.0"
tauri-plugin-dialog = "2.0"
tauri-plugin-fs = "2.0"

notify = "6.1"
walkdir = "2.5"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

[profile.release]
# 启用链接时优化（减少二进制体积）
lto = true
# 单代码生成单元（最大化优化）
codegen-units = 1
# 去除符号表（减小体积）
strip = true
# 优化级别
opt-level = 3
# 恐慌时立即终止（不展开栈）
panic = "abort"
```

### 2.4 Vite 生产配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  // 开发服务器配置（Tauri 开发模式）
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },

  // 生产构建优化
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        // 代码分割策略
        manualChunks: {
          // 框架核心
          'vue-core': ['vue', 'pinia'],
          // CodeMirror 编辑器
          'codemirror': [
            '@codemirror/view',
            '@codemirror/state',
            '@codemirror/lang-markdown',
            '@codemirror/commands',
            '@codemirror/search',
          ],
          // Markdown 渲染
          'markdown': [
            'markdown-it',
            'markdown-it-anchor',
            'markdown-it-task-lists',
          ],
          // 图表与公式
          'render-ext': ['mermaid', 'katex'],
          // 代码高亮
          'highlight': ['highlight.js'],
          // Tauri API
          'tauri': ['@tauri-apps/api', '@tauri-apps/plugin-dialog'],
        },
        // 资源文件命名
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') ?? []
          const ext = info[info.length - 1] ?? ''
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(ext)) {
            return 'assets/images/[name]-[hash][extname]'
          }
          if (/\.(woff2?|ttf|otf|eot)$/.test(ext)) {
            return 'assets/fonts/[name]-[hash][extname]'
          }
          if (ext === 'css') {
            return 'assets/styles/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
  },

  // CSS 优化
  css: {
    devSourcemap: true,
    postcss: {
      plugins: [],
    },
  },
})
```

### 2.5 package.json 脚本

```json
{
  "name": "mkpreview",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "tauri:build:universal": "tauri build --target universal-apple-darwin",
    "lint": "eslint . --ext .vue,.ts,.tsx",
    "typecheck": "vue-tsc --noEmit"
  },
  "dependencies": {
    "@codemirror/commands": "^6.5.0",
    "@codemirror/lang-markdown": "^6.2.0",
    "@codemirror/language-data": "^6.5.0",
    "@codemirror/search": "^6.5.0",
    "@codemirror/state": "^6.4.0",
    "@codemirror/theme-one-dark": "^6.1.0",
    "@codemirror/view": "^6.28.0",
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-dialog": "^2.0.0",
    "@tauri-apps/plugin-fs": "^2.0.0",
    "@tauri-apps/plugin-shell": "^2.0.0",
    "highlight.js": "^11.9.0",
    "katex": "^0.16.9",
    "markdown-it": "^14.0.0",
    "markdown-it-anchor": "^8.6.7",
    "markdown-it-task-lists": "^2.1.1",
    "mermaid": "^10.8.0",
    "pinia": "^2.1.7",
    "vue": "^3.4.0"
  },
  "devDependencies": {
    "@types/markdown-it": "^13.0.7",
    "@vitejs/plugin-vue": "^5.0.0",
    "@vue/tsconfig": "^0.5.1",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.33",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vue-tsc": "^1.8.0",
    "@tauri-apps/cli": "^2.0.0"
  }
}
```

### 2.6 TypeScript 配置

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 2.7 环境类型声明

```typescript
// env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string
  readonly VITE_APP_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Tauri API 全局类型
declare module '@tauri-apps/api' {
  export * from '@tauri-apps/api/core'
  export * from '@tauri-apps/api/event'
}
```

---

## 3. 接口定义

### 3.1 Tauri 构建 CLI 命令

```bash
# 开发模式（热重载）
npm run tauri dev

# 生产构建（当前平台）
npm run tauri build

# macOS Universal Binary
npm run tauri build -- --target universal-apple-darwin

# 指定目标平台
npm run tauri build -- --target aarch64-apple-darwin
npm run tauri build -- --target x86_64-apple-darwin
npm run tauri build -- --target x86_64-pc-windows-msvc
```

### 3.2 构建产物目录结构

```
src-tauri/target/
├── release/                          # 生产构建
│   ├── mkpreview                     # 可执行文件（Linux/macOS）
│   ├── mkpreview.exe                 # 可执行文件（Windows）
│   └── bundle/
│       ├── dmg/                      # macOS DMG
│       ├── msi/                      # Windows MSI
│       ├── nsis/                     # Windows NSIS Installer
│       └── appimage/                 # Linux AppImage
├── universal-apple-darwin/release/   # macOS Universal Binary
│   └── bundle/dmg/
└── debug/                            # 调试构建
```

---

## 4. 数据结构

### 4.1 前端代码分割策略

| Chunk 名 | 包含内容 | 预估体积 |
|---------|---------|---------|
| vue-core | Vue 3 + Pinia | ~60KB |
| codemirror | CodeMirror 6 编辑器 | ~180KB |
| markdown | markdown-it + 插件 | ~50KB |
| render-ext | mermaid + katex | ~800KB |
| highlight | highlight.js | ~120KB |
| tauri | Tauri API + 插件 | ~40KB |

### 4.2 CSP 策略矩阵

| 指令 | 值 | 说明 |
|------|-----|------|
| default-src | 'self' | 默认只允许同源 |
| script-src | 'self' | 禁止内联/外部脚本 |
| style-src | 'self' 'unsafe-inline' | 允许内联样式（CodeMirror 需要） |
| img-src | 'self' asset: https: | 允许本地 asset 协议和 HTTPS 图片 |
| font-src | 'self' data: | 允许本地和数据 URI 字体 |
| connect-src | 'self' ipc: http://ipc.localhost | Tauri IPC 通信 |
| frame-src | 'none' | 禁止 iframe |
| object-src | 'none' | 禁止 Flash/插件 |

---

## 5. 依赖关系

| 依赖 | 说明 |
|------|------|
| Tauri 2.0 CLI | 构建工具和运行时 |
| Vite 5.x | 前端构建工具 |
| Vue 3 + TypeScript | 前端框架 |
| Tailwind CSS | CSS 工具类 |
| Rust Toolchain | 后端编译 |

**被依赖**：
- F09-02 macOS 打包
- F09-03 Windows 打包
- F09-04 CI/CD 自动构建

---

## 6. 测试要点

### 6.1 构建测试

| 测试项 | 命令 | 预期 |
|--------|------|------|
| 开发模式 | `npm run tauri dev` | 正常启动，热重载工作 |
| 类型检查 | `npm run typecheck` | 无 TypeScript 错误 |
| 生产构建 | `npm run tauri build` | 构建成功，产物在 bundle/ 目录 |
| 产物体积 | 检查 bundle 大小 | 安装包 < 15MB |

### 6.2 安全测试

| 测试项 | 预期 |
|--------|------|
| CSP 生效 | 控制台无 CSP 违规报错 |
| eval 禁止 | 代码中无 eval / new Function |
| FS Scope 限制 | 只能访问用户选择的目录和 APPDATA |

### 6.3 跨平台验证

- macOS (Apple Silicon): `npm run tauri build`
- macOS (Intel): `npm run tauri build`
- Windows: `npm run tauri build`
