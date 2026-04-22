# F06-05 图片处理与 Lightbox

## 1. 功能描述与目标

本特性实现 Markdown 图片的加载、渲染和交互处理：

- **本地相对路径图片解析**：将 `./diagram.png` 等相对路径转换为 Tauri `asset:` 协议 URL，通过 Rust 后端读取本地文件
- **响应式显示**：图片最大宽度不超过内容区域，高度按比例缩放
- **加载失败占位符**：图片加载失败时显示占位区域 + 原始路径信息
- **Lightbox 大图查看**：点击图片弹出模态框，支持大图查看（P2 增强：缩放、拖拽）
- **图片标题**：`alt` 文字作为 caption 显示在图片下方
- **悬浮效果**：鼠标悬浮时轻微放大（transform: scale(1.02)，300ms transition）

### MVP 阶段范围

- 支持本地相对路径图片（基于当前 Markdown 文件目录解析）
- 简单的模态框大图查看（点击放大、点击背景关闭）
- 图片加载失败显示占位符

### Phase 2 增强

- Lightbox 支持缩放（滚轮 / 按钮）
- Lightbox 支持拖拽平移
- 键盘快捷键（ESC 关闭、方向键切换多张图片）

## 2. 技术实现方案

### 2.1 文件位置

```
src/components/preview/ImageLightbox.vue    # Lightbox 模态框组件
src/composables/useImageHandler.ts          # 图片路径解析 + 事件绑定 composable
```

### 2.2 图片路径解析

Markdown 中的图片语法：

```markdown
![描述文字](./row_buffer_sliding_window.drawio.png)
![描述文字](../images/arch.png)
![描述文字](https://example.com/img.png)
```

路径解析策略：

1. **外部 URL**（`http://` / `https://`）：原样保留，直接由浏览器加载
2. **绝对路径**（以 `/` 开头）：在 Tauri 环境中转为 `asset://` 协议
3. **相对路径**（以 `./` 或 `../` 开头）：以当前 Markdown 文件所在目录为基准拼接绝对路径，再转为 `asset://`

```typescript
// src/composables/useImageHandler.ts

import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * 图片路径解析选项
 */
interface ImagePathOptions {
  /** 当前 Markdown 文件的绝对路径 */
  currentFilePath: string;
  /** 图片的 src 属性值（来自 markdown-it 渲染结果） */
  src: string;
}

/**
 * 解析图片路径为可加载的 URL
 * @param options 解析选项
 * @returns 可安全加载的 URL
 */
export function resolveImagePath(options: ImagePathOptions): string {
  const { currentFilePath, src } = options;

  // 外部 URL：原样返回
  if (/^https?:\/\//.test(src)) {
    return src;
  }

  // 提取当前文件所在目录
  const currentDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));

  // 拼接绝对路径
  let absolutePath: string;
  if (src.startsWith('/')) {
    absolutePath = src;
  } else {
    // 处理相对路径
    const path = require('path');  // 实际使用 Tauri 或原生路径拼接
    absolutePath = path.resolve(currentDir, src);
  }

  // 转为 Tauri asset URL
  return convertFileSrc(absolutePath);
}

/**
 * 处理渲染容器内所有图片的 src 路径
 * @param container 渲染容器 DOM
 * @param currentFilePath 当前文件路径
 */
export function processImagePaths(container: HTMLElement, currentFilePath: string): void {
  const images = container.querySelectorAll<HTMLImageElement>('img');

  images.forEach((img) => {
    const originalSrc = img.getAttribute('src');
    if (!originalSrc) return;

    // 保存原始路径（用于错误显示）
    img.dataset.originalSrc = originalSrc;

    // 解析并更新路径
    const resolved = resolveImagePath({
      currentFilePath,
      src: originalSrc,
    });

    img.src = resolved;
  });
}
```

### 2.3 图片加载失败处理

```typescript
// src/composables/useImageHandler.ts

/**
 * 绑定图片加载错误事件
 * @param container 渲染容器 DOM
 */
export function bindImageErrorHandlers(container: HTMLElement): void {
  const images = container.querySelectorAll<HTMLImageElement>('img');

  images.forEach((img) => {
    img.onerror = () => {
      img.classList.add('img-error');
      img.alt = img.dataset.originalSrc || img.alt || '图片加载失败';

      // 替换为占位符显示
      const wrapper = document.createElement('div');
      wrapper.className = 'img-error-placeholder';
      wrapper.innerHTML = `
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
        <span class="img-error-path">${img.dataset.originalSrc || '未知路径'}</span>
      `;

      // 隐藏原图，显示占位符
      img.style.display = 'none';
      img.parentNode?.insertBefore(wrapper, img.nextSibling);
    };

    // 清理旧错误状态
    img.onload = () => {
      img.classList.remove('img-error');
      const placeholder = img.parentNode?.querySelector('.img-error-placeholder');
      if (placeholder) placeholder.remove();
      img.style.display = '';
    };
  });
}
```

### 2.4 ImageLightbox.vue 组件

