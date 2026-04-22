/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it'
  const taskLists: MarkdownIt.PluginSimple
  export default taskLists
}
