/**
 * Orchestrator — parallel feature builder.
 *
 * Usage:
 *   npx ts-node dev-agents/orchestrator.ts "Add a JobCard component to the Kanban board with match score"
 *   npx ts-node dev-agents/orchestrator.ts --figma "https://figma.com/..." "Feature description"
 *
 * What it does:
 *   1. Reads project context (key files + CLAUDE.md)
 *   2. Calls Claude once to plan the feature: shared types + Design task + Services task
 *   3. Launches Design Worker and Services Worker in parallel via Promise.all
 *   4. Prints a unified handoff report
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { runWorker } from "./worker";
import type { FeatureRequest, WorkerTask, WorkerResult } from "./types";

const client = new Anthropic();
const MODEL = "claude-sonnet-4-5";
const PROJECT_ROOT = path.resolve(__dirname, "..");

// ── CLI parsing ───────────────────────────────────────────────────────────────

function parseCLI(): FeatureRequest {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      'Usage: npx ts-node dev-agents/orchestrator.ts [--figma <url>] "<feature description>"',
    );
    process.exit(1);
  }

  let figmaUrl: string | undefined;
  const descriptionParts: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--figma" && args[i + 1]) {
      figmaUrl = args[++i];
    } else {
      descriptionParts.push(args[i]);
    }
  }

  const description = descriptionParts.join(" ").trim();
  if (!description) {
    console.error("Error: feature description is required.");
    process.exit(1);
  }

  return { description, figmaUrl };
}

// ── Project context snapshot ──────────────────────────────────────────────────

function readProjectContext(): string {
  const snippets: string[] = [];

  const filesToRead = [
    "CLAUDE.md",
    "src/types/index.ts",
    "src/components/design-system/index.ts",
    "src/app/actions/applications.ts",
  ];

  for (const rel of filesToRead) {
    const abs = path.join(PROJECT_ROOT, rel);
    if (fs.existsSync(abs)) {
      const content = fs.readFileSync(abs, "utf-8");
      const truncated =
        content.length > 3000
          ? content.slice(0, 3000) + "\n[...truncated]"
          : content;
      snippets.push(`=== ${rel} ===\n${truncated}`);
    }
  }

  // List the design-system components that already exist
  const dsDir = path.join(PROJECT_ROOT, "src/components/design-system");
  if (fs.existsSync(dsDir)) {
    const atoms = listNames(path.join(dsDir, "atoms"));
    const molecules = listNames(path.join(dsDir, "molecules"));
    snippets.push(
      `=== Existing design-system components ===\nAtoms: ${atoms}\nMolecules: ${molecules}`,
    );
  }

  return snippets.join("\n\n");
}

function listNames(dir: string): string {
  if (!fs.existsSync(dir)) return "(none)";
  return (
    fs
      .readdirSync(dir, { withFileTypes: true })
      .filter(
        (e) =>
          e.isFile() &&
          /\.(tsx|ts)$/.test(e.name) &&
          !e.name.includes("test") &&
          !e.name.includes("stories"),
      )
      .map((e) => e.name.replace(/\.(tsx|ts)$/, ""))
      .join(", ") || "(none)"
  );
}

// ── Planning phase — single Claude call ───────────────────────────────────────

interface FeaturePlan {
  sharedTypes: string; // TypeScript interfaces both workers will use
  designTask: string; // Prompt for the Design Worker
  servicesTask: string; // Prompt for the Services Worker
  featureName: string; // Short kebab-case slug
}

async function planFeature(
  request: FeatureRequest,
  context: string,
): Promise<FeaturePlan> {
  console.log("\n🧠 Planning feature split...");

  const systemPrompt = `You are a senior TypeScript architect. Your job is to split a feature request
into two parallel workstreams — Design and Services — and define the shared TypeScript contracts
between them. Be concrete and specific. The team will implement exactly what you write.`;

  const userPrompt = `Feature request: "${request.description}"
${request.figmaUrl ? `Figma URL: ${request.figmaUrl}` : ""}

Project context:
${context}

Produce a JSON plan with this exact shape:
{
  "featureName": "kebab-case-slug",
  "sharedTypes": "// TypeScript interfaces used by both workers\\nexport interface ...",
  "designTask": "Detailed task description for the Design Worker (React components, Tailwind, Storybook, tests)",
  "servicesTask": "Detailed task description for the Services Worker (Server Actions, Firestore, types, validation)"
}

Rules:
- sharedTypes must compile as valid TypeScript
- designTask must reference the sharedTypes and say exactly which components to create/modify
- servicesTask must reference the sharedTypes and say exactly which actions/DAL functions to create
- If the feature is purely UI with no backend logic, set servicesTask to "No backend changes needed for this feature."
- If the feature is purely backend, set designTask to "No UI changes needed for this feature."
- Reply with ONLY the JSON object — no markdown fences, no explanation`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const raw = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("")
    .trim();

  // Strip markdown fences if Claude ignored the instruction
  const jsonStr = raw
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  try {
    const plan = JSON.parse(jsonStr) as FeaturePlan;
    console.log(`  Feature: ${plan.featureName}`);
    console.log(`  Shared types: ${plan.sharedTypes.split("\n").length} lines`);
    return plan;
  } catch {
    console.error("Failed to parse plan JSON:\n", raw);
    throw new Error("Orchestrator: planning phase returned invalid JSON.");
  }
}

// ── Report printer ─────────────────────────────────────────────────────────────

function printReport(plan: FeaturePlan, results: WorkerResult[]): void {
  const sep = "─".repeat(60);

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ✅  FEATURE COMPLETE: ${plan.featureName}`);
  console.log("═".repeat(60));

  for (const result of results) {
    const icon = result.domain === "design" ? "🎨" : "⚙️";
    console.log(`\n${icon}  ${result.domain.toUpperCase()} WORKER`);
    console.log(sep);

    if (result.filesCreated.length > 0) {
      console.log("Created:");
      result.filesCreated.forEach((f) => console.log(`  + ${f}`));
    }
    if (result.filesModified.length > 0) {
      console.log("Modified:");
      result.filesModified.forEach((f) => console.log(`  ~ ${f}`));
    }

    console.log("\nSummary:");
    console.log(" ", result.summary.split("\n").join("\n  "));

    if (result.decisions.length > 0) {
      console.log("\nAutonomous decisions:");
      result.decisions.forEach((d) => console.log(`  • ${d}`));
    }

    if (result.todos.length > 0) {
      console.log("\n⚠️  Review needed:");
      result.todos.forEach((t) => console.log(`  □ ${t}`));
    }
  }

  // Aggregate all todos
  const allTodos = results.flatMap((r) => r.todos);
  if (allTodos.length > 0) {
    console.log(`\n${sep}`);
    console.log("📋  COMBINED TODO LIST");
    console.log(sep);
    allTodos.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
  }

  console.log(`\n${"═".repeat(60)}\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const request = parseCLI();

  console.log(`\n🚀 Orchestrator starting`);
  console.log(`   Feature: "${request.description}"`);
  if (request.figmaUrl) console.log(`   Figma: ${request.figmaUrl}`);

  // 1. Snapshot project context
  console.log("\n📂 Reading project context...");
  const context = readProjectContext();

  // 2. Plan the feature — one Claude call
  const plan = await planFeature(request, context);

  // 3. Build WorkerTask objects
  const designTask: WorkerTask = {
    domain: "design",
    description: plan.designTask,
    sharedTypes: plan.sharedTypes,
    context,
  };

  const servicesTask: WorkerTask = {
    domain: "services",
    description: plan.servicesTask,
    sharedTypes: plan.sharedTypes,
    context,
  };

  // 4. Run both workers in parallel
  console.log("\n⚡ Launching workers in parallel...\n");
  const [designResult, servicesResult] = await Promise.all([
    runWorker(designTask),
    runWorker(servicesTask),
  ]);

  // 5. Print unified report
  printReport(plan, [designResult, servicesResult]);
}

main().catch((err) => {
  console.error("\n❌ Orchestrator failed:", err);
  process.exit(1);
});
