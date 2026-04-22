# F09-03 Windows 打包 [Phase 3]

## 1. 功能描述与目标

**功能描述**：Phase 3 阶段实现 Windows 平台的应用打包，生成 `.msi` 安装包和 `.exe` NSIS 安装包，支持 x64 和 ARM64 架构。可选 Portable 版本和代码签名。

**目标**：
- 构建目标：x64（主要）+ ARM64（可选）
- 生成 `.msi` 标准 Windows Installer
- 生成 `.exe` NSIS 安装包（支持静默安装）
- 可选 Portable 版本（不安装直接运行的 .exe）
- 可选 Windows Authenticode 代码签名
- NSIS 配置：安装路径、桌面快捷方式、开始菜单
- 安装包体积目标 < 15MB
- 验证 WebView2 Runtime 自动安装

**PRD 关联**：NFR-002（跨平台一致性）、NFR-003（安装与分发）

---

## 2. 技术实现方案

### 2.1 构建前置条件

```powershell
# Windows 打包前置条件：

# 1. 安装 Rust（如未安装）
# https://rustup.rs/

# 2. 安装 Node.js（v18+）
# https://nodejs.org/

# 3. 安装 Visual Studio Build Tools 2022
# 必需组件：
# - MSVC v143 - VS 2022 C++ x64/x86 生成工具
# - Windows 10/11 SDK

# 4. 安装 WebView2 Runtime（Windows 10/11 通常已预装）
# https://developer.microsoft.com/microsoft-edge/webview2/

# 5. 安装项目依赖
npm install

# 6. 安装 Tauri CLI
npm install -g @tauri-apps/cli
```

### 2.2 生产构建

```powershell
# Windows 环境下（PowerShell / CMD）
npm run tauri build

# 产物位置：
# MSI:  src-tauri\target\release\bundle\msi\MKPreview_1.0.0_x64_en-US.msi
# NSIS: src-tauri\target\release\bundle\nsis\MKPreview_1.0.0_x64-setup.exe
# .exe: src-tauri\target\release\MKPreview.exe
```

### 2.3 tauri.conf.json Windows 配置

```json
// src-tauri/tauri.conf.json (Windows 配置)
{
  "bundle": {
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "",
      "wix": {
        "language": "zh-CN",
        "template": null,
        "fragmentPaths": [],
        "componentGroupRefs": [],
        "componentRefs": [],
        "featureGroupRefs": [],
        "featureRefs": [],
        "mergeRefs": []
      },
      "nsis": {
        "installMode": "both",
        "startMenuFolder": "MKPreview",
        "installerIcon": "icons/icon.ico",
        "displayLanguageSelector": false,
        "languages": ["SimpChinese", "English"],
        "installRequirements": {
          "minWindowsVersion": "10.0.17763"
        }
      }
    }
  }
}
```

### 2.4 NSIS 配置详解

```json
{
  "bundle": {
    "windows": {
      "nsis": {
        // 安装模式
        // "perMachine": 仅当前机器（需要管理员权限）
        // "perUser": 仅当前用户
        // "both": 让用户选择（默认）
        "installMode": "both",

        // 开始菜单文件夹名
        "startMenuFolder": "MKPreview",

        // 安装器图标
        "installerIcon": "icons/icon.ico",

        // 是否显示语言选择器
        "displayLanguageSelector": false,

        // 支持语言
        "languages": ["SimpChinese", "English"],

        // Windows 最低版本要求
        "installRequirements": {
          "minWindowsVersion": "10.0.17763"
        }
      }
    }
  }
}
```

### 2.5 代码签名配置

```powershell
# 方式 1: 使用证书指纹
$env:TAURI_SIGNING_PRIVATE_KEY = "your-private-key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "your-key-password"
npm run tauri build

# 方式 2: 使用 Windows 证书存储中的证书
# 在 tauri.conf.json 中设置 certificateThumbprint
```

### 2.6 WebView2 Runtime 处理

Tauri 2.0 自动处理 WebView2 Runtime：

1. **运行时检测**：启动时检测系统是否已安装 WebView2
2. **自动下载安装**：未安装时自动下载并静默安装 Evergreen Bootstrapper
3. **离线安装器**：可将 WebView2 运行时嵌入安装包（增大体积约 130MB，不推荐）

```json
// 默认配置：使用 Evergreen 模式（推荐）
{
  "bundle": {
    "windows": {
      "webviewInstallMode": {
        "type": "downloadBootstrapper"
      }
    }
  }
}
```

### 2.7 Portable 版本构建

```powershell
# Portable 版本：直接运行，无需安装
# 产物为单个 .exe 文件
# 用户需自行确保 WebView2 Runtime 已安装

# Tauri 默认产物中包含 .exe，可直接作为 Portable 使用
# src-tauri\target\release\MKPreview.exe
```

