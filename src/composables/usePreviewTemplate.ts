import { computed, watch } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import type { PreviewTemplateId } from '@/types'

export function usePreviewTemplate() {
  const settingsStore = useSettingsStore()
  const currentTemplate = computed<PreviewTemplateId>(
    () => settingsStore.previewTemplate as PreviewTemplateId
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

  watch(
    currentTemplate,
    (id) => {
      applyTemplate(id)
    },
    { immediate: true }
  )

  return {
    currentTemplate,
    setTemplate,
    applyTemplate,
  }
}
