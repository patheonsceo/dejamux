/**
 * DEJA Adapter Registry
 * Manages tool adapters for generating context files for different AI coding tools
 */

import { existsSync } from 'fs';
import { join } from 'path';
import type { ToolAdapter } from '../types.js';
import { cursorAdapter } from './cursor.js';
import { claudeCodeAdapter } from './claude-code.js';
import { copilotAdapter } from './copilot.js';
import { windsurfAdapter } from './windsurf.js';

/**
 * Registry of all available tool adapters
 */
const adapters: Map<string, ToolAdapter> = new Map([
  ['cursor', cursorAdapter],
  ['claude-code', claudeCodeAdapter],
  ['copilot', copilotAdapter],
  ['windsurf', windsurfAdapter],
]);

/**
 * Tool detection configuration
 * Maps tool names to their indicator files
 */
const toolIndicators: Record<string, string[]> = {
  cursor: ['.cursorrules', '.cursor'],
  'claude-code': ['CLAUDE.md', '.claude'],
  copilot: ['.github/copilot-instructions.md'],
  windsurf: ['.windsurfrules', '.windsurf'],
};

/**
 * Get a specific adapter by tool name
 * @param toolName - The name of the AI tool (e.g., 'cursor', 'claude-code')
 * @returns The ToolAdapter for the specified tool, or undefined if not found
 */
export function getAdapter(toolName: string): ToolAdapter | undefined {
  return adapters.get(toolName);
}

/**
 * Get all available adapters
 * @returns Array of all registered ToolAdapters
 */
export function getAllAdapters(): ToolAdapter[] {
  return Array.from(adapters.values());
}

/**
 * Get all registered tool names
 * @returns Array of tool names
 */
export function getToolNames(): string[] {
  return Array.from(adapters.keys());
}

/**
 * Detect which AI tools are in use in a project
 * Checks for indicator files that suggest a tool is being used
 * @param projectPath - Absolute path to the project root
 * @returns Array of detected tool names
 */
export function detectTools(projectPath: string): string[] {
  const detectedTools: string[] = [];

  for (const [toolName, indicators] of Object.entries(toolIndicators)) {
    for (const indicator of indicators) {
      const indicatorPath = join(projectPath, indicator);
      if (existsSync(indicatorPath)) {
        detectedTools.push(toolName);
        break; // Found one indicator, no need to check others for this tool
      }
    }
  }

  return detectedTools;
}

/**
 * Register a custom adapter
 * Allows extending DEJA with support for additional AI tools
 * @param adapter - The ToolAdapter to register
 */
export function registerAdapter(adapter: ToolAdapter): void {
  adapters.set(adapter.name, adapter);
}

// Re-export individual adapters for direct import
export { cursorAdapter } from './cursor.js';
export { claudeCodeAdapter } from './claude-code.js';
export { copilotAdapter } from './copilot.js';
export { windsurfAdapter } from './windsurf.js';
