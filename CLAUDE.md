<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.

<!-- nx configuration end-->

# gw-tools Development Guidelines

## Documentation Requirements

When adding, changing, or removing features in the gw CLI tool, always update the relevant documentation:

1. **README files:**
   - `packages/gw-tool/README.md` - Main CLI documentation
   - `README.md` - Root repo overview (if applicable)

2. **Skills documentation:**
   - `skills/config-management/SKILL.md` - Configuration-related features
   - `skills/git-worktree-workflows/SKILL.md` - Worktree workflow features
   - `skills/autonomous-workflow/SKILL.md` - Autonomous workflow features (@gw-autonomous-workflow)

3. **Example files** (in `skills/*/examples/`):
   - Update relevant examples that reference the changed feature
   - Check troubleshooting guides for outdated information

4. **Help text:**
   - Update CLI help text in `packages/gw-tool/src/lib/cli.ts`

## Autonomous Workflow Guidelines

When the user requests autonomous feature development or end-to-end implementation:

1. **Use the @gw-autonomous-workflow skill** - It provides complete procedures for autonomous execution
2. **Phase 0 is MANDATORY** - Always start by asking clarifying questions and validating understanding
3. **Iterate continuously** - Self-validate and refine at every step, no hard iteration limits
4. **Follow the 8 phases**:
   - Phase 0: Validation & Questions (MANDATORY)
   - Phase 1: Task Intake & Planning
   - Phase 2: Worktree Setup
   - Phase 3: Implementation
   - Phase 4: Testing & Iteration
   - Phase 5: Documentation
   - Phase 6: PR Creation & Delivery
   - Phase 7: Cleanup (Optional)

5. **Quality gates** - Don't proceed to next phase until current phase is validated
6. **Stop and ask** when encountering fundamental blockers or ambiguities
