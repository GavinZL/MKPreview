# F09-02 macOS 打包 [Phase 3]

## 1. 功能描述与目标

**功能描述**：Phase 3 阶段实现 macOS 平台的应用打包，支持 Apple Silicon (aarch64)、Intel (x86_64) 单架构构建，以及 Universal Binary（双架构合一）。生成 `.dmg` 安装包和 `.app` 应用包。

**目标**：
- 支持 Apple Silicon (aarch64) 和 Intel (x86_64) 两种架构
- 支持构建 Universal Binary（单文件同时支持两种架构）
- 生成 `.dmg` 安装包（支持拖拽安装到 Applications）
- 可选：Apple Developer Certificate 代码签名
- 可选：Apple Notarization（公证）确保 macOS  Gatekeeper 不拦截
- DMG 窗口外观配置（背景图、图标位置）
- 安装包体积目标 < 15MB

**PRD 关联**：NFR-002（跨平台一致性）、NFR-003（安装与分发）

---

## 2. 技术实现方案

### 2.1 构建前置条件

```bash
# 1. 安装 Rust（如未安装）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. 安装 Node.js（v18+）
# 推荐使用 fnm 或 nvm

# 3. 安装 Tauri CLI
npm install -g @tauri-apps/cli

# 4. 安装项目依赖
npm install

# 5. macOS 特定：安装 Xcode Command Line Tools
xcode-select --install

# 6. 添加 Rust target（构建 Universal Binary 需要）
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin
```

### 2.2 单架构构建

```bash
# 自动检测当前架构（Apple Silicon 机器上构建 aarch64，Intel 上构建 x86_64）
npm run tauri build

# 产物位置：
# Apple Silicon: src-tauri/target/release/bundle/dmg/MKPreview_1.0.0_aarch64.dmg
# Intel:         src-tauri/target/release/bundle/dmg/MKPreview_1.0.0_x86_64.dmg
```

### 2.3 Universal Binary 构建

```bash
# Universal Binary：同时包含 aarch64 和 x86_64 两种架构
# 需要在同一台机器上已安装两个 target
npm run tauri build -- --target universal-apple-darwin

# 产物位置：
# src-tauri/target/universal-apple-darwin/release/bundle/dmg/MKPreview_1.0.0_universal.dmg
```

### 2.4 DMG 外观配置

```json
// src-tauri/tauri.conf.json (macOS DMG 配置)
{
  "bundle": {
    "macOS": {
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
    }
  }
}
```

### 2.5 代码签名配置（可选）

```bash
# 方式 1: 环境变量签名
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"
npm run tauri build

# 方式 2: 使用证书文件
export APPLE_CERTIFICATE=$(cat /path/to/certificate.p12 | base64)
export APPLE_CERTIFICATE_PASSWORD="your-cert-password"
npm run tauri build
```

### 2.6 公证配置（可选）

```bash
# 在 tauri.conf.json 中配置公证
# 或使用环境变量
export APPLE_ID="your-apple-id@email.com"
export APPLE_PASSWORD="your-app-specific-password"
export APPLE_TEAM_ID="YOUR_TEAM_ID"

npm run tauri build
```

### 2.7 应用图标生成

```bash
# 准备 1024x1024 的 icon.png 放入 src-tauri/icons/
# Tauri CLI 自动生成多尺寸图标
cd src-tauri

# 图标文件清单（自动生成）
# icons/
# ├── icon.icns      (macOS 应用图标)
# ├── icon.ico       (Windows 应用图标)
# ├── 32x32.png
# ├── 128x128.png
# ├── 128x128@2x.png
# └── icon.png       (源文件 1024x1024)
```

### 2.8 Info.plist 自定义（可选）

```xml
<!-- src-tauri/Info.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDisplayName</key>
    <string>MKPreview</string>
    <key>CFBundleIdentifier</key>
    <string>com.mkpreview.app</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.developer-tools</string>
</dict>
</plist>
```

### 2.9 构建脚本

