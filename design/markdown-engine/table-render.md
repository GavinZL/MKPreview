# F06-04 表格渲染样式

## 1. 功能描述与目标

本特性实现 Markdown 表格的精美渲染样式，覆盖 PRD FR-004.2 的所有要求：

- 标准 Markdown 表格渲染
- 表头背景色区分（`--bg-tertiary`）
- 交替行颜色（斑马纹）
- 单元格边框（`border-collapse: collapse`）
- 支持表格内的代码、加粗等行内格式
- 宽表格水平滚动（外包 `overflow-x: auto` 容器）
- 悬浮行高亮效果

表格是知识库中**几乎每篇文档都使用**的元素，渲染质量直接影响阅读体验。

## 2. 技术实现方案

### 2.1 文件位置

```
src/assets/styles/markdown/table.css       # 表格专属样式
```

### 2.2 设计思路

- 表格默认宽度 100%，但包在一个 `overflow-x: auto` 的容器中，超宽时横向滚动
- 表头使用略深背景色区分，字体加粗
- 斑马纹使用交替行背景色（偶数行 `--bg-secondary`，奇数行透明）
- 单元格内代码、加粗等行内元素保持原有样式
- 暗色/亮色主题通过 CSS 变量自动适配

### 2.3 完整 CSS 代码

```css
/* ============================================================
   MKPreview - 表格渲染样式
   文件: src/assets/styles/markdown/table.css
   范围: .mk-body 下的 table 元素
   规范: PRD 第八节 8.6
   ============================================================ */

/* -------------------- 表格滚动容器 -------------------- */

.mk-body .table-wrapper {
  overflow-x: auto;
  margin: 1.2em 0;
  border-radius: 8px;
  border: 1px solid var(--border);
}

/* markdown-it 默认输出的 table 包装 */
.mk-body table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  line-height: 1.5;
  background: var(--bg-primary);
}

/* 确保表格不被默认容器边框重复包裹 */
.mk-body table:only-child {
  margin: 0;
}

/* -------------------- 表头样式 -------------------- */

.mk-body thead {
  background: var(--bg-tertiary);
}

.mk-body thead th {
  padding: 10px 14px;
  text-align: left;
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 2px solid var(--border);
  white-space: nowrap;
  user-select: none;
}

.mk-body thead th:first-child {
  border-top-left-radius: 8px;
}

.mk-body thead th:last-child {
  border-top-right-radius: 8px;
}

/* -------------------- 表体样式 -------------------- */

.mk-body tbody td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
  color: var(--text-primary);
}

/* 斑马纹：偶数行背景 */
.mk-body tbody tr:nth-child(even) {
  background: var(--bg-secondary);
}

/* 斑马纹：奇数行保持透明（继承父背景） */
.mk-body tbody tr:nth-child(odd) {
  background: transparent;
}

/* 悬浮行效果 */
.mk-body tbody tr:hover {
  background: color-mix(in srgb, var(--bg-secondary) 70%, var(--bg-tertiary));
}

/* 悬浮时覆盖斑马纹 */
.mk-body tbody tr:nth-child(even):hover,
.mk-body tbody tr:nth-child(odd):hover {
  background: color-mix(in srgb, var(--bg-secondary) 60%, var(--bg-tertiary));
}

/* -------------------- 对齐方式 -------------------- */

/* 支持 Markdown 表格对齐语法：:---, :---:, ---: */
.mk-body th[align="center"],
.mk-body td[align="center"] {
  text-align: center;
}

.mk-body th[align="right"],
.mk-body td[align="right"] {
  text-align: right;
}

.mk-body th[align="left"],
.mk-body td[align="left"] {
  text-align: left;
}

/* -------------------- 表格内行内元素 -------------------- */

/* 表格内代码 */
.mk-body table code {
  white-space: nowrap;
  font-size: 0.85em;
  padding: 1px 4px;
}

/* 表格内加粗 */
.mk-body table strong {
  font-weight: 600;
}

/* 表格内链接 */
.mk-body table a {
  color: var(--accent);
}

/* 表格内删除线 */
.mk-body table del {
  color: var(--text-muted);
}

/* 表格内行内公式（KaTeX） */
.mk-body table .katex {
  font-size: 0.95em;
}

/* -------------------- 窄屏适配 -------------------- */

@media (max-width: 640px) {
  .mk-body table {
    font-size: 13px;
  }

  .mk-body thead th,
  .mk-body tbody td {
    padding: 8px 10px;
  }
}

/* -------------------- 打印样式 -------------------- */

@media print {
  .mk-body table {
    border: 1px solid #ccc;
  }

  .mk-body thead th {
    background: #f0f0f0 !important;
    border-bottom: 2px solid #ccc;
  }

  .mk-body tbody tr {
    background: transparent !important;
  }

  .mk-body tbody td {
    border-bottom: 1px solid #ddd;
  }
}
```

### 2.4 markdown-it 表格对齐属性

markdown-it 默认支持 GFM 表格语法，并自动在 `th`/`td` 元素上添加 `align` 属性：

```markdown
| 左对齐 | 居中对齐 | 右对齐 |
| :----- | :------: | -----: |
| 数据   |  数据    |  数据  |
```

输出：
```html
<table>
  <thead>
    <tr><th align="left">左对齐</th><th align="center">居中对齐</th><th align="right">右对齐</th></tr>
  </thead>
  <tbody>
    <tr><td align="left">数据</td><td align="center">数据</td><td align="right">数据</td></tr>
  </tbody>
</table>
```