### 2.8 构建脚本

```powershell
# scripts/build-windows.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== MKPreview Windows Build ===" -ForegroundColor Green

# 清理旧构建
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "src-tauri\target\release\bundle"

# 生产构建
Write-Host "Building for x64..." -ForegroundColor Yellow
npm run tauri build

Write-Host "=== Build Complete ===" -ForegroundColor Green
Write-Host "Artifacts:"
Get-ChildItem -Path "src-tauri\target\release\bundle" -Recurse | Select-Object -ExpandProperty FullName
```

### 2.9 ARM64 构建（可选）

```powershell
# Windows on ARM 构建
# 需要 ARM64 版本的 Rust target 和 Visual Studio 组件

rustup target add aarch64-pc-windows-msvc

# 构建
npm run tauri build -- --target aarch64-pc-windows-msvc

# 产物：
# src-tauri\target\aarch64-pc-windows-msvc\release\bundle\msi\MKPreview_*_aarch64.msi
```

---

## 3. 接口定义

### 3.1 构建命令接口

```powershell
# x64 构建（默认）
npm run tauri build

# ARM64 构建
npm run tauri build -- --target aarch64-pc-windows-msvc

# 带签名
$env:TAURI_SIGNING_PRIVATE_KEY = "..."
npm run tauri build
```

### 3.2 产物路径

| 构建类型 | 产物路径 |
|---------|---------|
| MSI (x64) | `src-tauri\target\release\bundle\msi\MKPreview_*_x64_en-US.msi` |
| NSIS (x64) | `src-tauri\target\release\bundle\nsis\MKPreview_*_x64-setup.exe` |
| Portable | `src-tauri\target\release\MKPreview.exe` |
| ARM64 MSI | `src-tauri\target\aarch64-pc-windows-msvc\release\bundle\msi\MKPreview_*_aarch64.msi` |

---

## 4. 数据结构

### 4.1 Windows 构建配置

```typescript
// types/build.ts
export interface WindowsBuildConfig {
  architecture: 'x64' | 'aarch64'
  outputFormats: ('msi' | 'nsis' | 'portable')[]
  signing?: {
    certificateThumbprint?: string
    privateKey?: string
    privateKeyPassword?: string
  }
  nsis?: {
    installMode: 'perMachine' | 'perUser' | 'both'
    startMenuFolder: string
    languages: string[]
  }
  webviewInstallMode: 'downloadBootstrapper' | 'embedBootstrapper' | 'offlineInstaller'
}
```

### 4.2 安装包体积预算

| 组件 | 预估体积 |
|------|---------|
| 前端构建产物 | ~2MB |
| Rust 二进制 | ~3MB |
| WebView2（运行时） | 用户机器已有，不打包 |
| 资源文件（图标等） | ~1MB |
| **总计（目标）** | **< 15MB** |

---

## 5. 依赖关系

| 依赖 | 说明 |
|------|------|
| F09-01 | Tauri 构建配置 |
| 外部 | Visual Studio Build Tools 2022 |
| 外部 | WebView2 Runtime |
| 外部 | Windows 代码签名证书（可选） |

**被依赖**：
- F09-04 CI/CD 自动构建（Windows 构建步骤）

---

## 6. 测试要点

### 6.1 构建验证

| 测试项 | 操作 | 预期 |
|--------|------|------|
| 构建成功 | `npm run tauri build` | 生成 .msi 和 .exe |
| MSI 安装 | 双击 .msi | 安装向导正常显示，安装成功 |
| NSIS 安装 | 双击 .exe | 安装向导正常显示，安装成功 |
| 静默安装 | `MKPreview-setup.exe /S` | 无界面静默安装 |
| 启动验证 | 从开始菜单启动 | 应用正常启动 |

### 6.2 WebView2 验证

| 测试项 | 场景 | 预期 |
|--------|------|------|
| 已安装 WebView2 | 正常系统 | 应用直接启动 |
| 未安装 WebView2 | 新装系统/虚拟机 | 自动下载安装 WebView2，然后启动 |

### 6.3 功能验证

- 选择目录对话框正常
- 文件树中文路径正确显示
- Markdown 渲染正常
- 主题切换正常
- 快捷键工作（Ctrl+1/2/3 等）

### 6.4 签名验证

```powershell
# 检查签名（如已配置）
Get-AuthenticodeSignature "MKPreview.exe"

# 检查文件属性中的数字签名标签页
```

### 6.5 性能测试

| 指标 | 目标 |
|------|------|
| .msi 体积 | < 15MB |
| .exe 安装包体积 | < 15MB |
| 冷启动时间 | < 2s（含 WebView2 初始化） |
| 安装时间 | < 30s |
