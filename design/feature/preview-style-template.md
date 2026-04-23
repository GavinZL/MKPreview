# F09-02 预览风格模板系统 [Phase 2]

## 1. 功能描述与目标

**功能描述**：为 Markdown 预览区域提供多种排版风格模板，适配不同内容类型的阅读体验需求。模板系统与颜色主题系统（F09-01）正交组合，用户可同时选择任意配色 + 任意排版风格。

**目标**：
- 提供 4 种内置风格模板：默认标准、博客文章、技术文档、学术论文、极简风格。
- 每种模板在容器宽度、字体组合、标题装饰、段落间距、代码块呈现、图片排版等方面有显著差异。
- 通过 `data-preview-template` 属性切换，所有样式限制在 `.mk-body` 容器内。
- 与 `data-preview-theme`（颜色）和 `data-theme`（全局亮/暗）三层叠加，互不干扰。
- 模板切换带有 300ms 过渡动画。

**PRD 关联**：FR-007.4（字体系统）、F06-02 基础元素渲染样式

---

## 2. 技术实现方案

### 2.1 核心架构

风格模板作用于 `.mk-body` 容器层级，通过 CSS 属性选择器覆盖基础样式：

```
.markdown-preview                    ← data-preview-theme 作用层
  └── article.mk-body               ← data-preview-template 作用层
        └── h1, p, pre, table...    ← 具体元素样式
```

```css
/* 基础样式（默认模板） */
.mk-body {
  max-width: 860px;
  margin: 0 auto;
  padding: 40px 48px;
  font-size: 16px;
  line-height: 1.8;
}

/* 博客模板覆盖 */
.mk-body[data-preview-template="blog"] {
  max-width: 720px;
  padding: 48px 32px;
  font-size: 17px;
  line-height: 1.9;
}

.mk-body[data-preview-template="blog"] h1 {
  font-size: 2.4em;
  text-align: center;
  border-bottom: none;
}
```

### 2.2 文件结构

```
src/assets/styles/
└── preview-templates/
    ├── _vars.css              # 模板变量基础设施
    ├── default.css            # 默认模板（当前 base.css 的基准）
    ├── blog.css               # 博客文章风格
    ├── tech-doc.css           # 技术文档风格
    ├── academic.css           # 学术论文风格
    ├── minimalist.css         # 极简风格
    └── index.css              # 统一入口（按顺序导入）
```

### 2.3 CSS 设计原则

1. **模板隔离**：每个模板只覆盖与默认不同的属性，不重复定义公共样式。
2. **变量复用**：继续使用 `--preview-*` 和全局 `--text-*` / `--bg-*` 变量，确保与颜色主题兼容。
3. **响应式保留**：所有模板继承 `@media` 查询的响应式规则。
4. **打印样式**：每个模板提供独立的 `@media print` 规则。

### 2.4 各模板详细定义

#### 2.4.1 default - 默认标准

当前 `base.css` 的样式作为默认模板，无需额外覆盖。

```css
/* preview-templates/default.css */
/* 空文件或仅注释，所有样式继承 base.css */
```

**特征**：
- 容器宽度：860px
- 正文字号：16px / 行高 1.8
- 标题：H1 底部边框、H2 左侧红色竖线
- 字体：衬线体（Noto Serif SC）
- 适合：通用 Markdown 阅读

---

#### 2.4.2 blog - 博客文章

