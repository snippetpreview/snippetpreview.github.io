declare module 'markdown-it-task-lists' {
  interface TaskListOptions {
    enabled?: boolean
    label?: boolean
    labelAfter?: boolean
  }

  const taskLists: (markdown: import('markdown-it').default, options?: TaskListOptions) => void
  export default taskLists
}
