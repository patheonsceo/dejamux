/**
 * Cursor Adapter
 * Generates .cursorrules context file for Cursor AI editor
 */

import type { ToolAdapter } from '../types.js';

const DEJA_HEADER = `# Project Context (managed by DEJA - do not edit manually)
# This file is auto-generated from your session history.
# To update, run: deja sync

`;

const CURSOR_FOOTER = `
# Cursor-specific instructions
# - Refer to the session history above for recent changes
# - Follow the patterns documented in "Key Patterns"
# - Check "Known Issues" before suggesting solutions
`;

/**
 * Cursor adapter for generating .cursorrules files
 */
export const cursorAdapter: ToolAdapter = {
  name: 'cursor',
  file: '.cursorrules',

  format(context: string): string {
    return `${DEJA_HEADER}${context}${CURSOR_FOOTER}`;
  },
};

export default cursorAdapter;
