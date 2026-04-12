import { systemPrompt } from './system-prompt.js';

/**
 * Tool names available to the autonomous workflow agent.
 */
export type ToolName = 'Read' | 'Write' | 'Edit' | 'Bash' | 'Glob' | 'Grep' | 'WebSearch' | 'Skill';

/**
 * Agent definition compatible with Claude Agent SDK.
 * Defines the configuration for spawning a subagent.
 */
export interface AgentDefinition {
  /** Description shown when listing available agents */
  description: string;
  /** System prompt providing agent instructions */
  prompt: string;
  /** Tools available to this agent */
  tools: ToolName[];
  /** Model to use for this agent */
  model?: 'sonnet' | 'opus' | 'haiku';
  /** Maximum turns before stopping */
  maxTurns?: number;
}

/**
 * Autonomous workflow agent for Claude Agent SDK.
 *
 * Executes complete feature development cycles autonomously—from task intake
 * through tested PR delivery—using isolated Git worktrees.
 *
 * @example
 * ```typescript
 * import { autonomousWorkflowAgent } from '@gw-tools/autonomous-workflow-agent';
 * import { query } from '@anthropic-ai/claude-code-sdk';
 *
 * for await (const message of query({
 *   prompt: "Implement user authentication feature",
 *   options: {
 *     agents: {
 *       "autonomous-workflow": autonomousWorkflowAgent
 *     }
 *   }
 * })) {
 *   console.log(message);
 * }
 * ```
 */
export const autonomousWorkflowAgent: AgentDefinition = {
  description: `Autonomous feature development workflow using isolated worktrees.
Use for end-to-end feature implementation from task description through tested PR delivery.
Handles validation, planning, worktree setup, implementation, testing, documentation, and PR creation.`,
  prompt: systemPrompt,
  tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Skill'],
  model: 'sonnet',
};

export default autonomousWorkflowAgent;
