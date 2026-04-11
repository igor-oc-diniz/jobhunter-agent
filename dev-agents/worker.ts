/**
 * Generic agentic worker loop.
 *
 * Runs a Claude model with tools in a loop until:
 *  - stop_reason === 'end_turn'  (Claude decided it's done)
 *  - iteration limit is reached  (safety cap)
 *  - Claude calls the special `task_complete` tool
 */
import Anthropic from '@anthropic-ai/sdk'
import { TOOLS, executeTool } from './tools'
import type { WorkerTask, WorkerResult } from './types'

const client = new Anthropic()
const MODEL = 'claude-sonnet-4-5'
const MAX_ITERATIONS = 50

export async function runWorker(task: WorkerTask): Promise<WorkerResult> {
  console.log(`\n🤖 [${task.domain.toUpperCase()} WORKER] Starting...`)

  // The system prompt loads the skill context + project conventions
  const systemPrompt = buildSystemPrompt(task)

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: task.description }
  ]

  let iterations = 0
  const filesCreated: string[] = []
  const filesModified: string[] = []

  // ── Agentic loop ──────────────────────────────────────────────────────────
  while (iterations < MAX_ITERATIONS) {
    iterations++
    console.log(`  [${task.domain}] iteration ${iterations}`)

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8096,
      system: systemPrompt,
      tools: [
        ...TOOLS,
        // Special tool to signal task completion with a structured result
        {
          name: 'task_complete',
          description: 'Call this when the task is fully done to report results.',
          input_schema: {
            type: 'object' as const,
            properties: {
              summary: { type: 'string', description: 'What was built' },
              decisions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Autonomous decisions made during implementation'
              },
              todos: {
                type: 'array',
                items: { type: 'string' },
                description: 'Things the user should review or complete'
              }
            },
            required: ['summary', 'decisions', 'todos']
          }
        }
      ],
      messages
    })

    // Add assistant response to history
    messages.push({ role: 'assistant', content: response.content })

    // ── Handle stop reasons ──────────────────────────────────────────────
    if (response.stop_reason === 'end_turn') {
      // Claude finished without calling task_complete — extract text summary
      const text = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as Anthropic.TextBlock).text)
        .join('\n')
      console.log(`  [${task.domain}] ✅ Done (end_turn)`)
      return { domain: task.domain, filesCreated, filesModified, summary: text, decisions: [], todos: [] }
    }

    if (response.stop_reason !== 'tool_use') break

    // ── Execute all tool calls in this response ─────────────────────────
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue

      const toolUse = block as Anthropic.ToolUseBlock

      // task_complete → we're done
      if (toolUse.name === 'task_complete') {
        const input = toolUse.input as { summary: string; decisions: string[]; todos: string[] }
        console.log(`  [${task.domain}] ✅ Done (task_complete)`)
        return {
          domain: task.domain,
          filesCreated,
          filesModified,
          summary: input.summary,
          decisions: input.decisions,
          todos: input.todos
        }
      }

      console.log(`  [${task.domain}] 🔧 ${toolUse.name}(${JSON.stringify(toolUse.input).slice(0, 80)}...)`)
      const result = executeTool(toolUse.name, toolUse.input as Record<string, unknown>)

      // Track file writes
      if (toolUse.name === 'write_file') {
        const fp = (toolUse.input as { file_path: string }).file_path
        if (result.startsWith('✅')) filesCreated.push(fp)
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result
      })
    }

    // Feed tool results back into the conversation
    messages.push({ role: 'user', content: toolResults })
  }

  console.log(`  [${task.domain}] ⚠️  Reached iteration limit`)
  return {
    domain: task.domain,
    filesCreated,
    filesModified,
    summary: `Worker reached ${MAX_ITERATIONS}-iteration safety limit.`,
    decisions: [],
    todos: ['Review incomplete work — agent hit iteration limit']
  }
}

// ── System prompt builder ──────────────────────────────────────────────────

function buildSystemPrompt(task: WorkerTask): string {
  const base = `You are an autonomous ${task.domain} agent working on a software project.
Complete the assigned task fully and independently. Make reasonable decisions without asking
for approval. Only stop when the task is truly done by calling the task_complete tool.

SHARED TYPES (agreed with the parallel worker):
${task.sharedTypes}

PROJECT CONTEXT:
${task.context}
`

  if (task.domain === 'design') {
    return base + `
DESIGN CONVENTIONS:
- Framework: Next.js 14 + React 18 + TypeScript (strict)
- Styling: Tailwind CSS with Neon Command dark design system
- Colors: background #131313, surfaces #0e0e0e→#353534, primary #00ff88
- Typography: font-headline/font-label = Space Grotesk, font-body = Manrope
- Rules: no black (use bg-background), min rounded-[1rem], shadow-neon only
- Use glass-panel utility for glassmorphism cards
- Atomic design: particles → atoms → molecules (in src/components/design-system/)
- Organisms live in src/components/dashboard/
- Always: TypeScript interfaces, data-testid, forwardRef, Vitest tests, Storybook stories
- Barrel export: update src/components/design-system/index.ts after each component
- Reuse existing atoms: StatusBadge, StatusBeacon, ScoreBadge, Chip, StatCard, NotificationItem
`
  }

  if (task.domain === 'services') {
    return base + `
SERVICES CONVENTIONS:
- Language: TypeScript strict mode, no implicit any
- File naming: kebab-case
- Async: always explicit try/catch with structured logger (winston)
- Firebase: use Admin SDK for server-side, never call getAuth()/getDb() at module level
- Validation: validate all Claude JSON output with Zod before using
- Patterns: Server Actions in src/app/actions/, DAL in src/lib/firebase/
- Firestore structure: users/{userId}/profile|rawJobs|applications|notifications
- Types: import from src/types/ — never duplicate existing type definitions
- Logging: { level, action, timestamp } — never log credentials
`
  }

  return base
}
