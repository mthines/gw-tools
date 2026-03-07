import { autonomousWorkflowAgent } from './autonomous-workflow-agent.js';
import { systemPrompt } from './system-prompt.js';

describe('autonomousWorkflowAgent', () => {
  it('should export a valid AgentDefinition', () => {
    expect(autonomousWorkflowAgent).toBeDefined();
    expect(autonomousWorkflowAgent.description).toContain('Autonomous');
    expect(autonomousWorkflowAgent.prompt).toBe(systemPrompt);
    expect(autonomousWorkflowAgent.tools).toContain('Bash');
    expect(autonomousWorkflowAgent.model).toBe('sonnet');
  });

  it('should have required tools', () => {
    const requiredTools = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'];
    for (const tool of requiredTools) {
      expect(autonomousWorkflowAgent.tools).toContain(tool);
    }
  });

  it('should have a comprehensive system prompt', () => {
    expect(systemPrompt).toContain('Phase 0: Validation');
    expect(systemPrompt).toContain('Phase 2: Worktree Setup');
    expect(systemPrompt).toContain('Phase 4: Testing');
    expect(systemPrompt).toContain('gw add');
  });
});
