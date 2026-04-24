# Mermaid 图表显示比例优化方案

## 问题描述

用户反馈 Mermaid 图表在渲染后显示过小，特别是包含多个分支的宽图表（如思维导图、复杂流程图）无法清晰展示。

### 问题截图

![Mermaid显示过小](/Users/bigo/Library/Application Support/Qoder/SharedClientCache/cache/images/44e7f589/bnjm865f-5423b21b.png)

从截图可以看到：
- 图表内容很宽（包含多个分支节点）
- 图表被压缩在较小的容器内
- 文字和节点过小，难以阅读

## 根本原因

1. **Mermaid 配置限制**：
   - `useMaxWidth: true` 强制图表使用最大宽度限制
   - 默认字号较小（12px）

2. **CSS 样式限制**：
   - `max-height: 600px` 限制了图表高度
   - 容器没有充分利用可用空间

3. **交互体验不足**：
   - 缺少横向滚动提示
   - 滚动条样式不美观

## 解决方案

### 1. Mermaid 配置优化

**文件**：`src/lib/mermaidConfig.ts`

**改动**：
```typescript
mermaid.initialize({
  // ... 其他配置
  
  // 增大默认字号，提升可读性
  fontSize: 14,
  
  // === 流程图配置 ===
  flowchart: { 
    // 不使用最大宽度限制，让图表自然扩展
    useMaxWidth: false, 
    htmlLabels: false, 
    curve: 'basis',
    // 增加节点间距
    padding: 20,
    // 增加分支间距
    diagramPadding: 20,
  },
  
  // === 其他图表类型 ===
  sequence: { useMaxWidth: false },
  class: { useMaxWidth: false },
  gantt: { useMaxWidth: false },
})
```

**效果**：
- ✅ 图表不再被强制压缩
- ✅ 字号增大，更易阅读
- ✅ 节点间距增加，布局更清晰

### 2. CSS 样式优化

**文件**：`src/assets/styles/markdown/base.css`

#### 2.1 移除高度限制

```css
.mk-body .mermaid svg {
  /* 允许 SVG 自然扩展 */
  width: 100%;
  height: auto;
  /* 移除最大高度限制 */
  /* max-height: 600px; */
  /* 保持纵横比 */
  object-fit: contain;
  /* 确保 SVG 不会被压缩 */
  min-width: min-content;
}
```

#### 2.2 增强容器滚动

```css
.mk-body .mermaid {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1.5em;
  margin: 1.2em 0;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border);
  /* 允许横向滚动，适应宽图表 */
  overflow-x: auto;
  overflow-y: hidden;
  min-height: 120px;
  /* 改善滚动体验 */
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}
```

#### 2.3 美化滚动条

```css
/* Mermaid 容器滚动条美化 */
.mk-body .mermaid::-webkit-scrollbar {
  height: 8px;
}

.mk-body .mermaid::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.mk-body .mermaid::-webkit-scrollbar-thumb {
  background: var(--border-hover);
  border-radius: 4px;
}

.mk-body .mermaid::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
```

## 预期效果

### 优化前
- ❌ 图表被压缩，文字过小
- ❌ 无法清晰查看节点内容
- ❌ 横向内容被截断

### 优化后
- ✅ 图表自然扩展，充分利用容器宽度
- ✅ 字号增大到 14px，更易阅读
- ✅ 支持横向滚动查看完整图表
- ✅ 滚动条美化，交互体验更好
- ✅ 节点间距增加，布局更清晰

## 使用建议

### 1. 查看宽图表
用户可以通过以下方式查看完整的宽图表：
- **横向滚动**：在图表容器内左右滚动
- **缩放浏览器**：使用 `Cmd/Ctrl + -` 缩小页面
- **全屏查看**：考虑后续添加全屏查看功能

### 2. 编写 Mermaid 代码的建议
对于特别宽的图表，可以考虑：
- **分层展示**：将复杂图表拆分为多个子图
- **使用子图**：通过 `subgraph` 组织相关节点
- **调整布局方向**：某些图表类型支持 `LR`（左到右）或 `TB`（上到下）布局

### 3. 示例：优化布局方向

```mermaid
%% 垂直布局（默认）
graph TD
    A --> B
    B --> C

%% 水平布局（适合宽图表）
graph LR
    A --> B
    B --> C
```

## 后续优化建议

### 1. 全屏查看功能
添加双击或右键菜单，支持全屏查看 Mermaid 图表：
```typescript
function enableFullscreenMermaid(svg: SVGElement) {
  if (svg.requestFullscreen) {
    svg.requestFullscreen()
  }
}
```

### 2. 缩放控制
添加缩放按钮，允许用户放大/缩小图表：
```typescript
function zoomMermaid(svg: SVGElement, scale: number) {
  svg.style.transform = `scale(${scale})`
  svg.style.transformOrigin = 'center center'
}
```

### 3. 自适应检测
使用 JavaScript 检测图表是否溢出，并显示滚动提示：
```typescript
function checkMermaidOverflow(container: HTMLElement) {
  const hasOverflow = container.scrollWidth > container.clientWidth
  container.classList.toggle('has-overflow', hasOverflow)
}
```

### 4. 导出功能
允许用户导出 Mermaid 图表为 PNG/SVG：
```typescript
function exportMermaidAsPNG(svg: SVGElement) {
  // 实现导出逻辑
}
```

## 技术细节

### 为什么使用 `useMaxWidth: false`？

Mermaid 的 `useMaxWidth` 配置控制图表是否限制在容器宽度内：
- `true`（默认）：图表会被压缩以适应容器
- `false`（优化后）：图表自然扩展，容器提供滚动

对于宽图表，`false` 能更好地保持图表的可读性。

### 为什么移除 `max-height`？

原来的 `max-height: 600px` 会导致：
- 宽图表的高度被强制限制
- 节点和文字被压缩变形
- 失去纵横比

移除后，图表可以自然展示其真实比例。

### `min-width: min-content` 的作用

确保 SVG 元素不会被压缩到比其内容更小的尺寸，保持图表的完整性。

## 测试验证

### 测试用例

1. **窄图表**（少节点）
   - 预期：居中显示，无滚动条
   
2. **宽图表**（多分支）
   - 预期：可横向滚动，文字清晰
   
3. **高图表**（深层级）
   - 预期：纵向完整展示，无截断
   
4. **复杂图表**（宽+高）
   - 预期：双向滚动，布局清晰

### 性能考虑

- 超大图表（100+ 节点）可能需要更多渲染时间
- 横向滚动不会影响渲染性能
- 建议在图表定义中添加注释，说明复杂图表的查看方式

## 总结

通过以下三个方面的优化，显著改善了 Mermaid 图表的显示比例：

1. **配置优化**：移除宽度限制，增大字号和间距
2. **样式优化**：移除高度限制，增强滚动体验
3. **交互优化**：美化滚动条，提升可用性

这些改动不会影响已有的主题适配功能，且完全兼容现有的三层主题系统架构。