```css
/* preview-templates/blog.css */

.mk-body[data-preview-template="blog"] {
  max-width: 720px;
  padding: 48px 32px;
  font-size: 17px;
  line-height: 1.9;
  font-family: var(--font-body);
}

/* 标题居中，更强调层次感 */
.mk-body[data-preview-template="blog"] h1 {
  font-size: 2.4em;
  font-weight: 700;
  text-align: center;
  border-bottom: none;
  margin: 1.5em 0 0.8em;
  padding-bottom: 0;
}

.mk-body[data-preview-template="blog"] h1:first-child {
  margin-top: 0;
}

/* H1 下方增加副标题装饰线 */
.mk-body[data-preview-template="blog"] h1::after {
  content: '';
  display: block;
  width: 60px;
  height: 3px;
  background: var(--preview-accent, var(--accent));
  margin: 0.6em auto 0;
  border-radius: 2px;
}

.mk-body[data-preview-template="blog"] h2 {
  font-size: 1.6em;
  font-weight: 600;
  margin: 2.2em 0 0.8em;
  padding-left: 0;
  border-left: none;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.3em;
}

.mk-body[data-preview-template="blog"] h3 {
  font-size: 1.3em;
  font-weight: 600;
  margin: 1.8em 0 0.6em;
  color: var(--text-secondary);
}

.mk-body[data-preview-template="blog"] h4 {
  font-size: 1.1em;
  font-weight: 600;
  color: var(--text-muted);
}

/* 段落更宽松 */
.mk-body[data-preview-template="blog"] p {
  margin-bottom: 1.6em;
  text-align: justify;
}

/* 首字下沉（首段） */
.mk-body[data-preview-template="blog"] > p:first-of-type::first-letter {
  font-size: 3em;
  float: left;
  line-height: 0.8;
  margin-right: 0.1em;
  font-weight: 700;
  color: var(--preview-accent, var(--accent));
}

/* 图片更突出：全宽、无边框阴影 */
.mk-body[data-preview-template="blog"] img {
  border-radius: 8px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  margin: 2em auto;
}

.mk-body[data-preview-template="blog"] img:hover {
  transform: scale(1.01);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

/* 引用块更文艺 */
.mk-body[data-preview-template="blog"] blockquote {
  border-left: none;
  border-top: 2px solid var(--preview-border-accent, var(--accent));
  border-bottom: 2px solid var(--preview-border-accent, var(--accent));
  background: transparent;
  padding: 1.2em 1.5em;
  margin: 2em 0;
  text-align: center;
  font-style: italic;
  font-size: 1.05em;
}

/* 代码块更紧凑的圆角 */
.mk-body[data-preview-template="blog"] .code-block-wrapper {
  border-radius: 10px;
  margin: 1.5em 0;
}

/* 分隔线装饰 */
.mk-body[data-preview-template="blog"] hr {
  height: 1px;
  background: linear-gradient(
    to right,
    transparent,
    var(--border),
    transparent
  );
  margin: 2.5em 0;
}

/* 打印样式 */
@media print {
  .mk-body[data-preview-template="blog"] {
    max-width: none;
    padding: 0;
  }
  .mk-body[data-preview-template="blog"] h1::after {
    display: none;
  }
  .mk-body[data-preview-template="blog"] > p:first-of-type::first-letter {
    font-size: inherit;
    float: none;
    margin: 0;
  }
}
```

**特征**：
- 容器宽度：720px（更窄，适合长文阅读）
- 正文字号：17px / 行高 1.9（更宽松）
- 标题：H1 居中无下划线 + 装饰短线、H2 底边框替代左侧竖线
- 首字下沉效果（首段）
- 引用块：上下边框 + 居中斜体，无左侧竖线
- 图片：更大的阴影，更圆角
- 适合：个人博客、散文、 newsletter

---

#### 2.4.3 tech-doc - 技术文档