```vue
<!-- src/components/preview/ImageLightbox.vue -->
<template>
  <Teleport to="body">
    <Transition name="lightbox-fade">
      <div
        v-if="visible"
        class="mk-lightbox"
        @click="onBackdropClick"
      >
        <!-- 关闭按钮 -->
        <button class="lightbox-close" @click="close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>

        <!-- 图片 -->
        <img
          :src="currentSrc"
          :alt="currentAlt"
          class="lightbox-image"
          :style="imageStyle"
          @click.stop
        />

        <!-- 标题 -->
        <div v-if="currentAlt" class="lightbox-caption">{{ currentAlt }}</div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

// ==================== Props & Emits ====================

interface Props {
  /** 图片列表 */
  images: Array<{ src: string; alt: string }>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

// ==================== 状态 ====================

const visible = ref(false);
const currentIndex = ref(0);

// ==================== 计算属性 ====================

const currentSrc = computed(() => props.images[currentIndex.value]?.src || '');
const currentAlt = computed(() => props.images[currentIndex.value]?.alt || '');

// Phase 2: 缩放和拖拽
const scale = ref(1);
const translateX = ref(0);
const translateY = ref(0);

const imageStyle = computed(() => ({
  transform: `scale(${scale.value}) translate(${translateX.value}px, ${translateY.value}px)`,
  cursor: scale.value > 1 ? 'grab' : 'default',
}));

// ==================== 方法 ====================

function open(index: number = 0): void {
  currentIndex.value = index;
  scale.value = 1;
  translateX.value = 0;
  translateY.value = 0;
  visible.value = true;
}

function close(): void {
  visible.value = false;
  emit('close');
}

function onBackdropClick(e: MouseEvent): void {
  if (e.target === e.currentTarget) {
    close();
  }
}

// ==================== 键盘事件 ====================

function onKeydown(e: KeyboardEvent): void {
  if (!visible.value) return;

  switch (e.key) {
    case 'Escape':
      close();
      break;
    case 'ArrowLeft':
      if (currentIndex.value > 0) currentIndex.value--;
      break;
    case 'ArrowRight':
      if (currentIndex.value < props.images.length - 1) currentIndex.value++;
      break;
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
});

// ==================== 暴露方法 ====================

defineExpose({
  open,
  close,
});
</script>

<style scoped>
.mk-lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.88);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 40px;
}

.lightbox-image {
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  border-radius: 8px;
  transition: transform 0.2s ease;
  user-select: none;
}

.lightbox-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.15s;
  z-index: 1001;
}

.lightbox-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.lightbox-caption {
  margin-top: 16px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  text-align: center;
  max-width: 80vw;
}

/* 过渡动画 */
.lightbox-fade-enter-active,
.lightbox-fade-leave-active {
  transition: opacity 0.25s ease;
}

.lightbox-fade-enter-from,
.lightbox-fade-leave-to {
  opacity: 0;
}
</style>
```

### 2.5 图片事件绑定 Composable

```typescript
// src/composables/useImageHandler.ts

import { ref } from 'vue';
import type ImageLightbox from '@/components/preview/ImageLightbox.vue';

/**
 * 图片处理 Composable
 * @param currentFilePath 当前 Markdown 文件路径
 */
export function useImageHandler(currentFilePath: string) {
  const lightboxRef = ref<InstanceType<typeof ImageLightbox> | null>(null);
  const imageList = ref<Array<{ src: string; alt: string }>>([]);

  /**
   * 初始化渲染容器内的图片处理
   * @param container 渲染容器 DOM
   */
  function initImages(container: HTMLElement): void {
    // 1. 解析路径
    processImagePaths(container, currentFilePath);

    // 2. 绑定错误处理
    bindImageErrorHandlers(container);

    // 3. 收集图片列表用于 Lightbox
    const images = container.querySelectorAll<HTMLImageElement>('img');
    imageList.value = Array.from(images).map(img => ({
      src: img.src,
      alt: img.alt,
    }));

    // 4. 绑定点击事件
    images.forEach((img, index) => {
      img.addEventListener('click', () => {
        lightboxRef.value?.open(index);
      });
    });
  }

  /**
   * 清理图片事件监听
   * @param container 渲染容器 DOM
   */
  function cleanupImages(container: HTMLElement): void {
    const images = container.querySelectorAll<HTMLImageElement>('img');
    images.forEach((img) => {
      img.onclick = null;
      img.onerror = null;
      img.onload = null;
    });
    imageList.value = [];
  }

  return {
    lightboxRef,
    imageList,
    initImages,
    cleanupImages,
  };
}
```

### 2.6 补充 CSS（融入 base.css）

```css
/* 图片加载失败占位符（补充到 base.css） */
.mk-body .img-error-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  background: var(--bg-secondary);
  border: 1px dashed var(--border);
  border-radius: 8px;
  color: var(--text-muted);
  gap: 12px;
  min-height: 120px;
}

.mk-body .img-error-placeholder svg {
  opacity: 0.5;
}

.mk-body .img-error-path {
  font-family: var(--font-mono);
  font-size: 12px;
  word-break: break-all;
  text-align: center;
  max-width: 100%;
}
```

