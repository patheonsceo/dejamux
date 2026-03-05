/**
 * Windsurf Adapter
 * Generates .windsurfrules context file for Windsurf AI editor
 */

import type { ToolAdapter } from '../types.js';

const DEJA_HEADER = `# Project Context (managed by DEJA - do not edit manually)
# This file is auto-generated from your session history.
# To update, run: deja sync

`;

const WINDSURF_FOOTER = `
# Windsurf-specific instructions
# - Refer to the session history above for recent changes
# - Follow the patterns documented in "Key Patterns"
# - Check "Known Issues" before suggesting solutions
`;

/**
 * Windsurf adapter for generating .windsurfrules files
 */
export const windsurfAdapter: ToolAdapter = {
  name: 'windsurf',
  file: '.windsurfrules',

  format(context: string): string {
    return `${DEJA_HEADER}${context}${WINDSURF_FOOTER}`;
  },
};

export default windsurfAdapter;
