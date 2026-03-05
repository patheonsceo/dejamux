import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import inquirer from 'inquirer';
import type { SessionLog } from '../types.js';

const DEJA_DIR = '.deja';
const SESSIONS_DIR = 'sessions';
const CONTEXT_FILE = 'context.md';

async function checkInitialized(cwd: string): Promise<boolean> {
  try {
    await fs.access(path.join(cwd, DEJA_DIR));
    return true;
  } catch {
    return false;
  }
}

async function sessionExists(cwd: string, sessionId: string): Promise<boolean> {
  try {
    const sessionPath = path.join(cwd, DEJA_DIR, SESSIONS_DIR, `${sessionId}.json`);
    await fs.access(sessionPath);
    return true;
  } catch {
    return false;
  }
}

async function deleteSession(cwd: string, sessionId: string): Promise<void> {
  const sessionPath = path.join(cwd, DEJA_DIR, SESSIONS_DIR, `${sessionId}.json`);
  await fs.unlink(sessionPath);
}

async function getRecentSessions(cwd: string, limit: number = 5): Promise<SessionLog[]> {
  const sessionsPath = path.join(cwd, DEJA_DIR, SESSIONS_DIR);

  try {
    const files = await fs.readdir(sessionsPath);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

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

function compileContextFromSessions(sessions: SessionLog[]): string {
  if (sessions.length === 0) {
    return '# DEJA Context\n\nNo sessions recorded yet.';
  }

  const lines: string[] = ['# DEJA Context', ''];
  lines.push(`*Generated from ${sessions.length} recent session(s)*`, '');

  // Collect decisions, patterns, and issues from all sessions
  const decisions: string[] = [];
  const patterns: string[] = [];
  const issues: string[] = [];
  const recentFiles = new Set<string>();

  for (const session of sessions) {
    // Collect files
    const files = session.filesChanged || [];
    files.forEach(f => recentFiles.add(f));

    const changes = session.changes || [];
    changes.forEach(c => {
      if (c.path) recentFiles.add(c.path);
    });

    // Collect from summary
    if (session.summary && typeof session.summary === 'object') {
      decisions.push(...(session.summary.decisions || []));
      patterns.push(...(session.summary.patterns || []));
      issues.push(...(session.summary.issues || []));
    }
  }

  // Recent Sessions
  lines.push('## Recent Sessions', '');
  for (const session of sessions) {
    const sessionId = session.sessionId || session.id || 'unknown';
    const startDate = new Date(session.startTime).toLocaleString();
    const filesCount = (session.filesChanged?.length || 0) + (session.changes?.length || 0);

    lines.push(`### ${sessionId}`);
    lines.push(`- **Date**: ${startDate}`);
    lines.push(`- **Branch**: ${session.branch || 'unknown'}`);
    lines.push(`- **Files changed**: ${filesCount}`);

    if (session.summary) {
      if (typeof session.summary === 'string') {
        lines.push(`- **Summary**: ${session.summary}`);
      } else if (session.summary.overview) {
        lines.push(`- **Summary**: ${session.summary.overview}`);
      }
    }

    lines.push('');
  }

  // Decisions
  if (decisions.length > 0) {
    lines.push('## Key Decisions', '');
    const uniqueDecisions = [...new Set(decisions)];
    for (const decision of uniqueDecisions) {
      lines.push(`- ${decision}`);
    }
    lines.push('');
  }

  // Patterns
  if (patterns.length > 0) {
    lines.push('## Code Patterns', '');
    const uniquePatterns = [...new Set(patterns)];
    for (const pattern of uniquePatterns) {
      lines.push(`- ${pattern}`);
    }
    lines.push('');
  }

  // Issues
  if (issues.length > 0) {
    lines.push('## Known Issues', '');
    const uniqueIssues = [...new Set(issues)];
    for (const issue of uniqueIssues) {
      lines.push(`- ${issue}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function recompileContext(cwd: string): Promise<void> {
  const sessions = await getRecentSessions(cwd);
  const contextContent = compileContextFromSessions(sessions);
  const contextPath = path.join(cwd, DEJA_DIR, CONTEXT_FILE);
  await fs.writeFile(contextPath, contextContent, 'utf-8');
}

async function forgetAction(sessionId: string, options: { force: boolean }): Promise<void> {
  const cwd = process.cwd();

  console.log('');

  // Check if DEJA is initialized
  if (!await checkInitialized(cwd)) {
    console.log(chalk.red('  DEJA is not initialized in this directory.'));
    console.log(chalk.gray('  Run `deja init` first to set up DEJA.\n'));
    process.exit(1);
  }

  // Check if session exists
  if (!await sessionExists(cwd, sessionId)) {
    console.log(chalk.red(`  Session "${sessionId}" not found.`));
    console.log(chalk.gray('  Run `deja log` to see available sessions.\n'));
    process.exit(1);
  }

  // Confirm deletion unless --force is used
  if (!options.force) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to delete session "${sessionId}"?`,
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(chalk.yellow('\n  Deletion cancelled.\n'));
      return;
    }
  }

  const spinner = ora('Deleting session...').start();

  try {
    await deleteSession(cwd, sessionId);
    spinner.succeed('Session deleted');

    // Recompile context
    const contextSpinner = ora('Recompiling context...').start();
    await recompileContext(cwd);
    contextSpinner.succeed('Context recompiled');

    console.log(chalk.green(`\n  Session "${sessionId}" has been deleted.`));
    console.log(chalk.gray('  Context has been updated to reflect this change.\n'));
  } catch (error) {
    spinner.fail('Failed to delete session');
    console.error(chalk.red(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}

export const forgetCommand = new Command('forget')
  .description('Delete a specific session')
  .argument('<session-id>', 'The session ID to delete')
  .option('-f, --force', 'Skip confirmation prompt')
  .action((sessionId, options) => forgetAction(sessionId, { force: options.force || false }));