## 3. 接口定义

### 3.1 useImageHandler Composable

```typescript
export function useImageHandler(currentFilePath: string): {
  lightboxRef: Ref<InstanceType<typeof ImageLightbox> | null>;
  imageList: Ref<Array<{ src: string; alt: string }>>;
  initImages: (container: HTMLElement) => void;
  cleanupImages: (container: HTMLElement) => void;
};
```

### 3.2 ImageLightbox 组件

```typescript
// Props
interface ImageLightboxProps {
  images: Array<{ src: string; alt: string }>;
}

// 暴露方法
interface ImageLightboxExpose {
  open(index: number): void;
  close(): void;
}

// Emits
interface ImageLightboxEmits {
  (e: 'close'): void;
}
```

### 3.3 工具函数

```typescript
export function resolveImagePath(options: { currentFilePath: string; src: string }): string;
export function processImagePaths(container: HTMLElement, currentFilePath: string): void;
export function bindImageErrorHandlers(container: HTMLElement): void;
```

## 4. 数据结构

### 4.1 图片列表项

```typescript
interface ImageItem {
  src: string;    // 解析后的可加载 URL
  alt: string;    // 图片描述文字
}
```

### 4.2 Lightbox 状态

```typescript
interface LightboxState {
  visible: boolean;      // 是否可见
  currentIndex: number;  // 当前显示图片索引
  scale: number;         // 缩放比例（Phase 2）
  translateX: number;    // 水平偏移（Phase 2）
  translateY: number;    // 垂直偏移（Phase 2）
}
```

## 5. 依赖关系

### 5.1 依赖的上游模块

| 模块 | 特性 | 说明 |
|------|------|------|
| F01-02 | 前端基础配置 | Vue 3 / TypeScript 基础设施 |
| F06-01 | markdown-it 核心配置 | image 自定义规则处理路径 |
| F06-02 | 基础元素渲染样式 | img 基础样式（圆角、阴影、悬浮放大） |
| F08-01 | CSS 变量主题系统 | 无直接依赖但需样式变量 |

### 5.2 下游依赖本模块

| 模块 | 特性 | 说明 |
|------|------|------|
| F06-06 | 预览主组件 | 调用 useImageHandler 初始化图片处理 |

### 5.3 npm 依赖

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.0.0"
  }
}
```

**注意**：`convertFileSrc` 来自 `@tauri-apps/api/core`，用于将本地文件路径转换为 Tauri 安全的 asset URL。

### 5.4 Tauri 权限配置

```json
// src-tauri/capabilities/default.json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:allow-open",
    "fs:allow-read",
    "fs:allow-read-file"
  ]
}
```

## 6. 测试要点

### 6.1 路径解析测试

```typescript
// tests/composables/useImageHandler.spec.ts
import { describe, it, expect } from 'vitest';
import { resolveImagePath } from '@/composables/useImageHandler';

describe('resolveImagePath', () => {
  it('应保留外部 HTTP URL', () => {
    const result = resolveImagePath({
      currentFilePath: '/Users/learn/Cpp/pointer.md',
      src: 'https://example.com/img.png',
    });
    expect(result).toBe('https://example.com/img.png');
  });

  it('应解析同级目录相对路径', () => {
    const result = resolveImagePath({
      currentFilePath: '/Users/learn/Cpp/pointer.md',
      src: './diagram.png',
    });
    expect(result).toContain('asset://');
    expect(result).toContain('Cpp/diagram.png');
  });

  it('应解析上级目录相对路径', () => {
    const result = resolveImagePath({
      currentFilePath: '/Users/learn/Cpp/pointer.md',
      src: '../images/arch.png',
    });
    expect(result).toContain('asset://');
    expect(result).toContain('learn/images/arch.png');
  });
});
```

### 6.2 交互测试

| 测试项 | 操作 | 期望结果 |
|--------|------|---------|
| 点击图片 | 点击渲染区图片 | Lightbox 弹出显示大图 |
| 关闭 Lightbox | 点击背景 / 关闭按钮 / ESC | Lightbox 关闭 |
| 图片切换 | 左右方向键 | 切换到下一张/上一张图片 |
| 加载失败 | 图片路径不存在 | 显示占位符 + 原始路径 |
| 加载成功 | 图片路径正确 | 正常显示，无占位符 |

### 6.3 安全测试

| 测试项 | 输入 | 期望结果 |
|--------|------|---------|
| 路径遍历 | `../../../etc/passwd` | 被规范化后限制在 FS Scope 内 |
| 绝对路径 | `/etc/passwd` | Tauri asset 协议限制访问范围 |
| 远程图片 | `https://evil.com/tracker.png` | 允许加载（仅网络请求，不执行 JS）|

### 6.4 性能测试

| 指标 | 目标 | 测试方法 |
|------|------|---------|
| 图片路径解析 | < 1ms / 张 | 100 张图片批量解析 |
| Lightbox 打开 | < 100ms | 点击到图片显示 |
| 内存占用 | 关闭后释放 | DevTools Memory 面板确认无泄漏 |
