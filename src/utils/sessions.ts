/**
 * Session file utilities for DEJA
 */

import { readFile, writeFile, readdir, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { SessionLog } from '../types.js';
import { getSessionsPath, getDejaPath } from './paths.js';

// =============================================================================
// Session File Helpers
// =============================================================================

/**
 * Get the filename for a session log.
 * @param sessionId - The session identifier
 * @returns Filename with .json extension
 */
function getSessionFilename(sessionId: string): string {
  return `${sessionId}.json`;
}

/**
 * Extract session ID from a filename.
 * @param filename - The session log filename
 * @returns Session ID without extension
 */
function extractSessionId(filename: string): string {
  return filename.replace(/\.json$/, '');
}

// =============================================================================
// Session I/O
// =============================================================================

/**
 * List all session logs for a project.
 * @param projectPath - The project root directory path
 * @returns Array of SessionLog objects sorted by start time (newest first)
 */
export async function listSessions(projectPath: string): Promise<SessionLog[]> {
  const sessionsPath = getSessionsPath(projectPath);

  try {
    const files = await readdir(sessionsPath);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const sessions: SessionLog[] = [];

    for (const file of jsonFiles) {
      try {
        const filePath = join(sessionsPath, file);
        const content = await readFile(filePath, 'utf-8');
        const session = JSON.parse(content) as SessionLog;

        // Ensure session has an ID
        if (!session.id && !session.sessionId) {
          session.id = extractSessionId(file);
        }

        sessions.push(session);
      } catch {
        // Skip invalid session files
        continue;
      }
    }

    // Sort by start time, newest first
    sessions.sort((a, b) => {
      const timeA = typeof a.startTime === 'string' ? new Date(a.startTime).getTime() : a.startTime;
      const timeB = typeof b.startTime === 'string' ? new Date(b.startTime).getTime() : b.startTime;
      return timeB - timeA;
    });

    return sessions;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw new Error(`Failed to list sessions: ${(error as Error).message}`);
  }
}

/**
 * Load a specific session log by ID.
 * @param projectPath - The project root directory path
 * @param sessionId - The session identifier
 * @returns SessionLog object or null if not found
 */
export async function loadSession(projectPath: string, sessionId: string): Promise<SessionLog | null> {
  const sessionsPath = getSessionsPath(projectPath);
  const filePath = join(sessionsPath, getSessionFilename(sessionId));

  try {
    const content = await readFile(filePath, 'utf-8');
    const session = JSON.parse(content) as SessionLog;

    // Ensure session has an ID
    if (!session.id && !session.sessionId) {
      session.id = sessionId;
    }

    return session;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw new Error(`Failed to load session: ${(error as Error).message}`);
  }
}

/**
 * Save a session log to disk.
 * @param projectPath - The project root directory path
 * @param session - The session log to save
 */
export async function saveSession(projectPath: string, session: SessionLog): Promise<void> {
  const sessionsPath = getSessionsPath(projectPath);
  const sessionId = session.id || session.sessionId;

  if (!sessionId) {
    throw new Error('Session must have an id or sessionId');
  }

  const filePath = join(sessionsPath, getSessionFilename(sessionId));

  try {
    // Ensure sessions directory exists
    await mkdir(sessionsPath, { recursive: true });

    // Write session as formatted JSON
    const content = JSON.stringify(session, null, 2);
    await writeFile(filePath, content, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to save session: ${(error as Error).message}`);
  }
}

/**
 * Delete a session log from disk.
 * @param projectPath - The project root directory path
 * @param sessionId - The session identifier to delete
 * @returns true if session was deleted, false if not found
 */
export async function deleteSession(projectPath: string, sessionId: string): Promise<boolean> {
  const sessionsPath = getSessionsPath(projectPath);
  const filePath = join(sessionsPath, getSessionFilename(sessionId));

  try {
    await unlink(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw new Error(`Failed to delete session: ${(error as Error).message}`);
  }
}

/**
 * Get the count of total sessions for a project.
 * @param projectPath - The project root directory path
 * @returns Number of session logs
 */
export async function getSessionCount(projectPath: string): Promise<number> {
  const sessionsPath = getSessionsPath(projectPath);

  try {
    const files = await readdir(sessionsPath);
    return files.filter(f => f.endsWith('.json')).length;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 0;
    }
    throw new Error(`Failed to count sessions: ${(error as Error).message}`);
  }
}