```css
/* preview-templates/tech-doc.css */

.mk-body[data-preview-template="tech-doc"] {
  max-width: 900px;
  padding: 32px 40px;
  font-size: 15px;
  line-height: 1.7;
  font-family: var(--font-ui);  /* 无衬线体 */
}

/* 标题更紧凑 */
.mk-body[data-preview-template="tech-doc"] h1 {
  font-size: 2em;
  font-weight: 700;
  margin: 1.5em 0 0.6em;
  padding-bottom: 0.3em;
  border-bottom: 2px solid var(--border);
}

.mk-body[data-preview-template="tech-doc"] h2 {
  font-size: 1.5em;
  font-weight: 600;
  margin: 1.8em 0 0.6em;
  padding-left: 0;
  border-left: none;
  color: var(--text-primary);
}

/* H2 前增加章节编号感 */
.mk-body[data-preview-template="tech-doc"] h2::before {
  content: '#';
  margin-right: 0.4em;
  color: var(--preview-accent, var(--accent));
  font-weight: 400;
  opacity: 0.6;
}

.mk-body[data-preview-template="tech-doc"] h3 {
  font-size: 1.2em;
  font-weight: 600;
  margin: 1.5em 0 0.5em;
  color: var(--text-secondary);
}

.mk-body[data-preview-template="tech-doc"] h4 {
  font-size: 1.05em;
  font-weight: 600;
  color: var(--text-muted);
  margin: 1.2em 0 0.4em;
}

/* 段落紧凑 */
.mk-body[data-preview-template="tech-doc"] p {
  margin-bottom: 0.8em;
}

/* 代码块更突出 */
.mk-body[data-preview-template="tech-doc"] .code-block-wrapper {
  border-radius: 6px;
  border: 1px solid var(--border);
  margin: 1em 0;
}

.mk-body[data-preview-template="tech-doc"] code {
  font-size: 0.85em;
  padding: 1px 4px;
}

/* 表格更紧凑 */
.mk-body[data-preview-template="tech-doc"] table {
  font-size: 0.9em;
}

.mk-body[data-preview-template="tech-doc"] thead th,
.mk-body[data-preview-template="tech-doc"] tbody td {
  padding: 8px 12px;
}

/* 列表紧凑 */
.mk-body[data-preview-template="tech-doc"] li {
  margin-bottom: 0.2em;
}

/* 提示块/警告块风格（引用块） */
.mk-body[data-preview-template="tech-doc"] blockquote {
  border-left: 4px solid var(--preview-accent, var(--accent));
  background: var(--bg-secondary);
  border-radius: 0 6px 6px 0;
  padding: 0.8em 1em;
  margin: 1em 0;
  font-size: 0.95em;
}

/* 图片无阴影，更克制 */
.mk-body[data-preview-template="tech-doc"] img {
  border-radius: 4px;
  box-shadow: none;
  border: 1px solid var(--border);
  margin: 1em 0;
}

.mk-body[data-preview-template="tech-doc"] img:hover {
  transform: none;
}

/* 打印 */
@media print {
  .mk-body[data-preview-template="tech-doc"] {
    max-width: none;
    padding: 0;
  }
}
```

**特征**：
- 容器宽度：900px（更宽，信息密度高）
- 正文字号：15px / 行高 1.7（紧凑）
- 字体：无衬线体（系统 UI 字体）
- 标题：H2 前加 `#` 符号（类似文档章节标记）
- 代码块：更紧凑、带边框
- 图片：无阴影、带细边框
- 列表/表格：紧凑间距
- 适合：API 文档、README、开发者文档

---

#### 2.4.4 academic - 学术论文

