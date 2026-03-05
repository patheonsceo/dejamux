/**
 * Claude Code Adapter
 * Generates CLAUDE.md context file for Claude Code CLI
 */

import type { ToolAdapter } from '../types.js';

const DEJA_HEADER = `# CLAUDE.md (managed by DEJA - do not edit manually)

> This file is auto-generated from your session history.
> To update, run: \`deja sync\`

---

`;

/**
 * Claude Code adapter for generating CLAUDE.md files
 */
export const claudeCodeAdapter: ToolAdapter = {
  name: 'claude-code',
  file: 'CLAUDE.md',

  format(context: string): string {
    return `${DEJA_HEADER}${context}`;
  },
};

export default claudeCodeAdapter;
