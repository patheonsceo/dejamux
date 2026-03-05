import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import type { SessionLog } from '../types.js';

const DEJA_DIR = '.deja';
const SESSIONS_DIR = 'sessions';

async function checkInitialized(cwd: string): Promise<boolean> {
  try {
    await fs.access(path.join(cwd, DEJA_DIR));
    return true;
  } catch {
    return false;
  }
}

function formatDate(timestamp: string | number): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
  return date.toLocaleString();
}

function formatDuration(startTime: string | number, endTime: string | number): string {
  const start = typeof startTime === 'number' ? startTime : new Date(startTime).getTime();
  const end = typeof endTime === 'number' ? endTime : new Date(endTime).getTime();
  const diffMs = end - start;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

async function getSessionLogs(cwd: string, limit: number): Promise<SessionLog[]> {
  const sessionsPath = path.join(cwd, DEJA_DIR, SESSIONS_DIR);

  try {
    const files = await fs.readdir(sessionsPath);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    // Read all session files
    const sessions: SessionLog[] = [];
    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(path.join(sessionsPath, file), 'utf-8');
        const session = JSON.parse(content) as SessionLog;
        sessions.push(session);
      } catch {
        // Skip invalid files
      }
    }

    // Sort by start time (newest first)
    sessions.sort((a, b) => {
      const timeA = typeof a.startTime === 'number' ? a.startTime : new Date(a.startTime).getTime();
      const timeB = typeof b.startTime === 'number' ? b.startTime : new Date(b.startTime).getTime();
      return timeB - timeA;
    });

    return sessions.slice(0, limit);
  } catch {
    return [];
  }
}

async function logAction(options: { limit: number }): Promise<void> {
  const cwd = process.cwd();
  const limit = options.limit || 10;

  console.log('');

  // Check if DEJA is initialized
  if (!await checkInitialized(cwd)) {
    console.log(chalk.red('  DEJA is not initialized in this directory.'));
    console.log(chalk.gray('  Run `deja init` first to set up DEJA.\n'));
    process.exit(1);
  }

  const sessions = await getSessionLogs(cwd, limit);

  if (sessions.length === 0) {
    console.log(chalk.yellow('  No sessions found.'));
    console.log(chalk.gray('  Start a session with `deja start` and stop it with `deja stop`.\n'));
    return;
  }

  console.log(chalk.blue(`  Recent Sessions (showing ${sessions.length})\n`));

  for (const session of sessions) {
    const sessionId = session.sessionId || session.id || 'unknown';
    const date = formatDate(session.startTime);
    const duration = formatDuration(session.startTime, session.endTime);
    const filesCount = session.filesChanged?.length || session.changes?.length || 0;
    const notesCount = session.notes?.length || 0;

    console.log(chalk.white(`  ${chalk.bold(sessionId)}`));
    console.log(chalk.gray(`    Date: ${date}`));
    console.log(chalk.gray(`    Duration: ${duration}`));
    console.log(chalk.gray(`    Files changed: ${filesCount}`));
    if (notesCount > 0) {
      console.log(chalk.gray(`    Notes: ${notesCount}`));
    }
    if (session.branch) {
      console.log(chalk.gray(`    Branch: ${session.branch}`));
    }
    if (session.summary && typeof session.summary === 'object' && session.summary.overview) {
      console.log(chalk.gray(`    Summary: ${session.summary.overview}`));
    } else if (typeof session.summary === 'string') {
      console.log(chalk.gray(`    Summary: ${session.summary}`));
    }
    console.log('');
  }
}

export const logCommand = new Command('log')
  .description('Show recent session summaries')
  .option('-l, --limit <number>', 'Number of sessions to show', '10')
  .action((options) => logAction({ limit: parseInt(options.limit, 10) }));