```css
/* preview-templates/academic.css */

.mk-body[data-preview-template="academic"] {
  max-width: 800px;
  padding: 48px 56px;
  font-size: 16px;
  line-height: 1.9;
  font-family: 'Times New Roman', 'Noto Serif SC', Georgia, serif;
  color: #000;  /* 打印友好 */
}

/* 暗色模式下恢复 */
[data-theme="dark"] .mk-body[data-preview-template="academic"] {
  color: var(--text-primary);
}

/* H1 居中，论文标题风格 */
.mk-body[data-preview-template="academic"] h1 {
  font-size: 1.8em;
  font-weight: 700;
  text-align: center;
  border-bottom: none;
  margin: 0 0 1.5em;
  padding-bottom: 0;
}

/* H1 后的元信息区域（如果有） */
.mk-body[data-preview-template="academic"] h1 + p {
  text-align: center;
  font-size: 0.95em;
  color: var(--text-secondary);
  margin-bottom: 2em;
}

/* H2 编号风格 */
.mk-body[data-preview-template="academic"] h2 {
  font-size: 1.4em;
  font-weight: 700;
  margin: 2em 0 0.8em;
  padding-left: 0;
  border-left: none;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.2em;
  counter-increment: h2-counter;
}

.mk-body[data-preview-template="academic"] h2::before {
  content: counter(h2-counter) '. ';
  color: var(--text-primary);
}

.mk-body[data-preview-template="academic"] {
  counter-reset: h2-counter;
}

.mk-body[data-preview-template="academic"] h3 {
  font-size: 1.15em;
  font-weight: 600;
  font-style: italic;
  margin: 1.5em 0 0.5em;
}

.mk-body[data-preview-template="academic"] h4 {
  font-size: 1em;
  font-weight: 600;
  margin: 1.2em 0 0.4em;
}

/* 段落首行缩进 */
.mk-body[data-preview-template="academic"] p {
  margin-bottom: 0.8em;
  text-indent: 2em;
}

.mk-body[data-preview-template="academic"] p:first-of-type {
  text-indent: 0;
}

/* 无缩进的段落（列表内、引用块内） */
.mk-body[data-preview-template="academic"] li p,
.mk-body[data-preview-template="academic"] blockquote p {
  text-indent: 0;
}

/* 引用块：学术引用风格 */
.mk-body[data-preview-template="academic"] blockquote {
  border-left: none;
  background: transparent;
  padding: 0 2em;
  margin: 1.2em 0;
  font-size: 0.95em;
  color: var(--text-secondary);
}

.mk-body[data-preview-template="academic"] blockquote p {
  margin-bottom: 0.4em;
}

/* 代码块使用更小的字号，类似论文中的等宽字体 */
.mk-body[data-preview-template="academic"] .code-block-wrapper {
  border-radius: 0;
  border: 1px solid var(--border);
  margin: 1em 0;
}

.mk-body[data-preview-template="academic"] pre {
  background: var(--bg-secondary);
  border-radius: 0;
}

/* 表格：三线表风格 */
.mk-body[data-preview-template="academic"] table {
  border-collapse: collapse;
  margin: 1.2em 0;
  font-size: 0.9em;
}

.mk-body[data-preview-template="academic"] thead {
  border-top: 2px solid var(--text-primary);
  border-bottom: 1px solid var(--text-primary);
}

.mk-body[data-preview-template="academic"] tbody {
  border-bottom: 2px solid var(--text-primary);
}

.mk-body[data-preview-template="academic"] thead th {
  background: transparent;
  border: none;
  padding: 8px 16px;
  font-weight: 600;
}

.mk-body[data-preview-template="academic"] tbody td {
  border: none;
  padding: 6px 16px;
}

.mk-body[data-preview-template="academic"] tbody tr:nth-child(even) {
  background: transparent;
}

/* 图片带编号感 */
.mk-body[data-preview-template="academic"] .image-wrapper {
  margin: 1.5em 0;
}

.mk-body[data-preview-template="academic"] .image-caption {
  font-size: 0.85em;
  text-align: center;
  color: var(--text-secondary);
  margin-top: 0.5em;
}

/* 分隔线 */
.mk-body[data-preview-template="academic"] hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 2em 5em;
}

/* 打印优化 */
@media print {
  .mk-body[data-preview-template="academic"] {
    max-width: none;
    padding: 0;
    color: #000;
    font-size: 12pt;
    line-height: 1.6;
  }
}
```

**特征**：
- 容器宽度：800px
- 字体：Times New Roman + 衬线体
- H1 居中（论文标题）、H2 自动编号（1. 2. 3.）
- 段落首行缩进 2em
- 引用块：无竖线，左右缩进（学术引用格式）
- 表格：三线表（顶部粗线、表头底线、底部粗线）
- 代码块：直角边框，更学术感
- 适合：论文、学位论文、学术报告

---

#### 2.4.5 minimalist - 极简风格

