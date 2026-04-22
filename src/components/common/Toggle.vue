<template>
  <button
    class="toggle"
    :class="{ on: modelValue }"
    @click="toggle"
    role="switch"
    :aria-checked="modelValue"
  >
    <span class="toggle-thumb" />
  </button>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function toggle() {
  emit('update:modelValue', !props.modelValue)
}
</script>

<style scoped>
.toggle {
  width: 36px;
  height: 20px;
  background: var(--border);
  border-radius: 10px;
  position: relative;
  cursor: pointer;
  border: none;
  padding: 0;
  transition: background 0.2s;
  flex-shrink: 0;
}

.toggle:hover {
  background: var(--border-hover);
}

.toggle.on {
  background: var(--accent);
}

.toggle.on:hover {
  background: var(--accent-hover);
}

.toggle-thumb {
  position: absolute;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.toggle.on .toggle-thumb {
  transform: translateX(16px);
}
</style>
