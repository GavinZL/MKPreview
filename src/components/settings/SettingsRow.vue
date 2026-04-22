<template>
  <div class="setting-row">
    <div class="setting-info">
      <div class="setting-label">{{ label }}</div>
      <div v-if="description" class="setting-desc">{{ description }}</div>
    </div>
    <div class="setting-control">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  label: string
  description?: string
}
defineProps<Props>()
</script>

<style scoped>
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  gap: 16px;
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-label {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}

.setting-desc {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.setting-control {
  flex-shrink: 0;
}
</style>