```css
/* preview-templates/minimalist.css */

.mk-body[data-preview-template="minimalist"] {
  max-width: 680px;
  padding: 64px 40px;
  font-size: 16px;
  line-height: 2.0;
  font-family: var(--font-body);
}

/* 标题极度简化 */
.mk-body[data-preview-template="minimalist"] h1 {
  font-size: 1.8em;
  font-weight: 400;
  margin: 2em 0 1em;
  padding-bottom: 0;
  border-bottom: none;
  letter-spacing: 0.05em;
}

.mk-body[data-preview-template="minimalist"] h2 {
  font-size: 1.3em;
  font-weight: 400;
  margin: 2.5em 0 0.8em;
  padding-left: 0;
  border-left: none;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
}

.mk-body[data-preview-template="minimalist"] h3 {
  font-size: 1.1em;
  font-weight: 600;
  margin: 2em 0 0.6em;
  color: var(--text-muted);
}

.mk-body[data-preview-template="minimalist"] h4,
.mk-body[data-preview-template="minimalist"] h5,
.mk-body[data-preview-template="minimalist"] h6 {
  font-size: 1em;
  font-weight: 600;
  color: var(--text-muted);
  margin: 1.5em 0 0.4em;
}

/* 段落大量留白 */
.mk-body[data-preview-template="minimalist"] p {
  margin-bottom: 2em;
}

/* 行内代码极简 */
.mk-body[data-preview-template="minimalist"] code {
  background: transparent;
  padding: 0;
  color: var(--preview-accent, var(--accent));
  font-weight: 500;
}

/* 代码块去除装饰 */
.mk-body[data-preview-template="minimalist"] .code-block-wrapper {
  border-radius: 0;
  border: none;
  border-left: 2px solid var(--border);
  margin: 2em 0;
}

.mk-body[data-preview-template="minimalist"] .code-header {
  display: none;
}

.mk-body[data-preview-template="minimalist"] pre {
  background: transparent;
  border-radius: 0;
  padding: 1em 1.5em;
}

/* 引用块极简 */
.mk-body[data-preview-template="minimalist"] blockquote {
  border-left: 2px solid var(--border);
  background: transparent;
  border-radius: 0;
  padding: 0.5em 1.2em;
  margin: 2em 0;
  color: var(--text-secondary);
}

/* 图片无装饰 */
.mk-body[data-preview-template="minimalist"] img {
  border-radius: 0;
  box-shadow: none;
  margin: 2em auto;
}

.mk-body[data-preview-template="minimalist"] img:hover {
  transform: none;
}

/* 分隔线极简 */
.mk-body[data-preview-template="minimalist"] hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 3em 0;
}

/* 列表极简 */
.mk-body[data-preview-template="minimalist"] ul,
.mk-body[data-preview-template="minimalist"] ol {
  margin-left: 1em;
  padding-left: 1em;
}

/* 表格极简 */
.mk-body[data-preview-template="minimalist"] table {
  border-collapse: collapse;
}

.mk-body[data-preview-template="minimalist"] thead th {
  border-bottom: 2px solid var(--text-primary);
  background: transparent;
}

.mk-body[data-preview-template="minimalist"] tbody td {
  border-bottom: 1px solid var(--border);
}

.mk-body[data-preview-template="minimalist"] tbody tr:nth-child(even) {
  background: transparent;
}

/* 打印 */
@media print {
  .mk-body[data-preview-template="minimalist"] {
    max-width: none;
    padding: 0;
  }
}
```

**特征**：
- 容器宽度：680px（最窄，大量留白）
- 行高：2.0（最宽松）
- 标题：细字重、去装饰、大写间距
- 代码块：无圆角、无标题栏、左侧细线
- 行内代码：无背景、仅变色
- 图片：无圆角、无阴影
- 分隔线：超长 margin（3em）
- 适合：诗歌、散文、极简主义者、日记

### 2.5 入口文件与加载方式

```css
/* preview-templates/index.css */

@import './default.css';
@import './blog.css';
@import './tech-doc.css';
@import './academic.css';
@import './minimalist.css';
```

在 `MarkdownPreview.vue` 中引入：

```typescript
import '@/assets/styles/preview-templates/index.css'
```

---

## 3. 接口定义

### 3.1 模板类型定义

```typescript
// types/previewTemplate.ts

/** 预览风格模板 ID */
export type PreviewTemplateId =
  | 'default'
  | 'blog'
  | 'tech-doc'
  | 'academic'
  | 'minimalist'

/** 预览模板元数据 */
export interface PreviewTemplate {
  id: PreviewTemplateId
  name: string
  description: string
}
```

### 3.2 模板注册表

```typescript
// lib/previewTemplates.ts

import type { PreviewTemplate } from '@/types/previewTemplate'

export const previewTemplates: PreviewTemplate[] = [
  {
    id: 'default',
    name: '默认标准',
    description: '通用 Markdown 阅读样式，平衡的信息密度与阅读舒适度',
  },
  {
    id: 'blog',
    name: '博客文章',
    description: '适合长文阅读，宽松行距，首字下沉，图片突出',
  },
  {
    id: 'tech-doc',
    name: '技术文档',
    description: '信息密度高，无衬线字体，紧凑排版，适合 API 文档',
  },
  {
    id: 'academic',
    name: '学术论文',
    description: '衬线字体，标题自动编号，首行缩进，三线表',
  },
  {
    id: 'minimalist',
    name: '极简风格',
    description: '大量留白，去除多余装饰，专注内容本身',
  },
]
```