```bash
#!/bin/bash
# scripts/build-macos.sh

set -e

echo "=== MKPreview macOS Build ==="

# 清理旧构建
rm -rf src-tauri/target/release/bundle

# 构建当前架构
echo "Building for current architecture..."
npm run tauri build

# 构建 Universal Binary（如果两个 target 都已安装）
if rustup target list --installed | grep -q "x86_64-apple-darwin" && \
   rustup target list --installed | grep -q "aarch64-apple-darwin"; then
    echo "Building Universal Binary..."
    npm run tauri build -- --target universal-apple-darwin
fi

echo "=== Build Complete ==="
echo "Artifacts:"
find src-tauri/target -name "*.dmg" -o -name "*.app" | sort
```

---

## 3. 接口定义

### 3.1 构建命令接口

```bash
# 单架构（自动检测）
npm run tauri build

# 指定架构
npm run tauri build -- --target aarch64-apple-darwin
npm run tauri build -- --target x86_64-apple-darwin

# Universal Binary
npm run tauri build -- --target universal-apple-darwin

# 带签名
APPLE_SIGNING_IDENTITY="..." npm run tauri build

# 带公证
APPLE_ID="..." APPLE_PASSWORD="..." APPLE_TEAM_ID="..." npm run tauri build
```

### 3.2 产物路径

| 构建类型 | 产物路径 |
|---------|---------|
| aarch64 | `src-tauri/target/release/bundle/dmg/MKPreview_*_aarch64.dmg` |
| x86_64 | `src-tauri/target/release/bundle/dmg/MKPreview_*_x86_64.dmg` |
| universal | `src-tauri/target/universal-apple-darwin/release/bundle/dmg/MKPreview_*_universal.dmg` |
| .app | `src-tauri/target/release/bundle/macos/MKPreview.app` |

---

## 4. 数据结构

### 4.1 签名与公证环境变量

```typescript
// types/build.ts
export interface MacOSSigningConfig {
  signingIdentity?: string      // APPLE_SIGNING_IDENTITY
  certificate?: string          // APPLE_CERTIFICATE (base64)
  certificatePassword?: string  // APPLE_CERTIFICATE_PASSWORD
}

export interface MacOSNotarizationConfig {
  appleId?: string
  applePassword?: string        // App-Specific Password
  appleTeamId?: string
}
```

### 4.2 DMG 配置

```typescript
export interface DMGConfig {
  windowSize: { width: number; height: number }
  appPosition: { x: number; y: number }
  applicationFolderPosition: { x: number; y: number }
}
```

---

## 5. 依赖关系

| 依赖模块 | 特性 | 说明 |
|---------|------|------|
| F09-01 | Tauri 构建配置 | 基础构建配置 |
| 外部 | Apple Developer Account | 代码签名和公证（可选） |
| 外部 | Xcode Command Line Tools | macOS 构建必需 |

**被依赖**：
- F09-04 CI/CD 自动构建（macOS 构建步骤）

---

## 6. 测试要点

### 6.1 构建验证

| 测试项 | 命令/操作 | 预期结果 |
|--------|----------|---------|
| 构建成功 | `npm run tauri build` | 无错误，生成 .dmg 和 .app |
| 安装验证 | 双击 .dmg → 拖拽到 Applications | 应用安装成功 |
| 启动验证 | 从 Applications 启动 | 应用正常启动，无崩溃 |
| Universal Binary | `lipo -archs MKPreview.app/Contents/MacOS/MKPreview` | 输出 `x86_64 arm64` |

### 6.2 功能验证

- 加载知识库目录 → 文件树正确展示
- Markdown 渲染 → 标题/代码/表格/图片正确
- 亮色/暗色主题切换正常
- 模式切换（Preview/Source）正常
- 文件系统监控正常（外部修改文件后自动刷新）

### 6.3 签名与公证验证

```bash
# 检查签名
codesign -dv --verbose=4 MKPreview.app

# 检查公证（如启用）
spctl -a -t exec -vv MKPreview.app

# 检查架构
file MKPreview.app/Contents/MacOS/MKPreview
```

### 6.4 性能测试

| 指标 | 目标 |
|------|------|
| .dmg 体积 | < 15MB |
| 冷启动时间 | < 1.5s |
| 内存占用 | < 200MB |
