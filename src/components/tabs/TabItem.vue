<template>
  <div
    class="tab-item"
    :class="{ active: isActive, modified: tab.isModified }"
    :title="tab.path"
    @click="$emit('activate', tab.id)"
    @mousedown.middle.prevent="$emit('close', tab.id)"
    @contextmenu.prevent="$emit('contextmenu', $event, tab.id)"
  >
    <span class="tab-name">{{ tab.name }}</span>

    <!-- 修改圆点：isModified 时显示，hover 时隐藏 -->
    <span
      v-if="tab.isModified"
      class="tab-modified-dot"
      @click.stop="$emit('close', tab.id)"
    />

    <!-- 关闭按钮：默认隐藏，hover 显示；isModified 时隐藏，hover 显示 -->
    <button
      class="tab-close-btn"
      :class="{ 'hidden-modified': tab.isModified }"
      @click.stop="$emit('close', tab.id)"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M4 4L10 10M10 4L4 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Tab } from '@/types'

interface Props {
  tab: Tab
  isActive: boolean
}

defineProps<Props>()

defineEmits<{
  activate: [id: string]
  close: [id: string]
  contextmenu: [event: MouseEvent, id: string]
}>()
</script>

<style scoped>
.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  height: 100%;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  font-family: var(--font-ui);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  position: relative;
  user-select: none;
  flex-shrink: 0;
  max-width: 180px;
}

.tab-item:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.tab-item.active {
  color: var(--text-primary);
  border-bottom-color: var(--accent);
  background: var(--bg-primary);
}

.tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: var(--tabbar-height);
}

/* 修改圆点 */
.tab-modified-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
  cursor: pointer;
}

/* hover 时隐藏圆点 */
.tab-item:hover .tab-modified-dot {
  display: none;
}

/* 关闭按钮 */
.tab-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background 0.1s, color 0.1s;
  flex-shrink: 0;
  padding: 0;
  position: absolute;
  right: 6px;
}

/* hover 时显示关闭按钮 */
.tab-item:hover .tab-close-btn {
  opacity: 1;
}

/* isModified 时：关闭按钮默认隐藏（圆点代替） */
.tab-close-btn.hidden-modified {
  opacity: 0;
}

/* hover 时 isModified 的关闭按钮也显示 */
.tab-item:hover .tab-close-btn.hidden-modified {
  opacity: 1;
}

.tab-close-btn:hover {
  background: var(--border);
  color: var(--text-primary);
}
</style>