### 3.3 usePreviewTemplate Composable

```typescript
// composables/usePreviewTemplate.ts

import { computed, watch } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import type { PreviewTemplateId } from '@/types/previewTemplate'

export function usePreviewTemplate() {
  const settingsStore = useSettingsStore()
  const currentTemplate = computed<PreviewTemplateId>(() =>
    settingsStore.previewTemplate as PreviewTemplateId
  )

  function applyTemplate(templateId: PreviewTemplateId) {
    document.querySelectorAll('.mk-body').forEach((el) => {
      el.setAttribute('data-preview-template', templateId)
    })
  }

  function setTemplate(templateId: PreviewTemplateId) {
    settingsStore.setPreviewTemplate(templateId)
    applyTemplate(templateId)
  }

  watch(currentTemplate, (id) => { applyTemplate(id) }, { immediate: true })

  return {
    currentTemplate,
    setTemplate,
    applyTemplate,
  }
}
```

### 3.4 MarkdownPreview.vue 集成

```vue
<!-- src/components/preview/MarkdownPreview.vue -->
<template>
  <div ref="previewRef" class="markdown-preview">
    <article
      ref="articleRef"
      class="mk-body"
      :data-preview-template="previewTemplate"
      :data-preview-theme="previewTheme"
      v-html="renderedHtml"
    />
  </div>
</template>

<script setup lang="ts">
import { usePreviewTheme } from '@/composables/usePreviewTheme'
import { usePreviewTemplate } from '@/composables/usePreviewTemplate'

const { currentTheme: previewTheme } = usePreviewTheme()
const { currentTemplate: previewTemplate } = usePreviewTemplate()
</script>
```

---

## 4. SettingsStore 扩展

```typescript
// stores/settingsStore.ts 扩展

// State 新增
const previewTemplate = ref<string>('default')

// Actions 新增
function setPreviewTemplate(id: string) {
  previewTemplate.value = id
}

// toSettingsObject / applySettings 中同步 previewTemplate 字段
```

---

## 5. 依赖关系

| 依赖模块 | 特性 | 说明 |
|---------|------|------|
| F06-02 | 基础元素渲染样式 | .mk-body 基础样式作为 default 模板基准 |
| F06-06 | 预览主组件 | MarkdownPreview.vue 绑定 data-preview-template |
| F08-01 | CSS 变量主题系统 | 模板使用 --text-* / --bg-* 变量适配亮/暗 |
| F09-01 | 预览区颜色主题 | 与模板正交叠加，共享 --preview-* 变量 |
| F08-03 | 设置面板 | 模板选择器 UI |

---

## 6. 测试要点

### 6.1 模板渲染测试

| 测试项 | default | blog | tech-doc | academic | minimalist |
|--------|---------|------|----------|----------|------------|
| 容器宽度 | 860px | 720px | 900px | 800px | 680px |
| H1 样式 | 左对齐+底边框 | 居中+装饰线 | 左对齐+底边框 | 居中无装饰 | 细字重 |
| H2 样式 | 左侧红色竖线 | 底边框 | `#` 前缀 | 自动编号 | 无装饰 |
| 行高 | 1.8 | 1.9 | 1.7 | 1.9 | 2.0 |
| 字体 | 衬线 | 衬线 | 无衬线 | Times | 衬线 |
| 图片 | 圆角阴影 | 大阴影 | 细边框 | 正常 | 无装饰 |
| 代码块 | 圆角 | 圆角 | 带边框 | 直角 | 左侧线 |
| 引用块 | 蓝色竖线 | 上下边框 | 蓝色竖线 | 左右缩进 | 左侧线 |

### 6.2 组合测试

1. `light` 全局 + `orange` 主题 + `blog` 模板 -> 橙色调 + 博客排版
2. `dark` 全局 + `blue` 主题 + `tech-doc` 模板 -> 暗蓝调 + 文档排版
3. `light` 全局 + `default` 主题 + `academic` 模板 -> 默认色 + 论文排版
4. 切换模板时排版变化有 300ms 过渡

### 6.3 响应式测试

- 所有模板在窗口宽度 < 768px 时正确缩小 padding 和 max-width
- 所有模板在窗口宽度 < 480px 时进一步适配
