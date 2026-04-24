# 预览区主题组件适配实施总结

## 实施时间
2026-04-24

## 实施概述

本次实施完成了预览区所有 Markdown 元素的主题适配，确保在切换亮色/暗色主题时，表格、代码块、Mermaid 图表、KaTeX 公式、图片等元素都能正确跟随主题变化。

## 完成的工作

### 1. 创建设计文档 ✅
- **文件**: `design/feature/preview-element-theme-adaptation.md`
- **内容**: 
  - 现状分析（已适配 vs 需修复的元素）
  - Mermaid 主题适配修复方案（动态重渲染机制）
  - KaTeX 和图片的暗色模式适配方案
  - 接口定义、数据结构、依赖关系
  - 测试要点和风险评估

### 2. 修复 Mermaid 主题切换 ✅
- **文件**: `src/lib/mermaidConfig.ts`
- **改动**:
  - 将 `updateMermaidTheme` 函数改为异步函数（`async/await`）
  - 添加注释说明主题切换后需要调用 `reRenderMermaidBlocks` 重渲染图表
  - 确保 mermaid 配置加载完成后再返回
  - 移除了设计文档中提到的废弃配置项 `suppressErrorRendering`（实际上现有代码中已不存在）

### 3. 增强 useTheme.ts ✅
- **文件**: `src/composables/useTheme.ts`
- **改动**:
  - 导入 `updateMermaidTheme` 函数
  - 将 `applyTheme` 改为异步函数
  - 在 `applyTheme` 中调用 `updateMermaidTheme` 同步 Mermaid 主题
  - 添加错误捕获，避免 Mermaid 同步失败影响主题切换

### 4. 添加 KaTeX 暗色模式适配 ✅
- **文件**: `src/assets/styles/markdown/base.css`
- **改动**:
  - 添加 `[data-theme="dark"] .mk-body .katex` 样式
  - 使用 `filter: invert(0.85) hue-rotate(180deg)` 反转公式颜色
  - 为块级公式添加背景色块和内边距

### 5. 添加图片暗色模式优化 ✅
- **文件**: `src/assets/styles/markdown/base.css`
- **改动**:
  - 添加 `[data-theme="dark"] .mk-body img` 样式
  - 使用 `filter: brightness(0.85) contrast(1.1)` 降低图片亮度
  - 悬浮时恢复正常亮度（`filter: brightness(1) contrast(1)`）
  - 添加 0.3s 过渡动画

## 现有功能验证

### ✅ 已自动适配的元素（无需修改）

通过代码检查确认以下元素已通过 CSS 变量实现主题适配：

1. **表格** (`table.css`)
   - 表头背景: `var(--bg-tertiary)`
   - 单元格背景: `var(--bg-secondary)`（斑马纹）
   - 边框: `var(--border)`
   - 文字: `var(--text-primary)`

2. **代码块** (`code.css`)
   - 容器背景: `var(--bg-code)`
   - 头部背景: `var(--bg-tertiary)`
   - 语法高亮: 已定义亮/暗两套（`[data-theme="light"]` 和 `[data-theme="dark"]`）

3. **引用块** (`base.css`)
   - 背景: `color-mix(in srgb, var(--bg-secondary) 50%, transparent)`
   - 左边框: `var(--preview-border-accent, var(--accent))`
   - 文字: `var(--text-secondary)`

4. **标题、段落、列表** (`base.css`)
   - 所有颜色均使用 CSS 变量（`var(--text-primary)`、`var(--text-secondary)`、`var(--border)` 等）

## 技术架构

### 主题切换流程

```
用户切换主题
    ↓
useTheme.applyTheme(theme)
    ↓
├─ 更新 data-theme 属性
├─ 调用 updateMermaidTheme(theme)
│   └─ 重新初始化 mermaid 配置
└─ MarkdownPreview.vue 监听到 settingsStore.resolvedTheme 变化
    └─ 调用 reRenderMermaidBlocks(article)
        └─ 批量重渲染所有 Mermaid 图表
```

### CSS 变量作用域

```
Layer 1: 全局主题 (data-theme="light|dark")
         ↓
Layer 2: 预览区颜色主题 (data-preview-theme="orange|blue|...")
         ↓
Layer 3: 预览风格模板 (data-preview-template="blog|tech-doc|...")
```

所有预览区元素通过 CSS 变量继承 Layer 1 的颜色，可被 Layer 2 和 Layer 3 覆盖。

