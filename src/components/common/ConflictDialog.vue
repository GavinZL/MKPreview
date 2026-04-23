<template>
  <Modal
    :visible="visible"
    :close-on-overlay="false"
    :close-on-esc="false"
    width="500px"
    @close="onClose"
  >
    <div class="conflict-dialog">
      <div class="conflict-header">
        <span class="conflict-icon">⚠️</span>
        <h3>{{ t('conflict.title') }}</h3>
      </div>
      <p class="conflict-message">
        <span v-html="t('conflict.message', { fileName: `<strong>${fileName}</strong>` })" />
      </p>
      <div class="conflict-actions">
        <button class="btn btn-secondary" @click="$emit('keepLocal')">
          {{ t('conflict.keepLocal') }}
        </button>
        <button class="btn btn-secondary" @click="$emit('loadExternal')">
          {{ t('conflict.loadExternal') }}
        </button>
        <button class="btn btn-primary" @click="$emit('viewDiff')">
          {{ t('conflict.viewDiff') }}
        </button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Modal from '@/components/common/Modal.vue'

const { t } = useI18n()

interface Props {
  visible: boolean
  fileName: string
  filePath: string
}

defineProps<Props>()

defineEmits<{
  keepLocal: []
  loadExternal: []
  viewDiff: []
}>()

function onClose() {
  // 冲突对话框不允许通过 ESC 或点击遮罩关闭
  // 用户必须选择一个解决方式
}
</script>

<style scoped>
.conflict-dialog {
  padding: 24px;
}

.conflict-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.conflict-icon {
  font-size: 24px;
  line-height: 1;
}

.conflict-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.conflict-message {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 24px;
}

.conflict-message strong {
  color: var(--text-primary);
}

.conflict-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  font-family: var(--font-ui);
  white-space: nowrap;
}

.btn-primary {
  background: var(--accent);
  color: #ffffff;
}

.btn-primary:hover {
  filter: brightness(1.1);
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--border);
}
</style>
