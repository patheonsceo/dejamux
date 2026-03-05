/**
 * GitHub Copilot Adapter
 * Generates .github/copilot-instructions.md context file for GitHub Copilot
 */

import type { ToolAdapter } from '../types.js';

const DEJA_HEADER = `# Copilot Instructions (managed by DEJA - do not edit manually)

> This file is auto-generated from your session history.
> To update, run: \`deja sync\`

---

`;

/**
 * GitHub Copilot adapter for generating copilot-instructions.md files
 */
export const copilotAdapter: ToolAdapter = {
  name: 'copilot',
  file: '.github/copilot-instructions.md',

  format(context: string): string {
    return `${DEJA_HEADER}${context}`;
  },
};

export default copilotAdapter;
