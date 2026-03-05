/**
 * Session state utilities for DEJA
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { SessionState } from '../types.js';
import { getStatePath, getDejaPath } from './paths.js';

// =============================================================================
// State I/O
// =============================================================================

/**
 * Load the session state from a project.
 * @param projectPath - The project root directory path
 * @returns SessionState object or null if not found
 */
export async function loadState(projectPath: string): Promise<SessionState | null> {
  const statePath = getStatePath(projectPath);

  try {
    const content = await readFile(statePath, 'utf-8');
    return JSON.parse(content) as SessionState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw new Error(`Failed to load state: ${(error as Error).message}`);
  }
}

/**
 * Save the session state to a project.
 * @param projectPath - The project root directory path
 * @param state - The state to save
 */
export async function saveState(projectPath: string, state: SessionState): Promise<void> {
  const statePath = getStatePath(projectPath);
  const dejaPath = getDejaPath(projectPath);

  try {
    // Ensure .deja directory exists
    await mkdir(dejaPath, { recursive: true });

    // Write state as formatted JSON
    const content = JSON.stringify(state, null, 2);
    await writeFile(statePath, content, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to save state: ${(error as Error).message}`);
  }
}

/**
 * Check if a session is currently active for a project.
 * @param projectPath - The project root directory path
 * @returns true if a session is active
 */
export async function isSessionActive(projectPath: string): Promise<boolean> {
  const state = await loadState(projectPath);
  return state?.active === true;
}

/**
 * Get the default (inactive) session state.
 * @returns Default SessionState object
 */
export function getDefaultState(): SessionState {
  return {
    active: false,
    sessionId: null,
    startTime: null,
    branch: null,
    filesChanged: [],
  };
}

/**
 * Clear the session state (set to inactive).
 * @param projectPath - The project root directory path
 */
export async function clearState(projectPath: string): Promise<void> {
  await saveState(projectPath, getDefaultState());
}
