# Tauri macOS 签名与公证配置 — 执行手册

> 配套文档：[Tauri_macOS签名与公证配置.md](./Tauri_macOS签名与公证配置.md)
> 适用场景：Tauri 2.0 项目首次配置 macOS 签名与 Notarization
> 预估耗时：15-30 分钟（含证书创建）

---

## 前置检查清单

- [ ] 拥有 Apple Developer 账号（个人或公司）
- [ ] macOS 系统已安装 Xcode Command Line Tools
- [ ] 项目可正常执行 `npm run tauri build`

---

## 步骤 1：检查现有证书（1 分钟）

```bash
security find-identity -v -p codesigning
```

**期望输出：**
```
1) XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX "Developer ID Application: 你的名字 (TEAM_ID)"
```

**如果输出中没有 `Developer ID Application`：**
→ 跳到 **步骤 2：创建证书**

**如果已有 `Developer ID Application`：**
→ 跳到 **步骤 3：更新配置**

---

## 步骤 2：创建 Developer ID Application 证书（10 分钟）

### 2.1 生成 CSR 文件

1. 打开 **Keychain Access**（钥匙串访问）
2. 菜单栏：**钥匙串访问** → **证书助理** → **从证书颁发机构请求证书...**
3. 用户电子邮件地址：填写你的 Apple ID
4. 常用名称：随意，如 `MKPreview Developer`
5. 请求存储到：**磁盘**
6. 保存为 `CertificateSigningRequest.certSigningRequest`

### 2.2 在 Apple Developer 创建证书

1. 访问 [developer.apple.com/account](https://developer.apple.com/account)
2. **Certificates, Identifiers & Profiles** → **Certificates** → 点击 `+`
3. 选择 **Developer ID Application**（不是 Apple Development）
4. 上传步骤 2.1 生成的 CSR 文件
5. 下载生成的 `.cer` 文件
6. **双击安装**到 Keychain

### 2.3 验证安装

```bash
security find-identity -v -p codesigning
```

确认出现：`Developer ID Application: 你的名字 (TEAM_ID)`

---

## 步骤 3：更新项目配置（2 分钟）

### 3.1 修改 `src-tauri/tauri.conf.json`

找到 `bundle.macOS` 配置，更新为：

```json
"macOS": {
  "frameworks": [],
  "minimumSystemVersion": "10.15",
  "signingIdentity": "Developer ID Application: 你的名字 (TEAM_ID)",
  "dmg": {
    "windowSize": { "width": 660, "height": 440 },
    "appPosition": { "x": 180, "y": 170 },
    "applicationFolderPosition": { "x": 480, "y": 170 }
  }
}
```

> ⚠️ **注意**：
> - `signingIdentity` 必须填写完整证书名称（含团队 ID）
> - Tauri 2.0 不支持 `license` 和 `entitlementsFile` 字段
> - `"-"` 表示 ad-hoc 签名，不能用于 Notarization

### 3.2 创建 entitlements.plist（可选）

如需自定义权限，创建 `src-tauri/entitlements.plist`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <false/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
</plist>
```

---

## 步骤 4：生成 App 专用密码（2 分钟）

1. 访问 [appleid.apple.com](https://appleid.apple.com)
2. 登录 → **Sign-In and Security** → **App-Specific Passwords**
3. 点击 **Generate an app-specific password**
4. 标签填写 `Tauri Notarization`
5. 复制生成的密码（格式如 `xxxx-xxxx-xxxx-xxxx`）

---

## 步骤 5：执行构建（5-10 分钟）

在终端中执行：

```bash
# 1. 进入项目目录
cd /path/to/your/project

# 2. 设置环境变量（每行替换为实际值）
export APPLE_ID="your-apple-id@email.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"

# 3. 验证变量已设置
echo "APPLE_ID=$APPLE_ID"
echo "APPLE_TEAM_ID=$APPLE_TEAM_ID"

# 4. 执行构建
npm run tauri build -- --bundles dmg,app
```

**构建成功标志：**
```
Finished 2 bundles at:
  /path/to/project/src-tauri/target/release/bundle/macos/MKPreview.app
  /path/to/project/src-tauri/target/release/bundle/dmg/MKPreview_0.1.0_aarch64.dmg
```

---

## 步骤 6：验证签名与 Notarization（1 分钟）

### 6.1 检查签名详情

```bash
codesign -dvv /path/to/MKPreview.app
```

**期望输出：**
```
Authority=Developer ID Application: 你的名字 (TEAM_ID)
Authority=Developer ID Certification Authority
Authority=Apple Root CA
Timestamp=Apr 24, 2026 at 17:20:39
TeamIdentifier=XXXXXXXXXX
```

### 6.2 检查 Notarization 状态

```bash
spctl --assess --type execute /path/to/MKPreview.app
```

**期望输出：**
```
/path/to/MKPreview.app: accepted
```

> 如果输出 `rejected`，说明 Notarization 失败，查看构建日志中的错误信息。

---

## 故障排查速查表

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| `The binary is not signed with a valid Developer ID certificate` | ad-hoc 签名或使用了 Apple Development 证书 | 确认 `signingIdentity` 是 `Developer ID Application` 类型 |
| `The signature does not include a secure timestamp` | ad-hoc 签名 | 同上 |
| `HTTP status code: 401. Invalid credentials` | APPLE_PASSWORD 错误或不是 App 专用密码 | 在 appleid.apple.com 重新生成 App 专用密码 |
| `Additional properties are not allowed ('license', 'entitlementsFile')` | Tauri 2.0 不支持这些字段 | 从 tauri.conf.json 中删除这两个字段 |
| `signingIdentity: "-"` 仍被使用 | 配置未生效或证书未安装 | 检查 Keychain 中是否有对应证书 |

---

## 快速命令汇总

```bash
# 检查证书
security find-identity -v -p codesigning

# 验证签名
codesign -dvv /path/to/MKPreview.app

# 检查 Gatekeeper 状态
spctl --assess --type execute /path/to/MKPreview.app

# 查看 Notarization 日志（构建失败后）
xcrun notarytool log <JOB_ID> --apple-id <APPLE_ID> --password <PASSWORD> --team-id <TEAM_ID>
```

---

## 后续分发

构建完成后，`.dmg` 文件位于：
```
src-tauri/target/release/bundle/dmg/MKPreview_*.dmg
```

直接将该文件分发给用户即可，无需额外操作。
