# Tauri macOS 签名与公证配置

> 首次学习：2026-04-24
> 最近更新：2026-04-24
> 使用场景：Tauri 2.0 桌面应用 macOS 打包分发
> 掌握水平：0 → 2

<!-- 更新日志 -->
<!-- [2026-04-24] 首次创建：涵盖 Developer ID 证书、Notarization 流程、常见错误 -->

---

## 一句话理解（费曼版）

macOS 应用想要在其他电脑上安装运行，必须用 Apple 的「Developer ID Application」证书签名，再经过 Apple 的 Notarization 公证流程，否则 Gatekeeper 会直接拦截并提示"已损坏"。

---

## 知识框架

1. **证书类型与选择**
2. **Tauri 签名配置**
3. **Notarization 公证流程**
4. **环境变量与构建命令**
5. **常见错误排查**

---

## 核心概念

### Apple Development 证书
仅用于本地开发和测试签名，**不能用于 Notarization 和分发**。

### Developer ID Application 证书
用于对外分发的 macOS 应用签名，**必须通过 Notarization 才能被其他 Mac 用户安装**。

### ad-hoc 签名（`signingIdentity: "-"`）
Tauri 中使用 `"-"` 表示临时签名，等同于没有真正的开发者证书，Gatekeeper 会拦截。

### Notarization（公证）
Apple 的云端安全扫描服务，上传应用后 Apple 会检查是否包含恶意代码。通过后会返回一个 "ticket"，应用启动时会联网验证。

---

## 比喻 & 例子

**比喻：**
- 证书签名 = 给应用盖一个「Apple 认可」的公章
- Notarization = 把应用送到 Apple 安检门过一遍扫描
- ad-hoc 签名 = 自己画的假公章，安检门一眼识破

**工作例子：**
把 .dmg 发给同事 → 同事安装时 macOS Gatekeeper 会检查：
1. 这个应用谁签的名？→ 必须 Developer ID Application
2. 有没有 Apple 的安检记录？→ 必须 Notarization 通过

---

## 边界 & 反例

- **Apple Development 签名** → 只能在本机或受信任的开发设备运行，不能分发
- **ad-hoc 签名** → 分发后所有用户都会看到 "已损坏" 警告
- **Developer ID 签名但未 Notarization** → macOS 10.15+ 仍会拦截

---

## 常见误区

| 误区 | 正确理解 |
|------|----------|
| `signingIdentity: "-"` 可以 Notarization | `"-"` 是 ad-hoc 签名，Notarization 明确拒绝 |
| `Apple Development` 证书可以分发 | 只能开发调试，分发必须用 `Developer ID Application` |
| tauri.conf.json 可以写 `license` 和 `entitlementsFile` | Tauri 2.0 不支持这两个字段，直接报错 |
| `.bash_profile` 设置环境变量就够了 | 必须通过 `export` 在**构建终端**中显式设置 |
| 密码用 Apple ID 登录密码 | 必须用 `appleid.apple.com` 生成的 App 专用密码 |

---

## 完整配置流程

### 步骤 1：检查现有证书

```bash
security find-identity -v -p codesigning
```

必须有 `Developer ID Application` 类型，否则需要创建。

### 步骤 2：创建 Developer ID Application 证书（如缺失）

1. **Keychain Access** → 证书助理 → 从证书颁发机构请求证书
2. 保存 CSR 文件
3. [Apple Developer](https://developer.apple.com/account) → Certificates → `+` → **Developer ID Application**
4. 上传 CSR，下载 `.cer` 文件，双击安装

### 步骤 3：更新 `tauri.conf.json`

```json
"bundle": {
  "macOS": {
    "signingIdentity": "Developer ID Application: 你的名字 (TEAM_ID)"
  }
}
```

### 步骤 4：设置环境变量并构建

```bash
export APPLE_ID="your@apple.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # App 专用密码
export APPLE_TEAM_ID="XXXXXXXXXX"

cd /path/to/project
npm run tauri build -- --bundles dmg,app
```

### 步骤 5：验证签名结果

```bash
# 查看签名详情
codesign -dvv /path/to/MKPreview.app

# 检查 Gatekeeper 状态
spctl --assess --type execute /path/to/MKPreview.app
```

---

## 代码示例

### tauri.conf.json 关键配置

```json
{
  "bundle": {
    "targets": ["dmg", "app"],
    "macOS": {
      "minimumSystemVersion": "10.15",
      "signingIdentity": "Developer ID Application: li Gavin (893973NXS8)",
      "dmg": {
        "windowSize": { "width": 660, "height": 440 },
        "appPosition": { "x": 180, "y": 170 },
        "applicationFolderPosition": { "x": 480, "y": 170 }
      }
    }
  }
}
```

---

## 自测题

1. **`signingIdentity: "-"` 是什么类型的签名？**
   > 答：ad-hoc 临时签名，没有使用真正的 Apple 开发者证书，不能用于 Notarization 和分发。

2. **Apple Development 和 Developer ID Application 证书有什么区别？**
   > 答：Apple Development 仅用于本地开发调试；Developer ID Application 用于对外分发的 macOS 应用，必须通过 Notarization。

3. **Notarization 失败提示 "Invalid credentials" 是什么原因？**
   > 答：APPLE_PASSWORD 必须使用 appleid.apple.com 生成的 App 专用密码，不能用 Apple ID 登录密码。

---

## 延伸阅读 / 关联知识

- [Apple 官方 - Notarizing macOS Software](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Tauri 官方 - macOS 签名配置](https://tauri.app/distribute/sign/macos/)
- 关联：Tauri macOS 打包白屏问题诊断与修复
