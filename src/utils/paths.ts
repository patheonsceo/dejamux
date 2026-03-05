/**
 * Path constants and helpers for DEJA
 */

import { access } from 'node:fs/promises';
import { join } from 'node:path';

// =============================================================================
// Path Constants
// =============================================================================

/** The DEJA directory name */
export const DEJA_DIR = '.deja';

/** Configuration file name */
export const CONFIG_FILE = 'config.yml';

/** Session state file name */
export const STATE_FILE = 'state.json';

/** Sessions directory name */
export const SESSIONS_DIR = 'sessions';

/** Context file name */
export const CONTEXT_FILE = 'context.md';

/** Knowledge file name */
export const KNOWLEDGE_FILE = 'knowledge.md';

// =============================================================================
// Path Helpers
// =============================================================================

/**
 * Get the absolute path to the .deja directory for a project.
 * @param projectPath - The project root directory path
 * @returns Absolute path to .deja directory
 */
export function getDejaPath(projectPath: string): string {
  return join(projectPath, DEJA_DIR);
}

/**
 * Get the absolute path to the config file.
 * @param projectPath - The project root directory path
 * @returns Absolute path to config.yml
 */
export function getConfigPath(projectPath: string): string {
  return join(projectPath, DEJA_DIR, CONFIG_FILE);
}

/**
 * Get the absolute path to the state file.
 * @param projectPath - The project root directory path
 * @returns Absolute path to state.json
 */
export function getStatePath(projectPath: string): string {
  return join(projectPath, DEJA_DIR, STATE_FILE);
}

/**
 * Get the absolute path to the sessions directory.
 * @param projectPath - The project root directory path
 * @returns Absolute path to sessions directory
 */
export function getSessionsPath(projectPath: string): string {
  return join(projectPath, DEJA_DIR, SESSIONS_DIR);
}

/**
 * Get the absolute path to the context file.
 * @param projectPath - The project root directory path
 * @returns Absolute path to context.md
 */
export function getContextPath(projectPath: string): string {
  return join(projectPath, DEJA_DIR, CONTEXT_FILE);
}

/**
 * Get the absolute path to the knowledge file.
 * @param projectPath - The project root directory path
 * @returns Absolute path to knowledge.md
 */
export function getKnowledgePath(projectPath: string): string {
  return join(projectPath, DEJA_DIR, KNOWLEDGE_FILE);
}

/**
 * Check if DEJA has been initialized in a project directory.
 * @param projectPath - The project root directory path
 * @returns true if .deja directory and config file exist
 */
export async function isDejaInitialized(projectPath: string): Promise<boolean> {
  try {
    const configPath = getConfigPath(projectPath);
    await access(configPath);
    return true;
  } catch {
    return false;
  }
}
