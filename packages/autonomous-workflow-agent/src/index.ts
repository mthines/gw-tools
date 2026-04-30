if (typeof process !== 'undefined' && process.emitWarning) {
  process.emitWarning(
    '@gw-tools/autonomous-workflow-agent is deprecated. ' +
      'Install the autonomous-workflow skill from https://github.com/mthines/agent-skills instead. ' +
      'See https://github.com/mthines/agent-skills#autonomous-workflow for migration instructions.',
    'DeprecationWarning',
    'GW_AUTONOMOUS_WORKFLOW_AGENT_DEPRECATED'
  );
}

export {
  autonomousWorkflowAgent,
  default,
  type AgentDefinition,
  type ToolName,
} from './lib/autonomous-workflow-agent.js';
export { systemPrompt } from './lib/system-prompt.js';
