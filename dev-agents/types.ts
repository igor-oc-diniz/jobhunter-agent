export interface FeatureRequest {
  description: string      // what to build
  figmaUrl?: string        // optional Figma URL for design reference
  targetFiles?: string[]   // files the feature will touch (optional hint)
}

export interface WorkerTask {
  domain: 'design' | 'services'
  description: string      // specific task for this worker
  sharedTypes: string      // TypeScript type definitions both workers agree on
  context: string          // project context snapshot
}

export interface WorkerResult {
  domain: 'design' | 'services'
  filesCreated: string[]
  filesModified: string[]
  summary: string
  decisions: string[]      // autonomous decisions made
  todos: string[]          // things left for the user to review/complete
}

export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}
