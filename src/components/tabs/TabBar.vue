<template>
  <div class="tab-bar" ref="tabBarRef">
    <TabItem
      v-for="tab in tabStore.tabs"
      :key="tab.id"
      :tab="tab"
      :is-active="tab.id === tabStore.activeTabId"
      @activate="tabStore.activateTab"
      @close="tabStore.closeTab"
      @contextmenu="handleContextMenu"
    />

    <!-- 空标签占位 -->
    <div v-if="tabStore.tabCount === 0" class="tab-bar-placeholder">
      <span>未打开文件</span>
    </div>

    <!-- 右键上下文菜单 -->
    <ContextMenu
      v-if="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenuItems"
      @close="contextMenu.visible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useTabStore } from '@/stores/tabStore'
import TabItem from './TabItem.vue'
import ContextMenu from '@/components/common/ContextMenu.vue'

interface MenuItem {
  label: string
  action: () => void
  disabled?: boolean
}

const tabStore = useTabStore()
const tabBarRef = ref<HTMLElement>()

// 右键菜单状态
const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  tabId: '',
})

function handleContextMenu(event: MouseEvent, tabId: string) {
  contextMenu.visible = true
  contextMenu.x = event.clientX
  contextMenu.y = event.clientY
  contextMenu.tabId = tabId
}

const contextMenuItems = computed<MenuItem[]>(() => {
  const tabId = contextMenu.tabId
  const tabIndex = tabStore.tabs.findIndex(t => t.id === tabId)
  const isOnlyTab = tabStore.tabCount <= 1
  const isRightMost = tabIndex === tabStore.tabCount - 1

  return [
    {
      label: '关闭',
      action: () => tabStore.closeTab(tabId),
    },
    {
      label: '关闭其他',
      action: () => tabStore.closeOthers(tabId),
      disabled: isOnlyTab,
    },
    {
      label: '关闭右侧',
      action: () => tabStore.closeRight(tabId),
      disabled: isRightMost,
    },
    {
      label: '关闭全部',
      action: () => tabStore.closeAll(),
      disabled: tabStore.tabCount === 0,
    },
  ]
})
</script>

<style scoped>
.tab-bar {
  display: flex;
  align-items: stretch;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
  padding-left: 4px;
  height: var(--tabbar-height, 36px);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none; /* Firefox */
  position: relative;
}

.tab-bar::-webkit-scrollbar {
  display: none;
}

.tab-bar-placeholder {
  display: flex;
  align-items: center;
  padding: 0 14px;
  color: var(--text-muted);
  font-size: 12px;
  font-family: var(--font-ui);
  white-space: nowrap;
  user-select: none;
}
</style>
