import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import Anthropic from '@anthropic-ai/sdk'

// Root of the project (one level up from dev-agents/)
export const PROJECT_ROOT = path.resolve(__dirname, '..')

// ─── Tool Definitions (passed to Claude) ──────────────────────────────────────

export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file in the project. Path is relative to project root.',
    input_schema: {
      type: 'object' as const,
      properties: {
        file_path: { type: 'string', description: 'Path relative to project root, e.g. src/components/Button.tsx' }
      },
      required: ['file_path']
    }
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a file in the project. Creates parent directories automatically.',
    input_schema: {
      type: 'object' as const,
      properties: {
        file_path: { type: 'string', description: 'Path relative to project root' },
        content: { type: 'string', description: 'Full file content to write' }
      },
      required: ['file_path', 'content']
    }
  },
  {
    name: 'list_directory',
    description: 'List files and folders in a directory. Path is relative to project root.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dir_path: { type: 'string', description: 'Directory path relative to project root. Use "." for root.' },
        recursive: { type: 'boolean', description: 'Whether to list recursively. Default false.' }
      },
      required: ['dir_path']
    }
  },
  {
    name: 'run_bash',
    description: 'Run a shell command in the project root. Use for tsc --noEmit, running tests, git status, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
        timeout_ms: { type: 'number', description: 'Timeout in milliseconds. Default 30000.' }
      },
      required: ['command']
    }
  }
]

// ─── Tool Execution ────────────────────────────────────────────────────────────

export function executeTool(name: string, input: Record<string, unknown>): string {
  try {
    switch (name) {
      case 'read_file': {
        const filePath = path.join(PROJECT_ROOT, input.file_path as string)
        if (!fs.existsSync(filePath)) return `Error: file not found — ${input.file_path}`
        const content = fs.readFileSync(filePath, 'utf-8')
        // Truncate very large files to avoid flooding context
        if (content.length > 8000) {
          return content.slice(0, 8000) + `\n\n[...truncated — ${content.length} chars total]`
        }
        return content
      }

      case 'write_file': {
        const filePath = path.join(PROJECT_ROOT, input.file_path as string)
        fs.mkdirSync(path.dirname(filePath), { recursive: true })
        fs.writeFileSync(filePath, input.content as string, 'utf-8')
        return `✅ Written: ${input.file_path}`
      }

      case 'list_directory': {
        const dirPath = path.join(PROJECT_ROOT, input.dir_path as string)
        if (!fs.existsSync(dirPath)) return `Error: directory not found — ${input.dir_path}`
        const recursive = input.recursive as boolean ?? false
        const entries = listDir(dirPath, recursive, PROJECT_ROOT)
        return entries.join('\n') || '(empty directory)'
      }

      case 'run_bash': {
        const timeout = (input.timeout_ms as number) ?? 30000
        try {
          const output = execSync(input.command as string, {
            cwd: PROJECT_ROOT,
            timeout,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe']
          })
          return output || '(no output)'
        } catch (err: unknown) {
          const e = err as { stdout?: string; stderr?: string; message?: string }
          return `Exit error:\n${e.stdout ?? ''}\n${e.stderr ?? ''}\n${e.message ?? ''}`.trim()
        }
      }

      default:
        return `Error: unknown tool "${name}"`
    }
  } catch (err: unknown) {
    const e = err as Error
    return `Tool error: ${e.message}`
  }
}

function listDir(dirPath: string, recursive: boolean, root: string, depth = 0): string[] {
  if (depth > 4) return []                  // safety limit
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const results: string[] = []
  const indent = '  '.repeat(depth)
  for (const entry of entries) {
    // skip noise
    if (['node_modules', '.git', '.next', 'dist', '.turbo'].includes(entry.name)) continue
    const rel = path.relative(root, path.join(dirPath, entry.name))
    results.push(`${indent}${entry.isDirectory() ? '📁' : '📄'} ${rel}`)
    if (entry.isDirectory() && recursive) {
      results.push(...listDir(path.join(dirPath, entry.name), recursive, root, depth + 1))
    }
  }
  return results
}
