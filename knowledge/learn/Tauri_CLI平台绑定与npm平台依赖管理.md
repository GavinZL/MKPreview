# Tauri CLI 平台绑定与 npm 平台依赖管理

> 首次学习：2026-04-23
> 最近更新：2026-04-23
> 使用场景：Tauri 桌面应用开发 / 跨平台构建 / 团队协作
> 掌握水平：0 → 2

<!-- 更新日志 -->
<!-- [2026-04-23 21:00] 首次创建：从 MKPreview 项目构建问题中提取 -->

---

## 一句话理解（费曼版）

Tauri CLI 是一个"外壳+可选引擎"的结构：`@tauri-apps/cli` 是 JS 外壳，真正的原生二进制代码放在 `@tauri-apps/cli-darwin-arm64`、`@tauri-apps/cli-darwin-x64` 等平台特定包里。npm 会根据你的机器架构自动挑对的引擎安装，但如果你硬编码了某个平台的引擎，其他架构的机器就会报错找不到绑定。

---

## 知识框架

1. **Tauri CLI 的双层结构**（JS 包装器 + 平台原生绑定）
2. **npm optionalDependencies 机制**（平台特定包的自动选择）
3. **常见构建错误诊断**（EBADPLATFORM / Cannot find native binding）
4. **修复流程**（删除硬编码依赖 → 清理缓存 → 重新安装）
5. **macOS Universal Binary 构建**（同时支持 Intel 和 Apple Silicon）

---

## 核心概念

### 双层 CLI 结构
Tauri 的 CLI 不是单一包，而是分层的：
- **`@tauri-apps/cli`**（devDependencies）：JS 入口和命令分发器
- **`@tauri-apps/cli-darwin-arm64`**：Apple Silicon 原生二进制
- **`@tauri-apps/cli-darwin-x64`**：Intel Mac 原生二进制
- **`@tauri-apps/cli-darwin-universal`**：通用二进制（同时包含两种架构）

`@tauri-apps/cli` 的 `package.json` 中通过 `optionalDependencies` 声明了所有平台包，npm 安装时只下载匹配当前平台的那一个。

### optionalDependencies 的陷阱
如果项目的 `dependencies` 里**直接写了** `@tauri-apps/cli-darwin-x64`，npm 会把它当作**必装依赖**，不再走 optional 逻辑。结果是：
- x64 机器：正常安装
- arm64 机器：`EBADPLATFORM` 报错，安装失败

### 缓存权限问题
npm 会把下载的包缓存到 `~/.npm/_cacache`。如果这个目录被 root 用户创建过，普通用户运行 `npm install` 时会报 `EPERM`（权限拒绝）。

---

## 比喻 & 例子

**比喻：**
Tauri CLI 就像一台咖啡机。`@tauri-apps/cli` 是咖啡机外壳和按钮面板，而 `cli-darwin-arm64`、`cli-darwin-x64` 是不同电压标准的加热核心。你把机器买回家时，商家会根据你家的电压自动配对的加热核心。但如果你订单里**强行指定了"220V 核心"**，拿到 110V 地区的人就根本用不了。

**工作例子：**
MKPreview 项目的 `package.json` 曾错误地把 `@tauri-apps/cli-darwin-x64` 写进 `dependencies`，导致在 Apple Silicon Mac 上 `npm install` 直接崩溃。修复方式很简单：删除这行，让 `@tauri-apps/cli` 自己决定拉哪个平台包。

---

## 边界 & 反例

- **不要**把平台特定包（如 `cli-darwin-x64`）写进 `dependencies` 或 `devDependencies`
- **不要**手动修改 `package-lock.json` 里的平台包引用
- `npm cache clean --force` 可以清理缓存，但通常不需要频繁使用
- 如果团队中有人用 Intel Mac、有人用 Apple Silicon，**不要**提交包含特定平台锁定的 `package-lock.json`（不过实际上 npm 7+ 的 lockfile 会记录所有 optional 包，不影响安装）

---

## 常见误区

| 误区 | 正确理解 |
|------|----------|
| "`@tauri-apps/cli` 已经装了，为什么还报找不到 native binding？" | 因为真正的原生代码在平台特定子包里（如 `cli-darwin-arm64`），主包只是个外壳 |
| "我在 arm64 机器上，把 x64 的 CLI 包也装上是不是更保险？" | 不需要，而且会导致 `EBADPLATFORM` 报错。一个机器只需要匹配自己架构的包 |
| "删除 `node_modules` 就够了，不用删 `package-lock.json`" | 如果 `package.json` 里有硬编码的平台依赖，lockfile 会记住它，必须一起清理 |
| "`npm install` 报 `EPERM` 是网络问题" | 通常是 `~/.npm` 目录权限被 root 占用，用 `sudo chown -R $(whoami) ~/.npm` 修复 |

---

## 代码示例

### 错误的 package.json
```json
{
  "dependencies": {
    "@tauri-apps/cli-darwin-x64": "^2.10.1",
    "@tauri-apps/plugin-dialog": "^2.0.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0"
  }
}
```

### 正确的 package.json
```json
{
  "dependencies": {
    "@tauri-apps/plugin-dialog": "^2.0.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0"
  }
}
```

### 修复命令流程
```bash
# 1. 删除硬编码的平台依赖（编辑 package.json，移除 @tauri-apps/cli-darwin-x64 等行）

# 2. 彻底清理
rm -rf node_modules package-lock.json

# 3. 修复 npm 缓存权限（如报 EPERM）
sudo chown -R $(whoami) ~/.npm

# 4. 重新安装
npm install

# 5. 验证 Tauri CLI 可用
npx tauri --version
```

### 构建 Universal Binary
```bash
# 同时支持 Intel 和 Apple Silicon
npm run tauri:build -- --target universal-apple-darwin
```

---

## 自测题

1. **为什么 `@tauri-apps/cli` 安装后还需要平台特定的子包？**
   > 答：`@tauri-apps/cli` 是 JS 外壳，真正的 Rust 编译器和原生工具链在 `cli-darwin-arm64`、`cli-darwin-x64` 等平台子包里。npm 会根据当前机器的 `os` 和 `cpu` 自动选择对应的子包作为 optional dependency 安装。

2. **`EBADPLATFORM` 报错最常见的原因是什么？**
   > 答：`package.json` 的 `dependencies` 中硬编码了不匹配当前平台的包（如在 arm64 机器上要求安装 `cli-darwin-x64`）。修复方式是删除硬编码的平台特定依赖，让 `@tauri-apps/cli` 自动管理。

3. **`npm install` 报 `EPERM` 错误时，应该检查哪个目录的权限？**
   > 答：`~/.npm`（npm 全局缓存目录）。如果这个目录被 root 用户创建或占用，普通用户无法写入缓存，导致安装失败。修复命令：`sudo chown -R $(whoami) ~/.npm`。

---

## 延伸阅读 / 关联知识

- [Tauri Official Docs - Building for Production](https://tauri.app/v1/guides/building/)
- [npm optionalDependencies 官方文档](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#optionaldependencies)
- [Rust Cross Compilation for macOS Universal Binaries](https://developer.apple.com/documentation/apple-silicon/building-a-universal-macos-binary)
