# F09-04 CI/CD 自动构建 [Phase 3]

## 1. 功能描述与目标

**功能描述**：Phase 3 阶段实现 GitHub Actions 自动构建流水线，在推送版本标签时自动构建 macOS 和 Windows 平台的安装包，并自动创建 GitHub Release 发布。

**目标**：
- 触发条件：push tag（如 `v1.0.0`）或手动触发（workflow_dispatch）
- 构建矩阵：macOS (aarch64 + x86_64 + universal) / Windows (x64)
- 构建步骤：安装依赖 → 构建 → 上传 artifacts → 创建 Release
- 自动发布 GitHub Release，附加所有平台安装包
- 可选：Tauri Updater 配置（应用内自动更新检测）
- 构建产物命名规范，带版本号和平台标识

**PRD 关联**：NFR-002（跨平台一致性）、NFR-003（安装与分发）

---

## 2. 技术实现方案

### 2.1 GitHub Actions Workflow

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'  # 推送 v 开头的标签时触发，如 v1.0.0
  workflow_dispatch:  # 支持手动触发

jobs:
  # ========== 构建矩阵 ==========
  build:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          # macOS Apple Silicon
          - platform: 'macos-latest'
            args: '--target aarch64-apple-darwin'
            arch: 'aarch64'

          # macOS Intel
          - platform: 'macos-latest'
            args: '--target x86_64-apple-darwin'
            arch: 'x86_64'

          # macOS Universal Binary
          - platform: 'macos-latest'
            args: '--target universal-apple-darwin'
            arch: 'universal'

          # Windows x64
          - platform: 'windows-latest'
            args: ''
            arch: 'x64'

    runs-on: ${{ matrix.platform }}

    steps:
      # ---------- 检出代码 ----------
      - name: Checkout
        uses: actions/checkout@v4

      # ---------- 安装 Node.js ----------
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      # ---------- 安装 Rust ----------
      - name: Setup Rust
        uses: dtolnay/rust-action@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      # ---------- macOS 特定：安装依赖 ----------
      - name: Install macOS dependencies
        if: matrix.platform == 'macos-latest'
        run: |
          rustup target add aarch64-apple-darwin
          rustup target add x86_64-apple-darwin

      # ---------- Windows 特定：安装依赖 ----------
      - name: Install Windows dependencies
        if: matrix.platform == 'windows-latest'
        run: |
          # WebView2 和 Visual Studio 在 windows-latest  runner 上已预装
          echo "Windows dependencies ready"

      # ---------- 安装前端依赖 ----------
      - name: Install frontend dependencies
        run: npm ci

      # ---------- 安装 Tauri CLI ----------
      - name: Install Tauri CLI
        run: npm install -g @tauri-apps/cli

      # ---------- 构建 ----------
      - name: Build Tauri App
        run: npm run tauri build -- ${{ matrix.args }}
        env:
          # macOS 代码签名（可选，使用 GitHub Secrets）
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          # Windows 代码签名（可选）
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}

      # ---------- 上传构建产物 ----------
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: mkpreview-${{ matrix.platform }}-${{ matrix.arch }}
          path: |
            src-tauri/target/*/release/bundle/dmg/*.dmg
            src-tauri/target/*/release/bundle/macos/*.app
            src-tauri/target/*/release/bundle/msi/*.msi
            src-tauri/target/*/release/bundle/nsis/*.exe
          if-no-files-found: error

  # ========== 创建 GitHub Release ==========
  release:
    needs: build
    permissions:
      contents: write
    runs-on: ubuntu-latest

    steps:
      # ---------- 下载所有产物 ----------
      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: artifacts
          merge-multiple: true

      # ---------- 列出产物 ----------
      - name: List artifacts
        run: |
          echo "=== Build Artifacts ==="
          find artifacts -type f | sort

      # ---------- 创建 Release ----------
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: artifacts/**
          draft: true
          prerelease: ${{ contains(github.ref, 'alpha') || contains(github.ref, 'beta') || contains(github.ref, 'rc') }}
          generate_release_notes: true
          name: MKPreview ${{ github.ref_name }}
          body: |
            ## MKPreview ${{ github.ref_name }}

            ### 安装包

            | 平台 | 下载 |
            |------|------|
            | macOS (Apple Silicon) | `MKPreview_*_aarch64.dmg` |
            | macOS (Intel) | `MKPreview_*_x86_64.dmg` |
            | macOS (Universal) | `MKPreview_*_universal.dmg` |
            | Windows (x64) MSI | `MKPreview_*_x64_en-US.msi` |
            | Windows (x64) Installer | `MKPreview_*_x64-setup.exe` |

            ### 系统要求

            - **macOS**: macOS 10.15 或更高版本
            - **Windows**: Windows 10 (Build 17763) 或更高版本，需要 WebView2 Runtime

            ### 校验和

            ```
            # 下载后可验证 SHA256 校验和
            shasum -a 256 *.dmg
            certutil -hashfile *.msi SHA256
            ```
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 2.2 GitHub Secrets 配置

在 GitHub 仓库 Settings → Secrets and variables → Actions 中配置：

| Secret 名称 | 说明 | 必需 |
|------------|------|------|
| `APPLE_CERTIFICATE` | Apple 开发者证书（.p12 文件 base64 编码） | 可选 |
| `APPLE_CERTIFICATE_PASSWORD` | 证书密码 | 可选 |
| `APPLE_SIGNING_IDENTITY` | 签名身份 | 可选 |
| `APPLE_ID` | Apple ID（用于公证） | 可选 |
| `APPLE_PASSWORD` | Apple ID 应用专用密码 | 可选 |
| `APPLE_TEAM_ID` | Apple Developer Team ID | 可选 |
| `TAURI_SIGNING_PRIVATE_KEY` | Windows 签名私钥 | 可选 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 私钥密码 | 可选 |

### 2.3 Tauri Updater 配置（可选）

```json
// src-tauri/tauri.conf.json (Updater 配置)
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://api.github.com/repos/YOUR_ORG/mkpreview/releases/latest"
      ],
      "dialog": true,
      "pubkey": "YOUR_UPDATER_PUBLIC_KEY"
    }
  }
}
```

```yaml
# 在 GitHub Actions 中生成 updater 签名
# 需要额外步骤生成 signature 文件
- name: Generate updater signature
  if: matrix.platform == 'macos-latest'
  run: |
    # 使用 tauri-sign 生成签名
    npm install -g @tauri-apps/cli
    # 签名步骤...
```

### 2.4 构建缓存优化

```yaml
# .github/workflows/release.yml（缓存配置）

# 缓存 Rust 依赖
- name: Cache Rust
  uses: Swatinem/rust-cache@v2
  with:
    workspaces: src-tauri
    key: ${{ matrix.platform }}-${{ matrix.arch }}

# 缓存 Node.js 依赖
- name: Cache Node modules
  uses: actions/cache@v4
  with:
    path: |
      ~/.npm
      node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

### 2.5 产物命名规范

```
MKPreview_1.0.0_aarch64.dmg          # macOS Apple Silicon
MKPreview_1.0.0_x86_64.dmg           # macOS Intel
MKPreview_1.0.0_universal.dmg        # macOS Universal Binary
MKPreview_1.0.0_x64_en-US.msi        # Windows MSI Installer
MKPreview_1.0.0_x64-setup.exe        # Windows NSIS Installer
```

### 2.6 构建矩阵决策表

| 场景 | macOS aarch64 | macOS x86_64 | macOS universal | Windows x64 |
|------|--------------|-------------|----------------|-------------|
| 日常开发 | ✓ | | | |
| 内部测试 | ✓ | ✓ | | ✓ |
| 正式发布 | ✓ | ✓ | ✓（推荐） | ✓ |
| CI 时间敏感 | | | ✓ | ✓ |

---

## 3. 接口定义

### 3.1 GitHub Actions 触发器

```yaml
on:
  push:
    tags:
      - 'v*'           # v1.0.0, v1.1.0-beta.1 等
  workflow_dispatch:    # 手动触发
    inputs:
      prerelease:
        description: '是否预发布'
        required: false
        default: 'false'
        type: choice
        options:
          - 'true'
          - 'false'
```

### 3.2 构建矩阵配置

```yaml
strategy:
  fail-fast: false
  matrix:
    platform: ['macos-latest', 'windows-latest']
    include:
      - platform: 'macos-latest'
        targets: ['aarch64-apple-darwin', 'x86_64-apple-darwin', 'universal-apple-darwin']
      - platform: 'windows-latest'
        targets: ['x86_64-pc-windows-msvc']
```

---

## 4. 数据结构

### 4.1 CI/CD 配置类型

```typescript
// types/ci-cd.ts
export interface CIConfig {
  triggers: {
    tags: string[]
    manual: boolean
  }
  buildMatrix: BuildTarget[]
  signing: {
    macos?: MacOSSigningConfig
    windows?: WindowsSigningConfig
  }
  release: {
    draft: boolean
    generateNotes: boolean
    includeChecksums: boolean
  }
}

export interface BuildTarget {
  platform: 'macos-latest' | 'windows-latest' | 'ubuntu-latest'
  architecture: string
  args: string
  rustTargets: string[]
}
```

### 4.2 Release 产物清单

```typescript
export interface ReleaseAssets {
  version: string
  platforms: {
    macos: {
      aarch64?: string    // .dmg URL
      x86_64?: string     // .dmg URL
      universal?: string  // .dmg URL
    }
    windows: {
      msi?: string        // .msi URL
      nsis?: string       // .exe URL
      portable?: string   // .exe URL
    }
  }
  checksums: Record<string, string>  // filename -> sha256
}
```

---

## 5. 依赖关系

| 依赖模块 | 特性 | 说明 |
|---------|------|------|
| F09-01 | Tauri 构建配置 | 基础构建配置 |
| F09-02 | macOS 打包 | macOS 构建步骤 |
| F09-03 | Windows 打包 | Windows 构建步骤 |
| 外部 | GitHub Actions | CI/CD 平台 |
| 外部 | GitHub Secrets | 签名证书等敏感信息 |

---

## 6. 测试要点

### 6.1 CI 流水线测试

| 测试项 | 操作 | 预期 |
|--------|------|------|
| Tag 触发 | push tag v1.0.0 | Workflow 自动启动 |
| 手动触发 | 点击 Run workflow | Workflow 启动 |
| 构建成功 | 等待完成 | 所有矩阵项绿色通过 |
| 产物上传 | 构建完成 | Artifacts 中包含所有安装包 |
| Release 创建 | 构建成功 | GitHub Release 页面出现 Draft Release |

### 6.2 产物验证

| 测试项 | 操作 | 预期 |
|--------|------|------|
| macOS DMG | 下载并安装 | 正常安装到 Applications |
| Windows MSI | 下载并安装 | 安装向导正常，安装成功 |
| Windows EXE | 下载并安装 | NSIS 安装器正常 |
| 版本号 | 检查产物名 | 包含正确的版本号 |
| 签名验证 | codesign / Get-AuthenticodeSignature | 如配置了签名，验证通过 |

### 6.3 回滚策略

- Release 标记为 Draft，需要手动确认后发布
- 发现问题时可删除 Release 和 tag
- 支持热修复版本（如 v1.0.1）快速发布

### 6.4 构建时间预算

| 平台 | 预估构建时间 |
|------|------------|
| macOS aarch64 | 8-12 分钟 |
| macOS x86_64 | 8-12 分钟 |
| macOS universal | 12-18 分钟 |
| Windows x64 | 10-15 分钟 |
| **总计（并行）** | **~20 分钟** |