CSS 通过属性选择器 `[align="center"]` 等实现对齐。

### 2.5 超宽表格处理

markdown-it 渲染的表格默认无外层滚动容器。在预览组件中，通过 DOM 后处理为 table 添加滚动容器：

```typescript
// 在 MarkdownPreview.vue 的 Stage 4 后处理中
function wrapTables(container: HTMLElement): void {
  const tables = container.querySelectorAll('table');
  tables.forEach((table) => {
    // 如果已经被包裹则跳过
    if (table.parentElement?.classList.contains('table-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    table.parentNode?.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
}
```

## 3. 接口定义

### 3.1 无 JS 接口

本特性为纯 CSS，无 JavaScript 接口。但预览组件需提供 `wrapTables` 辅助函数（见 2.5）。

### 3.2 CSS 类名清单

| 类名 | 来源 | 说明 |
|------|------|------|
| `.table-wrapper` | Stage 4 后处理注入 | 横向滚动容器 |
| `table` | markdown-it 渲染输出 | 标准表格元素 |
| `thead` / `tbody` | markdown-it 渲染输出 | 表头/表体 |
| `th[align="*"]` | markdown-it 渲染输出 | 对齐方式 |

## 4. 数据结构

### 4.1 Markdown 表格语法 → HTML 映射

```markdown
| 表头 A | 表头 B | 表头 C |
| ------ | :----: | -----: |
| 单元格 | 单元格 | 单元格 |
| 单元格 | 单元格 | 单元格 |
```

```html
<div class="table-wrapper">
  <table>
    <thead>
      <tr>
        <th align="left">表头 A</th>
        <th align="center">表头 B</th>
        <th align="right">表头 C</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td align="left">单元格</td>
        <td align="center">单元格</td>
        <td align="right">单元格</td>
      </tr>
      <tr>
        <td align="left">单元格</td>
        <td align="center">单元格</td>
        <td align="right">单元格</td>
      </tr>
    </tbody>
  </table>
</div>
```

### 4.2 表格样式属性汇总

| 元素 | 属性 | 值 |
|------|------|-----|
| 容器 | overflow-x | auto |
| 容器 | border-radius | 8px |
| 容器 | border | 1px solid --border |
| table | width | 100% |
| table | border-collapse | collapse |
| thead | background | --bg-tertiary |
| th | padding | 10px 14px |
| th | font-weight | 600 |
| th | text-align | left (默认) |
| td | padding | 10px 14px |
| tr:nth-child(even) | background | --bg-secondary |
| tr:hover | background | mix(--bg-secondary, --bg-tertiary, 70%) |

## 5. 依赖关系

### 5.1 依赖的上游模块

| 模块 | 特性 | 说明 |
|------|------|------|
| F01-02 | 前端基础配置 | CSS 文件加载基础设施 |
| F06-01 | markdown-it 核心配置 | markdown-it 原生支持 GFM 表格 |
| F06-02 | 基础元素渲染样式 | 表格内 code/strong/a 等行内样式 |
| F08-01 | CSS 变量主题系统 | --bg-tertiary / --bg-secondary / --border 等 |

### 5.2 下游依赖本模块

| 模块 | 特性 | 说明 |
|------|------|------|
| F06-06 | 预览主组件 | 调用 wrapTables 为 table 添加滚动容器 |

### 5.3 无额外 npm 依赖

markdown-it 原生支持 GFM 表格语法，无需额外插件。

## 6. 测试要点

### 6.1 视觉测试

| 测试项 | 验证内容 |
|--------|---------|
| 表头样式 | 背景色 --bg-tertiary、字重 600、底部 2px 边框 |
| 斑马纹 | 偶数行 --bg-secondary、奇数行透明 |
| 悬浮效果 | 悬浮时背景色加深 |
| 单元格边框 | 底部 1px 实线 |
| 单元格 padding | 10px 14px |
| 内联代码 | 表格内 code 不自动换行 |
| 对齐方式 | 左/中/右对齐正确 |
| 超宽滚动 | 内容超出时出现横向滚动条 |
| 主题切换 | 亮/暗色下所有颜色正确 |

### 6.2 DOM 结构测试

```typescript
// tests/table-render.spec.ts
describe('表格渲染', () => {
  it('应为 table 添加 table-wrapper 容器', () => {
    const container = document.createElement('div');
    container.innerHTML = '<table><tr><td>test</td></tr></table>';
    wrapTables(container);
    expect(container.querySelector('.table-wrapper')).not.toBeNull();
    expect(container.querySelector('.table-wrapper > table')).not.toBeNull();
  });

  it('不应重复包裹已有 wrapper 的 table', () => {
    const container = document.createElement('div');
    container.innerHTML = '<div class="table-wrapper"><table><tr><td>test</td></tr></table></div>';
    wrapTables(container);
    expect(container.querySelectorAll('.table-wrapper')).toHaveLength(1);
  });
});
```

### 6.3 兼容性测试

| 测试项 | 验证 |
|--------|------|
| color-mix | 不支持时降级方案：使用 rgba() 近似值 |
| 打印预览 | 表格边框可见、无斑马纹（避免打印墨量过大） |
| 移动端 | 窄屏下字号缩小、padding 减小 |

### 6.4 性能测试

| 指标 | 目标 | 测试方法 |
|------|------|---------|
| wrapTables | < 1ms（10 个表格） | performance.now() |
| 渲染重绘 | 无大面积重绘 | 大量表格悬浮时不卡顿 |
