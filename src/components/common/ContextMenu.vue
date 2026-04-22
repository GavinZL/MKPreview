<template>
  <Teleport to="body">
    <div class="context-menu-overlay" @mousedown="$emit('close')" />
    <div
      class="context-menu"
      :style="menuStyle"
    >
      <button
        v-for="(item, index) in items"
        :key="index"
        class="context-menu-item"
        :class="{ disabled: item.disabled }"
        :disabled="item.disabled"
        @click="handleSelect(item)"
      >
        {{ item.label }}
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'

export interface MenuItem {
  label: string
  action: () => void
  disabled?: boolean
}

interface Props {
  items: MenuItem[]
  x: number
  y: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const menuStyle = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
}))

function handleSelect(item: MenuItem) {
  if (item.disabled) return
  item.action()
  emit('close')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.context-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
}

.context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 160px;
  padding: 4px 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: var(--shadow-lg);
  font-family: var(--font-ui);
  font-size: 12px;
}

.context-menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 6px 16px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: inherit;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  text-align: left;
  transition: background 0.1s;
}

.context-menu-item:hover:not(.disabled) {
  background: var(--bg-hover);
}

.context-menu-item.disabled {
  color: var(--text-muted);
  cursor: default;
  pointer-events: none;
}
</style>