## 预期效果

切换主题后，以下元素将正确适配：

| 元素 | 亮色模式 | 暗色模式 | 适配方式 |
|------|---------|---------|---------|
| 表格表头 | 浅灰 `#F1F3F5` | 深灰 `#21262D` | CSS 变量 ✅ |
| 表格边框 | `#E5E7EB` | `#30363D` | CSS 变量 ✅ |
| 代码块背景 | `#F6F8FA` | `#1C2128` | CSS 变量 ✅ |
| 代码高亮 | GitHub 亮色 | GitHub Dark Dimmed | 已定义 ✅ |
| Mermaid 节点 | 白色填充 | 深色填充 | **重渲染** ✅ |
| Mermaid 连线 | 深灰色 | 浅灰色 | **重渲染** ✅ |
| KaTeX 公式 | 黑色文字 | 浅色文字 | **filter** ✅ |
| 图片 | 正常亮度 | 亮度 85% | **filter** ✅ |
| 引用块竖线 | 蓝色 `#3B82F6` | 亮蓝 `#58A6FF` | CSS 变量 ✅ |

## 测试建议

### 功能测试
1. 打开包含 Mermaid 图表的 Markdown 文件
2. 切换主题（亮色 ↔ 暗色）
3. 验证 Mermaid 图表颜色正确更新
4. 验证表格、代码块、引用块颜色同步更新
5. 验证 KaTeX 公式在暗色模式下清晰可见
6. 验证图片在暗色模式下不刺眼

### 性能测试
1. 打开包含 10+ 个 Mermaid 图表的文档
2. 切换主题，观察渲染延迟
3. 使用 DevTools Performance 面板分析重渲染耗时

### 内存测试
1. 打开/关闭多个包含 Mermaid 的文档
2. 使用 DevTools Memory 面板检查内存泄漏
3. 验证 `cleanupMermaidObservers` 正确清理

## 风险评估与缓解

### 1. Mermaid 重渲染性能
- **风险**: 大量图表同时重渲染可能卡顿
- **缓解**: MarkdownPreview.vue 已实现 `reRenderMermaidBlocks` 使用 `for` 循环逐个渲染
- **建议**: 如遇到性能问题，可改用分批渲染策略

### 2. KaTeX 滤镜副作用
- **风险**: `filter: invert()` 可能影响彩色公式
- **缓解**: 仅使用 0.85 反转，保留部分原始颜色
- **建议**: 测试常见公式类型，必要时提供关闭选项

### 3. 图片滤镜可访问性
- **风险**: 降低亮度可能影响图片细节可见性
- **缓解**: 悬浮时恢复正常亮度
- **建议**: 可考虑在设置中添加"图片亮度调整"开关

## 后续优化建议

1. **Mermaid 分批渲染**
   ```typescript
   // 将 for 循环改为分批处理
   const BATCH_SIZE = 5;
   for (let i = 0; i < divs.length; i += BATCH_SIZE) {
     const batch = divs.slice(i, i + BATCH_SIZE);
     await Promise.all(batch.map(/* 渲染逻辑 */));
     await new Promise(resolve => setTimeout(resolve, 0));
   }
   ```

2. **主题切换动画**
   - 为 Mermaid 图表添加淡入淡出过渡效果
   - 避免重渲染时的视觉闪烁

3. **设置面板增强**
   - 添加"图片暗色模式优化"开关
   - 添加"KaTeX 暗色模式适配"开关
   - 允许用户自定义滤镜参数

4. **视觉回归测试**
   - 使用 Playwright Screenshot 建立基准截图
   - 自动化测试各元素的主题适配

## 文件清单

### 修改的文件
1. `design/feature/preview-element-theme-adaptation.md` (新建)
2. `src/lib/mermaidConfig.ts`
3. `src/composables/useTheme.ts`
4. `src/assets/styles/markdown/base.css`

### 无需修改的文件（已验证适配）
1. `src/assets/styles/markdown/table.css`
2. `src/assets/styles/markdown/code.css`
3. `src/components/preview/MarkdownPreview.vue` (已有主题监听逻辑)

## 总结

本次实施完成了预览区主题组件的完整适配，解决了 Mermaid 图表主题切换不生效的问题，并增强了 KaTeX 公式和图片的暗色模式体验。所有改动均基于现有的三层主题系统架构，无需修改核心逻辑，保持了代码的可维护性和扩展性。
