<template>
  <div class="settings-section">
    <h3 class="section-title">{{ title }}</h3>
    <div class="section-content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string
}
defineProps<Props>()
</script>

<style scoped>
.settings-section {
  margin-bottom: 28px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.section-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
